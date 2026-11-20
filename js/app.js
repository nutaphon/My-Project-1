import { t, getLang, setLang, locale } from './i18n.js';
import { createStore } from './store.js';
import { readReceipt } from './receipt.js';
import { promptPaySvg, normalizeId } from './promptpay.js';
import { shares, balance, round2, itemsTotal, todayStr, monthOf, shiftMonth, monthStats, kindOf } from './calc.js';

const KINDS = [['store', '🏪'], ['food', '🍜'], ['travel', '🛵']];
const kindEmoji = (k) => (KINDS.find((x) => x[0] === k) || KINDS[1])[1];

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '฿' + (Number(n) || 0).toLocaleString(locale(), { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const state = {
  store: null, session: null, listening: false,
  settings: { name_a: '', name_b: '' },
  expenses: [], settlements: [],
  view: 'dashboard', month: monthOf(todayStr()), search: '',
  batch: null, chart: null,
};
const nameOf = (p) => (p === 'a' ? state.settings.name_a || 'A' : state.settings.name_b || 'B');
const other = (p) => (p === 'a' ? 'b' : 'a');

// ---------- boot ----------
async function boot() {
  setLang(getLang());
  state.store = createStore();
  state.session = await state.store.getSession();
  if (state.store.mode === 'cloud') {
    state.store.sb.auth.onAuthStateChange((_e, session) => {
      const was = !!state.session; state.session = session;
      if (!!session !== was) start();
    });
  }
  start();
}

async function start() {
  if (!state.session) return renderLogin();
  renderShell();
  $('#view').innerHTML = `<div class="empty">${t('loading')}</div>`;
  try {
    await reload();
    if (!state.listening) {
      state.listening = true;
      state.store.subscribe(debounce(async () => { await reload(); if (!state.batch) render(); }, 400));
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && !state.batch && state.session) { await reload(); render(); }
      });
    }
  } catch (e) { toast(t('error', { msg: e.message }), true); }
  render();
}

async function reload() {
  const [settings, expenses, settlements] = await Promise.all([
    state.store.getSettings(), state.store.listExpenses(), state.store.listSettlements(),
  ]);
  const th = getLang() === 'th';
  state.settings = { name_a: settings?.name_a || (th ? 'เรา' : 'Me'), name_b: settings?.name_b || (th ? 'แฟน' : 'Partner'), promptpay: settings?.promptpay || '' };
  state.expenses = expenses.sort((x, y) => (y.date + (y.created_at || '')).localeCompare(x.date + (x.created_at || '')));
  state.settlements = settlements.sort((x, y) => y.date.localeCompare(x.date));
}

function debounce(fn, ms) { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; }

// ---------- shell ----------
function renderShell() {
  document.title = t('appName');
  $('#app').innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="logo">🍱</span><span>${t('appName')}</span></div>
      <button class="lang-btn" data-action="lang" aria-label="Language">${getLang() === 'th' ? 'EN' : 'ไทย'}</button>
    </header>
    <main id="view"></main>
    <nav class="tabbar">
      ${[['dashboard', '🏠'], ['history', '🧾'], ['add', '＋'], ['settle', '💸'], ['settings', '⚙️']].map(([v, ic]) => `
        <button class="tab ${v === 'add' ? 'tab-add' : ''}" ${v === 'add' ? 'data-action="add-menu"' : `data-nav="${v}"`}>
          <span class="tab-ic">${ic}</span><span class="tab-label">${t('nav_' + v)}</span>
        </button>`).join('')}
    </nav>
    <div id="modal" class="modal hidden"></div>
    <div id="toast" class="toast hidden"></div>`;
}

function render() {
  if (!$('#view')) renderShell();
  document.querySelectorAll('[data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === state.view));
  if (state.chart) { state.chart.destroy(); state.chart = null; }
  const v = $('#view');
  ({ dashboard: viewDashboard, add: viewEditor, history: viewHistory, settle: viewSettle, settings: viewSettings }[state.view])(v);
}

function go(view) {
  state.batch = null; state.view = view; render(); window.scrollTo({ top: 0 });
}
function monthNav() {
  const [y, m] = state.month.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
  return `<div class="month-nav">
    <button class="icon-btn" data-action="month" data-d="-1" aria-label="previous">‹</button>
    <strong>${label}</strong>
    <button class="icon-btn" data-action="month" data-d="1" aria-label="next">›</button>
  </div>`;
}

function balanceCard(withButton = true) {
  const bal = balance(state.expenses, state.settlements);
  if (Math.abs(bal) < 0.01) return `<section class="card balance settled"><div class="bal-label">${t('balance')}</div><div class="bal-big">${t('allSettled')}</div></section>`;
  const from = bal > 0 ? 'b' : 'a', to = other(from);
  return `<section class="card balance">
    <div class="bal-label">${t('balance')}</div>
    <div class="bal-who">${esc(t('owes', { from: nameOf(from), to: nameOf(to) }))}</div>
    <div class="bal-big">${money(Math.abs(bal))}</div>
    ${withButton ? `<button class="btn btn-light" data-nav="settle">${t('settleNow')} →</button>` : ''}
  </section>`;
}

function quickActions() {
  return `<section class="quick two">${KINDS.slice(0, 2).map(([k, e]) => `
    <button class="quick-btn quick-${k}" data-action="new" data-kind="${k}">
      <span class="quick-ic">${e}</span><span class="quick-title">${t('kind_' + k)}</span>
      <span class="quick-hint">${t('kindHint_' + k)}</span>
    </button>`).join('')}</section>`;
}

// ---------- dashboard ----------
function viewDashboard(v) {
  const s = monthStats(state.expenses, state.month);
  const kindRows = KINDS.map(([k]) => [k, s.byCat[k] || 0]).filter((r) => r[1]);
  const maxK = Math.max(1, ...kindRows.map((r) => r[1]));
  const recent = s.list.slice(0, 5);

  v.innerHTML = `
    ${balanceCard()}
    ${quickActions()}
    ${monthNav()}
    ${!s.count ? `<div class="empty">${t('noData')}</div>` : `
    <section class="hero card">
      <div class="muted"><span class="dot dot-b"></span>${esc(t('partnerThisMonth', { name: nameOf('b') }))}</div>
      <div class="hero-num">${money(s.b)}</div>
      <div class="muted small">${t('daysCount', { n: s.days })} · ${t('avgPerDay')} ${money(s.days ? s.b / s.days : 0)}</div>
    </section>
    <section class="grid2">
      <div class="card stat"><div class="stat-head"><span class="dot dot-a"></span>${esc(t('mineThisMonth', { name: nameOf('a') }))}</div><div class="stat-num">${money(s.a)}</div></div>
      <div class="card stat"><div class="stat-head">${t('allTotal')}</div><div class="stat-num">${money(s.total)}</div></div>
    </section>
    <section class="card">
      <h3>${t('byKind')}</h3>
      ${kindRows.map(([k, amt]) => `
        <div class="hbar" title="${esc(t('kind_' + k))}: ${money(amt)}">
          <div class="hbar-label">${kindEmoji(k)} ${esc(t('kindShort_' + k))}</div>
          <div class="hbar-track"><div class="hbar-fill" style="width:${(amt / maxK) * 100}%"></div></div>
          <div class="hbar-val">${money(amt)}</div>
        </div>`).join('')}
    </section>
    <section>
      <div class="section-row"><h3>${t('recent')}</h3><button class="link" data-nav="history">${t('seeAll')}</button></div>
      <div class="card list">${recent.map(expRow).join('')}</div>
    </section>`}
    <section class="card">
      <h3>${t('trend6')}</h3>
      <div class="legend">${['b', 'a'].map((p) => `<span><span class="dot dot-${p}"></span>${esc(nameOf(p))}</span>`).join('')}</div>
      <div class="chart-box"><canvas id="trend" aria-label="${t('trend6')}"></canvas></div>
    </section>`;
  drawTrend();
}

function drawTrend() {
  if (!window.Chart) { $('#trend')?.closest('section')?.remove(); return; }
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(state.month, i - 5));
  const data = months.map((m) => monthStats(state.expenses, m));
  const css = getComputedStyle(document.documentElement);
  const col = (n) => css.getPropertyValue(n).trim();
  const labels = months.map((m) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString(locale(), { month: 'short' }); });
  state.chart = new window.Chart($('#trend'), {
    type: 'bar',
    data: {
      labels,
      datasets: ['b', 'a'].map((p) => ({
        label: nameOf(p), data: data.map((d) => d[p]),
        backgroundColor: col(`--person-${p}`), borderColor: col('--surface'), borderWidth: { top: 2 },
        borderRadius: 4, borderSkipped: false, maxBarThickness: 28,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${money(c.raw)}`, footer: (items) => `${t('total')}: ${money(items.reduce((s, i) => s + i.raw, 0))}` } },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: col('--text-2') } },
        y: { stacked: true, grid: { color: col('--grid') }, border: { display: false }, ticks: { color: col('--text-2'), callback: (val) => '฿' + Number(val).toLocaleString(locale()) } },
      },
    },
  });
}

// ---------- editor: one page, many "cards" (ใบที่ 1, 2, …). Each card = one day and can hold
//            a 7-11 receipt + eating-out items + rides. Everything is saved together. ----------
let keySeq = 0;
const nk = () => 'k' + (++keySeq);
const PART_ORDER = ['store', 'food', 'travel'];

function newPart(kind) {
  return {
    key: nk(), kind, id: null, created_at: null, title: kind === 'store' ? '7-Eleven' : '',
    items: kind === 'travel' ? [{ name: t('rideThere'), price: '', owner: 'a' }]
      : kind === 'food' ? [{ name: '', price: '', owner: 'b' }] : [],
    slip_path: null, slipFile: null, slipPreview: null, _slipUrl: null, removeOldSlip: false,
    ocr: null, ocrTotal: null, showImg: false,
  };
}
function newCard(kinds = []) {
  return { key: nk(), date: todayStr(), note: '', payer: 'a', parts: kinds.map(newPart) };
}
function addPart(card, kind) {
  let p = card.parts.find((x) => x.kind === kind);
  if (p) return p;
  p = newPart(kind);
  card.parts.push(p);
  card.parts.sort((a, b) => PART_ORDER.indexOf(a.kind) - PART_ORDER.indexOf(b.kind));
  return p;
}
function cardFrom(e) {
  const kind = kindOf(e);
  let items = (e.items && e.items.length) ? e.items.map((i) => ({ ...i, price: String(i.price) })) : [];
  if (!items.length) { // older 50/50 entries → show as two halves
    const s = shares(e);
    items = [{ name: e.title, price: String(s.a), owner: 'a' }, { name: e.title, price: String(s.b), owner: 'b' }];
  }
  const part = { ...newPart(kind), id: e.id, created_at: e.created_at, title: e.title, items, slip_path: e.slip_path };
  return { key: nk(), date: e.date, note: e.note || '', payer: e.payer, parts: [part] };
}

const B = () => state.batch;
const findCard = (k) => B()?.cards.find((c) => c.key === k);
const validItems = (p) => p.items.filter((i) => Number(i.price));
const partShares = (p) => shares({ split: 'items', items: validItems(p).map((i) => ({ ...i, price: Number(i.price) })) });
function cardShares(c) {
  let a = 0, b = 0;
  for (const p of c.parts) { const s = partShares(p); a += s.a; b += s.b; }
  return { a: round2(a), b: round2(b) };
}
const ocrBusyPart = (p) => p.ocr && ['queued', 'loading', 'reading'].includes(p.ocr.status);

/** Start (or continue) a batch. kind = 'store' → pick receipts; 'food' → new eating-out card. */
function openEditor(kind) {
  closeModal();
  if (state.view !== 'add' || !B()) state.batch = { cards: [], editing: false };
  state.view = 'add';
  if (kind === 'food') {
    const c = newCard(['food']); B().cards.push(c);
    render(); scrollToCard(c);
  } else {
    render();
    pickReceipts(null);
  }
}
function editExpense(e) {
  const c = cardFrom(e);
  state.batch = { cards: [c], editing: true };
  state.view = 'add'; render(); window.scrollTo({ top: 0 });
  const p = c.parts[0];
  if (p.slip_path) state.store.slipUrl(p.slip_path).then((u) => { p._slipUrl = u; refreshCard(c); }).catch(() => {});
}

let receiptTarget = null; // card that gets the next picked receipt (null = new cards)
function pickReceipts(card) {
  receiptTarget = card;
  const inp = $('#slip-input');
  inp.multiple = !card;
  inp.click();
}
function scrollToCard(c) { document.getElementById('card-' + c.key)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

function viewEditor(v) {
  const b = B() || (state.batch = { cards: [], editing: false });
  v.innerHTML = `
    <div class="editor">
      <div class="livebar" id="livebar"></div>
      ${!b.cards.length ? `
        <div class="card form">
          <button type="button" class="upload big" data-action="pick-receipts">${t('uploadReceipts')}</button>
          <p class="hint">💡 ${t('uploadHint')}</p>
          <button type="button" class="link center" data-action="new-card" data-kind="food">${t('orStartFood')}</button>
        </div>` : ''}
      <div id="cards">${b.cards.map((c, i) => cardHtml(c, i)).join('')}</div>
      ${b.cards.length && !b.editing ? `
        <div class="add-more-row">
          <button type="button" class="btn btn-ghost add-more" data-action="pick-receipts">${t('moreReceipts')}</button>
          <button type="button" class="btn btn-ghost add-more" data-action="new-card" data-kind="food">${t('moreFoodCard')}</button>
        </div>` : ''}
      <input type="file" id="slip-input" accept="image/*" multiple hidden>
    </div>
    <div class="savebar" id="savebar"></div>`;
  refreshBars();
}

function cardHtml(c, i) {
  const s = cardShares(c);
  const has = (k) => c.parts.some((p) => p.kind === k);
  const editing = B().editing;
  return `<section class="card daycard" data-card="${c.key}" id="card-${c.key}">
    <div class="day-top">
      <div class="day-title"><strong>${t('cardNo', { n: i + 1 })}</strong>
        <span class="day-sum"><span class="dot dot-b"></span>${money(s.b)} <span class="dot dot-a"></span>${money(s.a)}</span></div>
      ${editing ? '' : `<button type="button" class="icon-btn danger" data-action="del-card" aria-label="${t('delete')}">✕</button>`}
    </div>
    <label class="field day-date"><span>${t('date')}</span><input type="date" data-cf="date" value="${esc(c.date)}" required></label>
    ${c.parts.map((p) => partHtml(c, p)).join('')}
    ${editing ? '' : `<div class="part-add">
      ${has('store') ? '' : `<button type="button" class="chip" data-action="add-receipt">${t('addReceiptPart')}</button>`}
      ${has('food') ? '' : `<button type="button" class="chip" data-action="add-part" data-kind="food">${t('addFoodPart')}</button>`}
      ${has('travel') ? '' : `<button type="button" class="chip" data-action="add-part" data-kind="travel">${t('addRidePart')}</button>`}
    </div>`}
    <details class="more" ${c.note || c.payer === 'b' ? 'open' : ''}>
      <summary>${t('moreOptions')}</summary>
      <label class="field"><span>${t('note')}</span><input type="text" data-cf="note" value="${esc(c.note || '')}" placeholder="${t('notePh')}"></label>
      <div class="field"><span>${t('whoPaid')}</span>
        <div class="chips">${['a', 'b'].map((p) => `<button type="button" class="chip sm ${c.payer === p ? 'on' : ''}" data-action="payer" data-p="${p}">${esc(nameOf(p))}</button>`).join('')}</div>
      </div>
    </details>
  </section>`;
}

function partHtml(c, p) {
  const k = p.kind;
  const s = partShares(p);
  const busy = ocrBusyPart(p);
  const tot = round2(s.a + s.b);
  const warn = k === 'store' && p.ocrTotal && Math.abs(p.ocrTotal - tot) > 0.01
    ? `<div class="ocr-err small">⚠️ ${t('totalMismatch', { r: money(p.ocrTotal), s: money(tot) })}</div>` : '';
  return `<div class="part part-${k}" data-part="${p.key}">
    <div class="part-head">
      <strong>${t('part_' + k)}</strong>
      <span class="part-sum" data-psum>${partSumHtml(p)}</span>
      ${B().editing ? '' : `<button type="button" class="icon-btn danger sm" data-action="del-part" aria-label="${t('delete')}">✕</button>`}
    </div>
    ${k === 'store' ? receiptBlock(p) : ''}
    ${busy ? '' : `
      ${k !== 'travel' ? `<input type="text" class="part-title" data-pf="title" value="${esc(p.title)}" placeholder="${t('placePh_' + k)}" list="place-${k}">
        <datalist id="place-${k}">${[...new Set(state.expenses.filter((e) => kindOf(e) === k).map((e) => e.title).filter(Boolean))].slice(0, 30).map((x) => `<option value="${esc(x)}">`).join('')}</datalist>` : ''}
      <div class="items">${p.items.map(itemRow).join('')}</div>
      <div class="btn-row">
        ${k === 'travel' ? `<button type="button" class="btn btn-ghost sm" data-action="add-item" data-name="${esc(t('rideThere'))}">${t('quickRide')} ${esc(t('rideThere'))}</button>
          <button type="button" class="btn btn-ghost sm" data-action="add-item" data-name="${esc(t('rideBack'))}">${t('quickRide')} ${esc(t('rideBack'))}</button>` : ''}
        <button type="button" class="btn btn-ghost sm" data-action="add-item">${k === 'travel' ? t('addRideItem') : t('addItem')}</button>
      </div>
      <div data-pwarn>${warn}</div>`}
  </div>`;
}
function partSumHtml(p) {
  const s = partShares(p);
  return `<span class="dot dot-b"></span>${money(s.b)} · <span class="dot dot-a"></span>${money(s.a)}`;
}

function itemRow(it, i) {
  return `<div class="item-row owner-${it.owner}" data-i="${i}">
    <button type="button" class="owner-tag tag-${it.owner}" data-action="toggle-owner">${esc(nameOf(it.owner))}</button>
    <input type="text" data-item="name" value="${esc(it.name)}" placeholder="${t('itemName')}">
    <input type="number" inputmode="decimal" step="0.01" data-item="price" value="${esc(it.price)}" placeholder="${t('price')}">
    <button type="button" class="icon-btn danger" data-action="del-item" aria-label="${t('delete')}">✕</button>
  </div>`;
}

function slipSrc(p) { return p.slipPreview || (!p.removeOldSlip && p._slipUrl) || null; }
function hasSlip(p) { return !!(p.slipPreview || (p.slip_path && !p.removeOldSlip)); }

function ocrStatusHtml(p) {
  const o = p.ocr;
  if (!o) return '';
  if (o.status === 'queued') return `<div class="ocr-status"><div class="spinner"></div>${t('queued')}</div>`;
  if (o.status === 'loading') return `<div class="ocr-status"><div class="spinner"></div>${t('loadingOcr')}</div>`;
  if (o.status === 'reading') return `<div class="ocr-status"><div class="progress"><div style="width:${o.p}%"></div></div>${t('reading', { p: o.p })}</div>`;
  if (o.status === 'done') return `<div class="ocr-ok">${o.msg}</div>`;
  if (o.status === 'error') return `<div class="ocr-err">${esc(o.msg)}</div>`;
  return '';
}

function receiptBlock(p) {
  const src = slipSrc(p);
  const busy = ocrBusyPart(p);
  return `<div class="receipt-box">
    ${hasSlip(p) ? `<div class="receipt-bar">
        ${src ? `<button type="button" class="btn btn-ghost sm" data-action="toggle-img">🧾 ${p.showImg ? t('hideReceipt') : t('showReceipt')}</button>` : ''}
        ${p.slipFile && !busy ? `<button type="button" class="btn btn-ghost sm" data-action="reread">${t('rereadReceipt')}</button>` : ''}
      </div>` : `<button type="button" class="upload" data-action="add-receipt">${t('uploadReceipt')}</button>`}
    ${src && (p.showImg || busy) ? `<img class="receipt-img ${p.showImg ? '' : 'thumb'}" src="${esc(src)}" alt="receipt">` : ''}
    <div id="ocr-${p.key}">${ocrStatusHtml(p)}</div>
  </div>`;
}

function refreshCard(c) {
  const el = document.getElementById('card-' + c.key);
  if (!el) return;
  el.outerHTML = cardHtml(c, B().cards.indexOf(c));
  refreshBars();
}
/** Light refresh while typing: card / part totals + bars, without re-rendering inputs. */
function refreshTotals(c, p) {
  const cardEl = document.getElementById('card-' + c.key);
  if (cardEl) {
    const s = cardShares(c);
    cardEl.querySelector('.day-sum').innerHTML = `<span class="dot dot-b"></span>${money(s.b)} <span class="dot dot-a"></span>${money(s.a)}`;
    if (p) {
      const pe = cardEl.querySelector(`[data-part="${p.key}"]`);
      pe?.querySelector('[data-psum]') && (pe.querySelector('[data-psum]').innerHTML = partSumHtml(p));
      if (p.kind === 'store' && pe?.querySelector('[data-pwarn]')) {
        const sh = partShares(p), tot = round2(sh.a + sh.b);
        pe.querySelector('[data-pwarn]').innerHTML = p.ocrTotal && Math.abs(p.ocrTotal - tot) > 0.01
          ? `<div class="ocr-err small">⚠️ ${t('totalMismatch', { r: money(p.ocrTotal), s: money(tot) })}</div>` : '';
      }
    }
  }
  refreshBars();
}

/** Sticky running totals (all cards) + save bar. */
function refreshBars() {
  const b = B(); if (!b) return;
  let a = 0, bb = 0, owe = 0, n = 0;
  for (const c of b.cards) {
    const s = cardShares(c);
    if (s.a + s.b) n++;
    a += s.a; bb += s.b;
    owe += c.payer === 'a' ? s.b : -s.a;
  }
  const busy = b.cards.some((c) => c.parts.some(ocrBusyPart));
  const live = $('#livebar');
  if (live) live.innerHTML = `
    <div class="live-label">${t('liveTotal', { n: b.cards.length })}</div>
    <div class="live-grid">
      <div class="live-b"><span><span class="dot dot-b"></span>${esc(nameOf('b'))} (B)</span><strong>${money(bb)}</strong></div>
      <div class="live-a"><span><span class="dot dot-a"></span>${esc(nameOf('a'))} (A)</span><strong>${money(a)}</strong></div>
      <div><span>${t('total')}</span><strong>${money(a + bb)}</strong></div>
    </div>
    ${Math.abs(owe) > 0.004 ? `<div class="live-owe">${esc(owe > 0 ? t('owes', { from: nameOf('b'), to: nameOf('a') }) : t('owes', { from: nameOf('a'), to: nameOf('b') }))} <strong>${money(Math.abs(owe))}</strong></div>` : ''}`;
  const bar = $('#savebar');
  if (bar) bar.innerHTML = `
    <button type="button" class="btn btn-ghost" data-action="cancel">${t('cancel')}</button>
    <button type="button" class="btn btn-primary grow" data-action="save-all" ${busy || !n ? 'disabled' : ''}>${busy ? '⏳ ' + t('waitReading') : b.editing ? t('save') : t('saveAll', { n })}</button>`;
}

// ----- OCR queue (one receipt at a time; the others wait) -----
let ocrBusy = false;
function addReceipts(files) {
  const b = B();
  let first = null;
  files.forEach((f, idx) => {
    let card;
    if (idx === 0 && receiptTarget) card = receiptTarget;
    else { card = newCard(); b.cards.push(card); }
    const p = addPart(card, 'store');
    if (p.slipPreview) URL.revokeObjectURL(p.slipPreview);
    Object.assign(p, { slipFile: f, slipPreview: URL.createObjectURL(f), removeOldSlip: false, ocr: { status: 'queued' }, items: [] });
    first ||= card;
  });
  receiptTarget = null;
  viewEditor($('#view'));
  if (first) scrollToCard(first);
  processQueue();
}
async function processQueue() {
  if (ocrBusy) return;
  ocrBusy = true;
  try {
    for (;;) {
      let job = null;
      for (const c of B()?.cards || []) { const p = c.parts.find((x) => x.ocr?.status === 'queued'); if (p) { job = [c, p]; break; } }
      if (!job) break;
      await ocrPart(...job);
    }
  } finally { ocrBusy = false; }
}
/** Names you saved before (+ what OCR read for them) — used to auto-correct new receipts. */
function knownItemNames() {
  const out = [], seen = new Set();
  const add = (key, name) => { const id = key + '\u0000' + name; if (!seen.has(id)) { seen.add(id); out.push({ key, name }); } };
  for (const e of state.expenses) if (kindOf(e) === 'store') for (const i of e.items || []) {
    if (!i.name || i.name.length < 2) continue;
    add(i.name, i.name);
    if (i.ocr) add(i.ocr, i.name);
  }
  return out;
}
async function ocrPart(c, p) {
  const batch = B();
  const setStatus = (o) => {
    p.ocr = o;
    const el = document.getElementById('ocr-' + p.key);
    if (el) el.innerHTML = ocrStatusHtml(p);
  };
  setStatus({ status: 'loading' });
  try {
    const res = await readReceipt(p.slipFile, (m) => {
      if (m.status === 'recognizing text') {
        const pct = Math.round((m.progress || 0) * 100);
        if (p.ocr.status !== 'reading' || pct - p.ocr.p >= 5) setStatus({ status: 'reading', p: pct });
      }
    }, knownItemNames());
    if (res.date) c.date = res.date;
    p.ocrTotal = res.total || null;
    p.items = res.items.map((i) => ({ name: i.name, price: String(i.price), owner: i.owner, ocr: i.rawName }));
    const marked = res.items.filter((i) => i.marked).length;
    if (!p.items.length) {
      p.items = [{ name: '', price: '', owner: 'b' }];
      p.ocr = { status: 'error', msg: t('readNone') };
    } else {
      p.ocr = { status: 'done', msg: t('readDone', { n: p.items.length }) + (marked ? `<br>✏️ ${esc(t('readMarked', { n: marked, name: nameOf('b') }))}` : '') };
    }
  } catch (e) {
    if (!p.items.length) p.items = [{ name: '', price: '', owner: 'b' }];
    p.ocr = { status: 'error', msg: t('error', { msg: e.message }) };
  }
  if (B() === batch) refreshCard(c);
}

async function saveAll() {
  const b = B();
  const jobs = [];
  for (const c of b.cards) for (const p of c.parts) if (validItems(p).length) jobs.push([c, p]);
  if (!jobs.length) return toast(t('errAmount'), true);
  const btn = $('[data-action=save-all]'); btn.disabled = true;
  let done = 0;
  try {
    for (const [c, p] of jobs) {
      btn.textContent = t('savingN', { i: done + 1, n: jobs.length });
      const items = validItems(p).map((i) => {
        const it = { name: i.name.trim() || t('kindShort_' + p.kind), price: round2(i.price), owner: i.owner };
        if (i.ocr && i.ocr !== it.name) it.ocr = i.ocr; // remember OCR text → your fix (auto-correct next time)
        return it;
      });
      let slip_path = p.removeOldSlip ? null : p.slip_path;
      if (p.slipFile) slip_path = await state.store.uploadSlip(p.slipFile);
      if ((p.slipFile || p.removeOldSlip) && p.slip_path && p.slip_path !== slip_path) await state.store.removeSlip(p.slip_path);
      await state.store.saveExpense({
        id: p.id || undefined, created_at: p.created_at, date: c.date, category: p.kind,
        title: (p.title || '').trim() || t('kindShort_' + p.kind), payer: c.payer, split: 'items',
        total: itemsTotal(items), items, slip_path, note: (c.note || '').trim() || null,
      });
      c.parts = c.parts.filter((x) => x !== p); // saved → drop from batch (a retry only saves the rest)
      done++;
    }
    await reload();
    toast(t('savedN', { n: done }));
    state.month = monthOf(jobs[0][0].date);
    go('dashboard');
  } catch (e) {
    b.cards = b.cards.filter((c) => c.parts.length);
    await reload().catch(() => {});
    toast((e.message === 'localStorageFull' ? t('localWarn') : t('error', { msg: e.message })) + (done ? ` (${t('savedN', { n: done })})` : ''), true);
    viewEditor($('#view'));
  }
}

// ---------- history ----------
function viewHistory(v) {
  const q = state.search.trim().toLowerCase();
  const list = state.expenses.filter((e) => monthOf(e.date) === state.month &&
    (!q || `${e.title} ${e.note || ''} ${(e.items || []).map((i) => i.name).join(' ')}`.toLowerCase().includes(q)));
  const groups = {};
  list.forEach((e) => (groups[e.date] ||= []).push(e));
  v.innerHTML = `
    ${monthNav()}
    <input type="search" class="search" data-action="search" placeholder="${t('search')}" value="${esc(state.search)}">
    ${!list.length ? `<div class="empty">${t('noResults')}</div>` :
      Object.entries(groups).map(([date, es]) => {
        const b = es.reduce((s, e) => s + shares(e).b, 0);
        return `<div class="day-head"><span>${fmtDate(date)}</span><span><span class="dot dot-b"></span>${money(b)}</span></div>
        <div class="card list">${es.map(expRow).join('')}</div>`;
      }).join('')}`;
}
function fmtDate(d) {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function expRow(e) {
  const s = shares(e);
  return `<button class="row" data-open="${esc(e.id)}">
    <span class="row-ic">${kindEmoji(kindOf(e))}</span>
    <span class="row-main"><span class="row-title">${esc(e.title)} ${e.slip_path ? '<span title="slip">📎</span>' : ''}</span>
      <span class="row-sub">${new Date(e.date + 'T00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short' })} · ${t('total')} ${money(e.total)}${e.payer === 'b' ? ' · ' + esc(t('whoPaid')) + ' ' + esc(nameOf('b')) : ''}</span></span>
    <span class="row-amt"><strong class="amt-b">${money(s.b)}</strong><span class="row-sub">${esc(nameOf('b'))}</span></span>
  </button>`;
}

async function openExpense(id) {
  const e = state.expenses.find((x) => x.id === id); if (!e) return;
  const s = shares(e);
  showModal(`
    <div class="modal-head"><h3>${kindEmoji(kindOf(e))} ${esc(e.title)}</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
    <div class="muted">${fmtDate(e.date)} · ${esc(t('kind_' + kindOf(e)))} · ${esc(t('whoPaid'))}: ${esc(nameOf(e.payer))}</div>
    <div class="items-view">${(e.items || []).map((i) => `
      <div class="sum-row"><span><span class="owner-tag sm tag-${i.owner}">${i.owner === 'both' ? '½' : esc(nameOf(i.owner))}</span> ${esc(i.name || '—')}</span><span>${money(i.price)}</span></div>`).join('')}</div>
    <div class="sum-grid">
      <div><span class="dot dot-b"></span>${esc(t('sumPartner', { name: nameOf('b') }))}<strong>${money(s.b)}</strong></div>
      <div><span class="dot dot-a"></span>${esc(t('sumMine', { name: nameOf('a') }))}<strong>${money(s.a)}</strong></div>
      <div>${t('total')}<strong>${money(e.total)}</strong></div>
    </div>
    ${e.note ? `<p class="note">📝 ${esc(e.note)}</p>` : ''}
    ${e.slip_path ? `<div id="slip-view" class="slip-view muted">${t('loading')}</div>` : ''}
    <div class="form-actions">
      <button class="btn btn-ghost danger" data-action="del-exp" data-id="${esc(e.id)}">${t('delete')}</button>
      <button class="btn btn-primary" data-action="edit-exp" data-id="${esc(e.id)}">${t('edit')}</button>
    </div>`);
  if (e.slip_path) {
    try {
      const url = await state.store.slipUrl(e.slip_path);
      const box = $('#slip-view');
      if (box) box.innerHTML = `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="slip"></a>`;
    } catch (err) { const box = $('#slip-view'); if (box) box.textContent = t('error', { msg: err.message }); }
  }
}

function addMenu() {
  showModal(`
    <div class="modal-head"><h3>${t('addExpense')}</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
    <div class="add-menu">${KINDS.slice(0, 2).map(([k, e]) => `
      <button class="quick-btn quick-${k} wide" data-action="new" data-kind="${k}">
        <span class="quick-ic">${e}</span><span><span class="quick-title">${t('kind_' + k)}</span><span class="quick-hint">${t('kindHint_' + k)}</span></span>
      </button>`).join('')}</div>`);
}

// ---------- settle ----------
function viewSettle(v) {
  const bal = balance(state.expenses, state.settlements);
  const from = bal < 0 ? 'a' : 'b';
  v.innerHTML = `
    ${balanceCard(false)}
    <section class="card qr-card" id="qr-card"></section>
    <form id="settle-form" class="card form">
      <h3>${t('recordPayment')}</h3>
      <div class="chips">${['b', 'a'].map((p) => `<button type="button" class="chip ${p === from ? 'on' : ''}" data-action="from" data-p="${p}">${esc(nameOf(p))} → ${esc(nameOf(other(p)))}</button>`).join('')}</div>
      <label class="field"><span>${t('amount')} (฿)</span><input type="number" inputmode="decimal" step="0.01" min="0.01" name="amount" class="big-input" value="${Math.abs(bal) >= 0.01 ? Math.abs(bal) : ''}" required></label>
      <label class="field"><span>${t('date')}</span><input type="date" name="date" value="${todayStr()}" required></label>
      <label class="field"><span>${t('note')}</span><input type="text" name="note" placeholder="${t('notePh')}"></label>
      <input type="hidden" name="from_person" value="${from}">
      <button type="submit" class="btn btn-primary block">${t('save')}</button>
    </form>
    <h3 class="section-title">${t('settlements')}</h3>
    ${!state.settlements.length ? `<div class="empty">${t('noSettlements')}</div>` : `<div class="card list">
      ${state.settlements.map((p) => `<div class="row static">
        <span class="row-ic">💸</span>
        <span class="row-main"><span class="row-title">${esc(t('paidTo', { from: nameOf(p.from_person), to: nameOf(other(p.from_person)) }))}</span>
          <span class="row-sub">${fmtDate(p.date)}${p.note ? ' · ' + esc(p.note) : ''}</span></span>
        <span class="row-amt"><strong>${money(p.amount)}</strong>
          <button class="link danger" data-action="del-settle" data-id="${esc(p.id)}">${t('delete')}</button></span>
      </div>`).join('')}</div>`}`;
  updateQr();
}

/** PromptPay QR for the partner to scan (only when the partner pays you). */
let qrSeq = 0;
async function updateQr() {
  const box = $('#qr-card'); if (!box) return;
  const form = $('#settle-form');
  const from = form?.from_person.value;
  const amount = round2(form?.amount.value);
  if (from !== 'b') { box.hidden = true; return; }
  box.hidden = false;
  const id = normalizeId(state.settings.promptpay);
  if (!id) {
    box.innerHTML = `<div class="qr-empty">📱 ${t('qrSetup')}<button class="btn btn-ghost sm" data-nav="settings">${t('qrSetupBtn')}</button></div>`;
    return;
  }
  const seq = ++qrSeq;
  try {
    const svg = await promptPaySvg(id, amount);
    if (seq !== qrSeq) return;
    box.innerHTML = `
      <div class="qr-head"><span class="pp-logo">PP</span>
        <div><strong>${t('qrTitle', { name: nameOf('b') })}</strong><div class="muted small">PromptPay · ${esc(maskId(id))} · ${esc(nameOf('a'))}</div></div></div>
      <div class="qr-img">${svg}</div>
      <div class="qr-amt">${amount > 0 ? money(amount) : t('qrAnyAmount')}</div>
      <p class="muted small center">${t('qrHint')}</p>`;
  } catch (err) {
    box.innerHTML = `<div class="ocr-err">${esc(t('error', { msg: err.message }))}</div>`;
  }
}
const maskId = (id) => id.length === 10 ? `${id.slice(0, 3)}-xxx-${id.slice(-4)}` : `${id.slice(0, 1)}-xxxx-xxxxx-${id.slice(-3)}`;

// ---------- settings ----------
function viewSettings(v) {
  const st = state.store;
  v.innerHTML = `
    <form id="names-form" class="card form">
      <h3>${t('names')}</h3>
      <label class="field"><span><span class="dot dot-a"></span>${t('nameA')}</span><input name="name_a" value="${esc(state.settings.name_a)}" maxlength="20"></label>
      <label class="field"><span><span class="dot dot-b"></span>${t('nameB')}</span><input name="name_b" value="${esc(state.settings.name_b)}" maxlength="20"></label>
      <label class="field"><span>📱 ${t('promptpayLabel')}</span><input name="promptpay" inputmode="numeric" value="${esc(state.settings.promptpay || '')}" placeholder="${t('promptpayPh')}" maxlength="20"></label>
      <button class="btn btn-primary block" type="submit">${t('save')}</button>
    </form>
    <section class="card">
      <h3>${t('language')}</h3>
      <div class="chips">${[['th', '🇹🇭 ไทย'], ['en', '🇬🇧 English']].map(([l, lab]) => `<button class="chip ${getLang() === l ? 'on' : ''}" data-action="set-lang" data-l="${l}">${lab}</button>`).join('')}</div>
    </section>
    <section class="card">
      <h3>${t('dataMode')}</h3>
      <p class="${st.mode === 'local' ? 'warn' : 'ok'}">${st.mode === 'local' ? t('modeLocal') : t('modeCloud')}</p>
      ${st.mode === 'cloud' ? `<p class="muted">${esc(t('signedInAs', { email: state.session?.user?.email || '' }))}</p>
        <button class="btn btn-ghost" data-action="signout">${t('signOut')}</button>` : ''}
    </section>
    <section class="card">
      <h3>${t('backup')}</h3>
      <div class="btn-row">
        <button class="btn btn-ghost" data-action="csv">${t('exportCsv')}</button>
        <button class="btn btn-ghost" data-action="json">${t('exportJson')}</button>
        ${st.mode === 'local' ? `<button class="btn btn-ghost" data-action="import">${t('importJson')}</button>
          <input type="file" id="import-input" accept="application/json" hidden>
          <button class="btn btn-ghost danger" data-action="clear">${t('clearLocal')}</button>` : ''}
      </div>
    </section>
    <p class="muted center small">${t('tagline')}</p>`;
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportCsv() {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const head = ['date', 'type', 'place', 'item', 'price', 'whose', 'paid_by', 'note'];
  const rows = [];
  for (const e of state.expenses) {
    for (const i of e.items?.length ? e.items : [{ name: e.title, price: e.total, owner: 'both' }]) {
      rows.push([e.date, kindOf(e), e.title, i.name, i.price, i.owner === 'both' ? 'both' : nameOf(i.owner), nameOf(e.payer), e.note].map(q).join(','));
    }
  }
  download(`meal-split-${todayStr()}.csv`, '﻿' + [head.map(q).join(','), ...rows].join('\n'), 'text/csv');
}

// ---------- login ----------
function renderLogin() {
  $('#app').innerHTML = `
    <div class="login">
      <div class="login-card card">
        <div class="logo big">🍱</div>
        <h1>${t('appName')}</h1>
        <p class="muted">${t('tagline')}</p>
        <form id="login-form" class="form">
          <label class="field"><span>${t('email')}</span><input type="email" name="email" required autocomplete="email"></label>
          <label class="field"><span>${t('password')}</span><input type="password" name="password" required autocomplete="current-password"></label>
          <button class="btn btn-primary block" type="submit">${t('signIn')}</button>
        </form>
        <button class="lang-btn" data-action="lang">${getLang() === 'th' ? 'English' : 'ภาษาไทย'}</button>
      </div>
    </div>
    <div id="toast" class="toast hidden"></div>`;
}

// ---------- modal & toast ----------
function showModal(html) {
  const m = $('#modal'); m.innerHTML = `<div class="modal-card">${html}</div>`; m.classList.remove('hidden');
}
function closeModal() { const m = $('#modal'); if (m) { m.classList.add('hidden'); m.innerHTML = ''; } }
let toastTimer;
function toast(msg, isErr = false) {
  const el = $('#toast'); if (!el) return alert(msg);
  el.textContent = msg; el.className = 'toast' + (isErr ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

// ---------- events ----------
const updateQrSoon = debounce(updateQr, 250);
const unsaved = () => state.view === 'add' && B()?.cards.some((c) => c.parts.some((p) => validItems(p).length));

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-nav],[data-action],[data-open]');
  if (!el) { if (ev.target.id === 'modal') closeModal(); return; }
  const cardEl = el.closest('.daycard');
  const c = cardEl ? findCard(cardEl.dataset.card) : null;
  const partEl = el.closest('.part');
  const p = c && partEl ? c.parts.find((x) => x.key === partEl.dataset.part) : null;

  if (el.dataset.nav) {
    if (unsaved() && !confirm(t('confirmDiscard'))) return;
    closeModal(); return go(el.dataset.nav);
  }
  if (el.dataset.open) return openExpense(el.dataset.open);

  switch (el.dataset.action) {
    case 'lang': setLang(getLang() === 'th' ? 'en' : 'th'); return state.session ? (renderShell(), render()) : renderLogin();
    case 'set-lang': setLang(el.dataset.l); renderShell(); return render();
    case 'month': state.month = shiftMonth(state.month, +el.dataset.d); return render();
    case 'add-menu': return addMenu();
    case 'new': return openEditor(el.dataset.kind);
    case 'pick-receipts': return pickReceipts(null);
    case 'new-card': {
      const nc = newCard([el.dataset.kind]); B().cards.push(nc); viewEditor($('#view')); return scrollToCard(nc);
    }
    case 'del-card':
      if (cardShares(c).a + cardShares(c).b && !confirm(t('confirmDelete'))) return;
      c.parts.forEach((x) => x.slipPreview && URL.revokeObjectURL(x.slipPreview));
      B().cards = B().cards.filter((x) => x !== c);
      return viewEditor($('#view'));
    case 'add-receipt':
      addPart(c, 'store'); refreshCard(c);
      return pickReceipts(c);
    case 'add-part': {
      const np = addPart(c, el.dataset.kind); refreshCard(c);
      return document.querySelector(`[data-part="${np.key}"] input[data-item=${np.kind === 'travel' ? 'price' : 'name'}]`)?.focus();
    }
    case 'del-part':
      if (validItems(p).length && !confirm(t('confirmDelete'))) return;
      if (p.slipPreview) URL.revokeObjectURL(p.slipPreview);
      c.parts = c.parts.filter((x) => x !== p);
      return refreshCard(c);
    case 'toggle-owner': { const i = +el.closest('.item-row').dataset.i; p.items[i].owner = p.items[i].owner === 'b' ? 'a' : 'b'; return refreshCard(c); }
    case 'payer': c.payer = el.dataset.p; return refreshCard(c);
    case 'add-item': {
      p.items.push({ name: el.dataset.name || '', price: '', owner: p.kind === 'travel' ? 'a' : 'b' });
      refreshCard(c);
      return document.querySelector(`[data-part="${p.key}"] .item-row:last-child input[data-item=${el.dataset.name ? 'price' : 'name'}]`)?.focus();
    }
    case 'del-item': { const i = +el.closest('.item-row').dataset.i; p.items.splice(i, 1); return refreshCard(c); }
    case 'toggle-img': p.showImg = !p.showImg; return refreshCard(c);
    case 'reread': p.ocr = { status: 'queued' }; refreshCard(c); return processQueue();
    case 'save-all': return saveAll();
    case 'cancel':
      if (unsaved() && !confirm(t('confirmDiscard'))) return;
      return go('dashboard');
    case 'close-modal': return closeModal();
    case 'from':
      el.parentElement.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === el));
      $('#settle-form [name=from_person]').value = el.dataset.p; return updateQr();
    case 'edit-exp': {
      const e = state.expenses.find((x) => x.id === el.dataset.id); closeModal();
      return editExpense(e);
    }
    case 'del-exp': {
      if (!confirm(t('confirmDelete'))) return;
      const e = state.expenses.find((x) => x.id === el.dataset.id);
      try { await state.store.deleteExpense(e); await reload(); closeModal(); toast(t('deleted')); render(); }
      catch (err) { toast(t('error', { msg: err.message }), true); }
      return;
    }
    case 'del-settle':
      if (!confirm(t('confirmDelete'))) return;
      try { await state.store.deleteSettlement(el.dataset.id); await reload(); toast(t('deleted')); render(); }
      catch (err) { toast(t('error', { msg: err.message }), true); }
      return;
    case 'signout': await state.store.signOut(); return;
    case 'csv': return exportCsv();
    case 'json': return download(`meal-split-backup-${todayStr()}.json`, JSON.stringify(await state.store.exportAll(), null, 2), 'application/json');
    case 'import': return $('#import-input').click();
    case 'clear': if (confirm(t('confirmClear'))) { await state.store.clear(); await reload(); render(); } return;
  }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.action === 'search') {
    state.search = el.value; const pos = el.selectionStart;
    viewHistory($('#view')); const q = $('.search'); q.focus(); q.setSelectionRange(pos, pos); return;
  }
  if (el.name === 'amount' && el.closest('#settle-form')) return updateQrSoon();
  const cardEl = el.closest('.daycard'); if (!cardEl) return;
  const c = findCard(cardEl.dataset.card); if (!c) return;
  if (el.dataset.cf) { c[el.dataset.cf] = el.value; return; }
  const partEl = el.closest('.part'); if (!partEl) return;
  const p = c.parts.find((x) => x.key === partEl.dataset.part); if (!p) return;
  if (el.dataset.pf) { p[el.dataset.pf] = el.value; return; }
  if (el.dataset.item) { const i = +el.closest('.item-row').dataset.i; p.items[i][el.dataset.item] = el.value; refreshTotals(c, p); }
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.id === 'slip-input' && el.files.length) { const files = [...el.files]; el.value = ''; return addReceipts(files); }
  if (el.id === 'import-input' && el.files[0]) {
    try { await state.store.importAll(JSON.parse(await el.files[0].text())); await reload(); toast(t('imported')); render(); }
    catch (err) { toast(t('error', { msg: err.message }), true); }
  }
});

document.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  if (f.id === 'settle-form') {
    const fd = Object.fromEntries(new FormData(f));
    const amount = round2(fd.amount);
    if (!(amount > 0)) return toast(t('errAmount'), true);
    try {
      await state.store.saveSettlement({ date: fd.date, from_person: fd.from_person, amount, note: fd.note.trim() });
      await reload(); toast(t('settledMsg')); render();
    } catch (err) { toast(t('error', { msg: err.message }), true); }
  }
  if (f.id === 'names-form') {
    const fd = Object.fromEntries(new FormData(f));
    const pp = fd.promptpay.trim();
    if (pp && !normalizeId(pp)) return toast(t('promptpayInvalid'), true);
    const next = { name_a: fd.name_a.trim() || 'A', name_b: fd.name_b.trim() || 'B', promptpay: pp ? normalizeId(pp) : '' };
    try { await state.store.saveSettings(next); state.settings = next; toast(t('saved')); render(); }
    catch (err) { toast(err.message === 'needPromptpayColumn' ? t('promptpayNeedSql') : t('error', { msg: err.message }), true); }
  }
  if (f.id === 'login-form') {
    const fd = Object.fromEntries(new FormData(f));
    try { await state.store.signIn(fd.email, fd.password); }
    catch (err) { toast(t('signInFail', { msg: err.message }), true); }
  }
});

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeModal(); });

boot();
