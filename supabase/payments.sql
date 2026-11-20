-- ════════════════════════════════════════════════════════════════
--  Incoming-transfer alerts (K PLUS → MacroDroid → here)
--  Run once in Supabase → SQL Editor, AFTER schema.sql.
--
--  How it works: MacroDroid on the receiver's Android phone forwards the
--  K PLUS "money in" notification text to report_incoming(). This function
--  checks a secret token, reads the amount, and (by default) records it as a
--  payment from Person B, so the balance goes down automatically.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.incoming_payments (
  id            uuid primary key default gen_random_uuid(),
  received_at   timestamptz not null default now(),
  amount        numeric(12, 2),
  sender        text,
  message       text not null,
  status        text not null default 'new' check (status in ('new', 'recorded', 'ignored')),
  settlement_id uuid references public.settlements(id) on delete set null,
  seen          boolean not null default false
);
create index if not exists incoming_payments_received_idx on public.incoming_payments (received_at desc);

create table if not exists public.webhook_config (
  id            int primary key default 1 check (id = 1),
  token         text not null default replace(gen_random_uuid()::text, '-', ''),
  auto_settle   boolean not null default true,   -- record every incoming transfer as "B paid A"
  sender_filter text                              -- optional: only auto-record if the text contains this (e.g. part of B's name)
);
insert into public.webhook_config (id) values (1) on conflict do nothing;

alter table public.incoming_payments enable row level security;
alter table public.webhook_config    enable row level security;

drop policy if exists "members all" on public.incoming_payments;
create policy "members all" on public.incoming_payments
  for all to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "members all" on public.webhook_config;
create policy "members all" on public.webhook_config
  for all to authenticated using (public.is_member()) with check (public.is_member());

grant select, update, delete on public.incoming_payments to authenticated;
grant select, update on public.webhook_config to authenticated;

-- Pull the transferred amount (not the balance) and the sender out of a bank notification.
create or replace function public.parse_bank_message(msg text, out amount numeric, out sender text, out outgoing boolean)
language plpgsql immutable set search_path = public as $$
declare
  m text[];
  pos int;
  pre text;
begin
  outgoing := msg ~* '(เงินออก|โอนออก|ถอน|ชำระเงิน|จ่ายบิล|โอนเงินไป|withdraw|transfer out|paid)'
              and msg !~* '(เงินเข้า|รับเงิน|โอนเข้า|received)';
  -- first "123.45"-style number that isn't a balance
  for m in select regexp_matches(msg, '([0-9][0-9,]*\.[0-9]{2})', 'g') loop
    pos := position(m[1] in msg);
    pre := substr(msg, greatest(1, pos - 20), least(pos - 1, 20));
    if pre !~* '(คงเหลือ|ยอดเงิน|balance|avail)' then
      amount := replace(m[1], ',', '')::numeric;
      exit;
    end if;
  end loop;
  -- whole-baht amounts like "รับเงิน 10 บาท"
  if amount is null then
    m := regexp_match(msg, '([0-9][0-9,]*)\s*(บาท|THB|฿)');
    if m is not null then amount := replace(m[1], ',', '')::numeric; end if;
  end if;
  m := regexp_match(msg, 'จาก\s*([^\s0-9]+(\s+[^\s0-9]+)?)');
  if m is not null then sender := m[1]; end if;
end $$;

create or replace function public.report_incoming(token text, message text)
returns json language plpgsql security definer set search_path = public as $$
declare
  cfg public.webhook_config;
  p record;
  sid uuid;
  st text := 'new';
begin
  select * into cfg from public.webhook_config where id = 1;
  if cfg is null or token is distinct from cfg.token then
    raise exception 'invalid token' using errcode = '28000';
  end if;
  if message is null or length(message) = 0 or length(message) > 2000 then
    raise exception 'bad message';
  end if;

  p := public.parse_bank_message(message);

  if message ilike 'TEST%' then
    st := 'ignored';                       -- test button in Settings: shows an alert, records nothing
  elsif p.outgoing or p.amount is null or p.amount <= 0 then
    st := 'ignored';
  elsif cfg.auto_settle and (coalesce(cfg.sender_filter, '') = '' or position(lower(cfg.sender_filter) in lower(message)) > 0) then
    insert into public.settlements (date, from_person, amount, note)
    values ((now() at time zone 'Asia/Bangkok')::date, 'b', p.amount, 'พร้อมเพย์ (อัตโนมัติ)')
    returning id into sid;
    st := 'recorded';
  end if;

  insert into public.incoming_payments (amount, sender, message, status, settlement_id)
  values (p.amount, p.sender, message, st, sid);

  return json_build_object('ok', true, 'amount', p.amount, 'sender', p.sender, 'status', st);
end $$;

revoke all on function public.report_incoming(text, text) from public;
grant execute on function public.report_incoming(text, text) to anon, authenticated;

-- Realtime: the web page pops up an alert the moment money arrives
do $$
begin
  alter publication supabase_realtime add table public.incoming_payments;
exception when duplicate_object then null;
end $$;
