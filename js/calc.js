// Pure money/date helpers (no DOM)
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function itemsTotal(items = []) {
  return round2(items.reduce((s, it) => s + (Number(it.price) || 0), 0));
}

/** Each person's share of one expense. */
export function shares(e) {
  if (e.split === 'items') {
    let a = 0, b = 0;
    for (const it of e.items || []) {
      const p = Number(it.price) || 0;
      if (it.owner === 'a') a += p;
      else if (it.owner === 'b') b += p;
      else { a += p / 2; b += p / 2; }
    }
    return { a: round2(a), b: round2(b) };
  }
  const tot = Number(e.total) || 0;
  return { a: round2(tot / 2), b: round2(tot / 2) };
}

/**
 * Net balance across everything. Positive => B owes A, negative => A owes B.
 */
export function balance(expenses, settlements) {
  let n = 0;
  for (const e of expenses) {
    const s = shares(e);
    if (e.payer === 'a') n += s.b; else n -= s.a;
  }
  for (const p of settlements) {
    const amt = Number(p.amount) || 0;
    if (p.from_person === 'b') n -= amt; else n += amt;
  }
  return round2(n);
}

export function todayStr() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export const monthOf = (dateStr) => dateStr.slice(0, 7);
export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Monthly stats for the dashboard. */
export function monthStats(expenses, ym) {
  const list = expenses.filter((e) => monthOf(e.date) === ym);
  let total = 0, a = 0, b = 0, paidA = 0, paidB = 0;
  const byCat = {}, byPlace = {}, days = new Set();
  for (const e of list) {
    const tot = Number(e.total) || 0;
    const s = shares(e);
    total += tot; a += s.a; b += s.b;
    if (e.payer === 'a') paidA += tot; else paidB += tot;
    byCat[e.category] = (byCat[e.category] || 0) + tot;
    const place = (e.title || '').trim();
    if (place) byPlace[place] = (byPlace[place] || 0) + tot;
    days.add(e.date);
  }
  return {
    list, count: list.length, total: round2(total), a: round2(a), b: round2(b),
    paidA: round2(paidA), paidB: round2(paidB), days: days.size,
    avgMeal: list.length ? round2(total / list.length) : 0,
    avgDay: days.size ? round2(total / days.size) : 0,
    byCat, byPlace,
  };
}
