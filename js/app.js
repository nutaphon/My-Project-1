import { t, getLang, setLang, locale } from './i18n.js';
import { createStore } from './store.js';
import { readReceipt } from './receipt.js';
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
  state.settings = { name_a: settings?.name_a || (th ? 'เรา' : 'Me'), name_b: settings?.name_b || (th ? 'แฟน' : 'Partner') };
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
  return `<section class="quick">${KINDS.map(([k, e]) => `
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

// ---------- editor: a batch of entries (many 7-11 receipts + eating out + rides), saved together ----------
let keySeq = 0;
function newSection(kind) {
  return {
    key: 's' + (++keySeq), kind, id: null, date: todayStr(), title: kind === 'store' ? '7-Eleven' : '', note: '', payer: 'a',
    items: kind === 'travel' ? [{ name: t('rideThere'), price: '', owner: 'a' }]
      : kind === 'food' ? [{ name: '', price: '', owner: 'b' }] : [],
    slip_path: null, slipFile: null, slipPreview: null, _slipUrl: null, removeOldSlip: false,
    ocr: null, ocrTotal: null, showImg: false,
  };
}
function sectionFrom(e) {
  const kind = kindOf(e);
  let items = (e.items && e.items.length) ? e.items.map((i) => ({ ...i, price: String(i.price) })) : [];
  if (!items.length) { // older 50/50 entries → show as two halves
    const s = shares(e);
    items = [{ name: e.title, price: String(s.a), owner: 'a' }, { name: e.title, price: String(s.b), owner: 'b' }];
  }
  return { ...newSection(kind), ...e, kind, items, note: e.note || '', slipFile: null, slipPreview: null, removeOldSlip: false };
}
const B = () => state.batch;
const secByKey = (k) => B()?.sections.find((s) => s.key === k);
const ofKind = (k) => B().sections.filter((s) => s.kind === k);
const validItems = (s) => s.items.filter((i) => Number(i.price));
const secShares = (s) => shares({ split: 'items', items: validItems(s).map((i) => ({ ...i, price: Number(i.price) })) });

function openEditor(kind) {
  closeModal();
  state.batch = { tab: kind, sections: kind === 'store' ? [] : [newSection(kind)], editing: false };
  state.view = 'add'; render(); window.scrollTo({ top: 0 });
  if (kind === 'store') $('#slip-input')?.click();
}
function editExpense(e) {
  const s = sectionFrom(e);
  state.batch = { tab: s.kind, sections: [s], editing: true };
  state.view = 'add'; render(); window.scrollTo({ top: 0 });
  if (e.slip_path) state.store.slipUrl(e.slip_path).then((u) => { s._slipUrl = u; refreshSection(s); }).catch(() => {});
}

function viewEditor(v) {
  const b = B() || (state.batch = { tab: 'store', sections: [], editing: false });
  const k = b.tab;
  const mine = ofKind(k);
  const others = b.sections.filter((s) => s.kind !== k);
  v.innerHTML = `
    <div class="editor">
      <div class="kind-tabs sticky-tabs">${KINDS.map(([kk, e]) => {
        const n = ofKind(kk).length;
        return `<button type="button" class="kind-tab ${kk === k ? 'on' : ''}" data-action="tab" data-kind="${kk}">${e} ${t('kindShort_' + kk)}${n ? ` <span class="badge">${n}</span>` : ''}</button>`;
      }).join('')}</div>
      ${k === 'store' && !mine.length ? `
        <div class="card form">
          <button type="button" class="upload big" data-action="pick-slips">${t('uploadReceipts')}</button>
          <p class="hint">💡 ${t('uploadHint')}</p>
          <button type="button" class="link center" data-action="add-section" data-kind="store">${t('orTypeManually')}</button>
        </div>` : ''}
      ${mine.map((s, i) => sectionCard(s, i, mine.length)).join('')}
      ${mine.length && !b.editing ? `<button type="button" class="btn btn-ghost block add-more" data-action="${k === 'store' ? 'pick-slips' : 'add-section'}" data-kind="${k}">${t('addMore_' + k)}</button>` : ''}
      ${others.length ? `<div class="others">
        <div class="others-title">${t('alsoInBatch')}</div>
        ${others.map((s) => {
          const sh = secShares(s);
          return `<button type="button" class="other-row" data-action="tab" data-kind="${s.kind}" data-scroll="${s.key}">
            <span class="row-ic">${kindEmoji(s.kind)}</span>
            <span class="row-main"><span class="row-title">${esc(t('fromKind', { kind: t('kindShort_' + s.kind) }))} · ${esc(s.title || t('kindShort_' + s.kind))}</span>
              <span class="row-sub">${shortDate(s.date)} · ${validItems(s).length} ${t('itemsUnit')}${s.ocr && s.ocr.status !== 'done' && s.ocr.status !== 'error' ? ' · ⏳' : ''}</span></span>
            <span class="row-amt"><strong>${money(sh.b)}</strong><span class="row-sub">${esc(nameOf('b'))}</span></span>
          </button>`;
        }).join('')}
      </div>` : ''}
      <input type="file" id="slip-input" accept="image/*" multiple hidden>
      <input type="file" id="photo-input" accept="image/*" hidden>
    </div>
    <div class="savebar" id="savebar"></div>`;
  refreshBar();
}

const shortDate = (d) => new Date(d + 'T00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short' });

function sectionCard(s, i, n) {
  const k = s.kind;
  const busy = s.ocr && (s.ocr.status === 'queued' || s.ocr.status === 'loading' || s.ocr.status === 'reading');
  return `<section class="card form section owner-scope" data-key="${s.key}" id="sec-${s.key}">
    <div class="section-head">
      <strong>${kindEmoji(k)} ${k === 'store' ? t('receiptNo', { n: i + 1 }) : esc(t('kindShort_' + k))}${n > 1 && k !== 'store' ? ` #${i + 1}` : ''}</strong>
      ${B().editing ? '' : `<button type="button" class="icon-btn danger" data-action="del-section" aria-label="${t('delete')}">✕</button>`}
    </div>
    ${k === 'store' ? receiptBlock(s) : ''}
    ${busy ? '' : `
      <div class="row2">
        <label class="field"><span>${t('date')}</span><input type="date" data-f="date" value="${esc(s.date)}" required></label>
        <label class="field"><span>${t('place')}</span><input type="text" data-f="title" value="${esc(s.title)}" placeholder="${t('placePh_' + k)}" list="place-${k}"></label>
      </div>
      <datalist id="place-${k}">${[...new Set(state.expenses.filter((e) => kindOf(e) === k).map((e) => e.title).filter(Boolean))].slice(0, 30).map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
      <div class="field">
        <span>${t('items')} <span class="hint-inline">· ${t('tapToToggle')}</span></span>
        <div class="items">${s.items.map(itemRow).join('')}</div>
        <div class="btn-row">
          ${k === 'travel' ? `<button type="button" class="btn btn-ghost sm" data-action="add-item" data-name="${esc(t('rideThere'))}">${t('quickRide')} ${esc(t('rideThere'))}</button>
            <button type="button" class="btn btn-ghost sm" data-action="add-item" data-name="${esc(t('rideBack'))}">${t('quickRide')} ${esc(t('rideBack'))}</button>` : ''}
          <button type="button" class="btn btn-ghost sm" data-action="add-item">${t('addItem')}</button>
        </div>
      </div>
      ${k !== 'store' ? `<div class="field">${photoBlock(s)}</div>` : ''}
      <details class="more" ${s.note || s.payer === 'b' ? 'open' : ''}>
        <summary>${t('moreOptions')}</summary>
        <label class="field"><span>${t('note')}</span><input type="text" data-f="note" value="${esc(s.note || '')}" placeholder="${t('notePh')}"></label>
        <div class="field"><span>${t('whoPaid')}</span>
          <div class="chips">${['a', 'b'].map((p) => `<button type="button" class="chip sm ${s.payer === p ? 'on' : ''}" data-action="payer" data-p="${p}">${esc(nameOf(p))}</button>`).join('')}</div>
        </div>
      </details>
      <div class="summary" data-summary>${summaryHtml(s)}</div>`}
  </section>`;
}

function itemRow(it, i) {
  return `<div class="item-row owner-${it.owner}" data-i="${i}">
    <button type="button" class="owner-tag tag-${it.owner}" data-action="toggle-owner">${esc(nameOf(it.owner))}</button>
    <input type="text" data-item="name" value="${esc(it.name)}" placeholder="${t('itemName')}">
    <input type="number" inputmode="decimal" step="0.01" data-item="price" value="${esc(it.price)}" placeholder="${t('price')}">
    <button type="button" class="icon-btn danger" data-action="del-item" aria-label="${t('delete')}">✕</button>
  </div>`;
}

function slipSrc(s) { return s.slipPreview || (!s.removeOldSlip && s._slipUrl) || null; }
function hasSlip(s) { return !!(s.slipPreview || (s.slip_path && !s.removeOldSlip)); }

function ocrStatusHtml(s) {
  const o = s.ocr;
  if (!o) return '';
  if (o.status === 'queued') return `<div class="ocr-status"><div class="spinner"></div>${t('queued')}</div>`;
  if (o.status === 'loading') return `<div class="ocr-status"><div class="spinner"></div>${t('loadingOcr')}</div>`;
  if (o.status === 'reading') return `<div class="ocr-status"><div class="progress"><div style="width:${o.p}%"></div></div>${t('reading', { p: o.p })}</div>`;
  if (o.status === 'done') return `<div class="ocr-ok">${o.msg}</div>`;
  if (o.status === 'error') return `<div class="ocr-err">${esc(o.msg)}</div>`;
  return '';
}

function receiptBlock(s) {
  const src = slipSrc(s);
  return `<div class="receipt-box">
    ${hasSlip(s) ? `<div class="receipt-bar">
        ${src ? `<button type="button" class="btn btn-ghost sm" data-action="toggle-img">🧾 ${s.showImg ? t('hideReceipt') : t('showReceipt')}</button>` : ''}
        ${s.slipFile && s.ocr?.status !== 'reading' && s.ocr?.status !== 'loading' ? `<button type="button" class="btn btn-ghost sm" data-action="reread">${t('rereadReceipt')}</button>` : ''}
      </div>` : ''}
    ${(s.showImg || (src && s.ocr && s.ocr.status !== 'done' && s.ocr.status !== 'error')) && src ? `<img class="receipt-img ${s.showImg ? '' : 'thumb'}" src="${esc(src)}" alt="receipt">` : ''}
    <div id="ocr-${s.key}">${ocrStatusHtml(s)}</div>
  </div>`;
}

function photoBlock(s) {
  if (!hasSlip(s)) return `<button type="button" class="upload" data-action="pick-photo">${t('attachPhoto')}</button>`;
  const src = slipSrc(s);
  return `<div class="slip-prev">${src ? `<img src="${esc(src)}" alt="photo">` : '<div class="muted">🧾</div>'}
    <div class="slip-actions"><button type="button" class="btn btn-ghost sm" data-action="pick-photo">${t('changePhoto')}</button>
    <button type="button" class="btn btn-ghost sm danger" data-action="remove-photo">${t('removePhoto')}</button></div></div>`;
}

function summaryHtml(s) {
  const sh = secShares(s);
  const tot = round2(sh.a + sh.b);
  const debtor = other(s.payer);
  const owe = sh[debtor];
  const warn = s.ocrTotal && Math.abs(s.ocrTotal - tot) > 0.01
    ? `<div class="ocr-err small">⚠️ ${t('totalMismatch', { r: money(s.ocrTotal), s: money(tot) })}</div>` : '';
  return `<div class="sum-grid">
      <div><span><span class="dot dot-b"></span>${esc(t('sumPartner', { name: nameOf('b') }))}</span><strong>${money(sh.b)}</strong></div>
      <div><span><span class="dot dot-a"></span>${esc(t('sumMine', { name: nameOf('a') }))}</span><strong>${money(sh.a)}</strong></div>
      <div><span>${t('total')}</span><strong>${money(tot)}</strong></div>
    </div>
    ${owe > 0 ? `<div class="sum-owe">${esc(t('thisOwes', { from: nameOf(debtor), to: nameOf(s.payer), amt: money(owe) }))}</div>` : ''}
    ${warn}`;
}

function refreshSection(s) {
  const el = document.getElementById('sec-' + s.key);
  if (!el) return;
  const list = ofKind(s.kind);
  el.outerHTML = sectionCard(s, list.indexOf(s), list.length);
  refreshBar();
}
function refreshSummary(s) {
  const el = document.querySelector(`#sec-${s.key} [data-summary]`);
  if (el) el.innerHTML = summaryHtml(s);
  refreshBar();
}
function refreshBar() {
  const bar = $('#savebar'); if (!bar || !B()) return;
  const secs = B().sections.filter((s) => validItems(s).length);
  let owe = 0;
  for (const s of secs) { const sh = secShares(s); owe += s.payer === 'a' ? sh.b : -sh.a; }
  const busy = B().sections.some((s) => s.ocr && ['queued', 'loading', 'reading'].includes(s.ocr.status));
  bar.innerHTML = `
    <div class="savebar-info"><span>${t('batchCount', { n: secs.length })}</span>
      <strong>${owe >= 0 ? `${esc(nameOf('b'))} → ${esc(nameOf('a'))}` : `${esc(nameOf('a'))} → ${esc(nameOf('b'))}`} ${money(Math.abs(owe))}</strong></div>
    <button type="button" class="btn btn-ghost" data-action="cancel">${t('cancel')}</button>
    <button type="button" class="btn btn-primary" data-action="save-all" ${busy || !secs.length ? 'disabled' : ''}>${busy ? '⏳' : ''} ${B().editing ? t('save') : t('saveAll', { n: secs.length })}</button>`;
  // keep tab badges in sync
  document.querySelectorAll('.kind-tab').forEach((el) => {
    const n = ofKind(el.dataset.kind).length;
    let badge = el.querySelector('.badge');
    if (n && !badge) { badge = document.createElement('span'); badge.className = 'badge'; el.append(' ', badge); }
    if (badge) { if (n) badge.textContent = n; else badge.remove(); }
  });
}

// ----- OCR queue (one receipt at a time; the others wait) -----
let ocrBusy = false;
function addReceipts(files) {
  const b = B();
  const added = [...files].map((f) => {
    const s = newSection('store');
    s.slipFile = f; s.slipPreview = URL.createObjectURL(f); s.ocr = { status: 'queued' };
    b.sections.push(s);
    return s;
  });
  b.tab = 'store';
  viewEditor($('#view'));
  document.getElementById('sec-' + added[0].key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  processQueue();
}
async function processQueue() {
  if (ocrBusy) return;
  ocrBusy = true;
  try {
    for (;;) {
      const s = B()?.sections.find((x) => x.ocr?.status === 'queued');
      if (!s) break;
      await ocrSection(s);
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
async function ocrSection(s) {
  const batch = B();
  const setStatus = (o) => {
    s.ocr = o;
    const el = document.getElementById('ocr-' + s.key);
    if (el) el.innerHTML = ocrStatusHtml(s); else if (B() === batch && batch.tab === 'store') refreshSection(s);
  };
  setStatus({ status: 'loading' });
  try {
    const res = await readReceipt(s.slipFile, (m) => {
      if (m.status === 'recognizing text') {
        const p = Math.round((m.progress || 0) * 100);
        if (s.ocr.status !== 'reading' || p - s.ocr.p >= 5) setStatus({ status: 'reading', p });
      }
    }, knownItemNames());
    if (res.date) s.date = res.date;
    s.ocrTotal = res.total || null;
    s.items = res.items.map((i) => ({ name: i.name, price: String(i.price), owner: i.owner, ocr: i.rawName }));
    const marked = res.items.filter((i) => i.marked).length;
    if (!s.items.length) {
      s.items = [{ name: '', price: '', owner: 'b' }];
      s.ocr = { status: 'error', msg: t('readNone') };
    } else {
      s.ocr = { status: 'done', msg: t('readDone', { n: s.items.length }) + (marked ? `<br>✏️ ${esc(t('readMarked', { n: marked, name: nameOf('b') }))}` : '') };
    }
  } catch (e) {
    if (!s.items.length) s.items = [{ name: '', price: '', owner: 'b' }];
    s.ocr = { status: 'error', msg: t('error', { msg: e.message }) };
  }
  if (B() !== batch) return;
  if (batch.tab === 'store') refreshSection(s); else viewEditor($('#view'));
}

async function saveAll() {
  const b = B();
  const secs = b.sections.filter((s) => validItems(s).length);
  for (const s of secs) {
    const items = validItems(s);
    if (!(itemsTotal(items.map((i) => ({ price: Number(i.price) }))) > 0)) {
      document.getElementById('sec-' + s.key)?.scrollIntoView({ behavior: 'smooth' });
      return toast(t('errAmount'), true);
    }
  }
  if (!secs.length) return toast(t('errAmount'), true);
  const btn = $('[data-action=save-all]'); btn.disabled = true;
  let done = 0;
  try {
    for (const s of secs) {
      btn.textContent = t('savingN', { i: done + 1, n: secs.length });
      const items = validItems(s).map((i) => {
        const it = { name: i.name.trim() || t('kindShort_' + s.kind), price: round2(i.price), owner: i.owner };
        if (i.ocr && i.ocr !== it.name) it.ocr = i.ocr; // remember OCR text → your fix (auto-correct next time)
        return it;
      });
      let slip_path = s.removeOldSlip ? null : s.slip_path;
      if (s.slipFile) slip_path = await state.store.uploadSlip(s.slipFile);
      if ((s.slipFile || s.removeOldSlip) && s.slip_path && s.slip_path !== slip_path) await state.store.removeSlip(s.slip_path);
      await state.store.saveExpense({
        id: s.id || undefined, created_at: s.created_at, date: s.date, category: s.kind,
        title: s.title.trim() || t('kindShort_' + s.kind), payer: s.payer, split: 'items',
        total: itemsTotal(items), items, slip_path, note: (s.note || '').trim() || null,
      });
      b.sections = b.sections.filter((x) => x !== s); // saved → remove from batch (safe to retry the rest)
      done++;
    }
    await reload();
    toast(t('savedN', { n: done }));
    state.month = monthOf(secs[0].date);
    go('dashboard');
  } catch (e) {
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
    <div class="add-menu">${KINDS.map(([k, e]) => `
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
}

// ---------- settings ----------
function viewSettings(v) {
  const st = state.store;
  v.innerHTML = `
    <form id="names-form" class="card form">
      <h3>${t('names')}</h3>
      <label class="field"><span><span class="dot dot-a"></span>${t('nameA')}</span><input name="name_a" value="${esc(state.settings.name_a)}" maxlength="20"></label>
      <label class="field"><span><span class="dot dot-b"></span>${t('nameB')}</span><input name="name_b" value="${esc(state.settings.name_b)}" maxlength="20"></label>
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
let photoTarget = null;

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-nav],[data-action],[data-open]');
  if (!el) { if (ev.target.id === 'modal') closeModal(); return; }
  const secEl = el.closest('.section');
  const s = secEl ? secByKey(secEl.dataset.key) : null;

  if (el.dataset.nav) {
    if (state.view === 'add' && B()?.sections.some((x) => validItems(x).length) && !confirm(t('confirmDiscard'))) return;
    closeModal(); return go(el.dataset.nav);
  }
  if (el.dataset.open) return openExpense(el.dataset.open);

  switch (el.dataset.action) {
    case 'lang': setLang(getLang() === 'th' ? 'en' : 'th'); return state.session ? (renderShell(), render()) : renderLogin();
    case 'set-lang': setLang(el.dataset.l); renderShell(); return render();
    case 'month': state.month = shiftMonth(state.month, +el.dataset.d); return render();
    case 'add-menu':
      if (state.view === 'add') return; // already in the editor — use the tabs
      return addMenu();
    case 'new': return openEditor(el.dataset.kind);
    case 'tab': {
      const k = el.dataset.kind, b = B();
      b.tab = k;
      if (k !== 'store' && !ofKind(k).length && !b.editing) b.sections.push(newSection(k));
      viewEditor($('#view'));
      const target = el.dataset.scroll ? document.getElementById('sec-' + el.dataset.scroll) : null;
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); else window.scrollTo({ top: 0 });
      return;
    }
    case 'pick-slips': return $('#slip-input').click();
    case 'add-section': {
      const ns = newSection(el.dataset.kind); B().sections.push(ns); viewEditor($('#view'));
      document.getElementById('sec-' + ns.key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    case 'del-section':
      if (validItems(s).length && !confirm(t('confirmDelete'))) return;
      B().sections = B().sections.filter((x) => x !== s);
      if (s.slipPreview) URL.revokeObjectURL(s.slipPreview);
      return viewEditor($('#view'));
    case 'toggle-owner': { const i = +el.closest('.item-row').dataset.i; s.items[i].owner = s.items[i].owner === 'b' ? 'a' : 'b'; return refreshSection(s); }
    case 'payer': s.payer = el.dataset.p; return refreshSection(s);
    case 'add-item': {
      s.items.push({ name: el.dataset.name || '', price: '', owner: s.kind === 'travel' ? 'a' : 'b' });
      refreshSection(s);
      return document.querySelector(`#sec-${s.key} .item-row:last-child input[data-item=${el.dataset.name ? 'price' : 'name'}]`)?.focus();
    }
    case 'del-item': { const i = +el.closest('.item-row').dataset.i; s.items.splice(i, 1); return refreshSection(s); }
    case 'toggle-img': s.showImg = !s.showImg; return refreshSection(s);
    case 'reread': s.ocr = { status: 'queued' }; refreshSection(s); return processQueue();
    case 'pick-photo': photoTarget = s; return $('#photo-input').click();
    case 'remove-photo': s.slipFile = null; s.slipPreview = null; s.removeOldSlip = true; return refreshSection(s);
    case 'save-all': return saveAll();
    case 'cancel':
      if (B()?.sections.some((x) => validItems(x).length) && !confirm(t('confirmDiscard'))) return;
      return go('dashboard');
    case 'close-modal': return closeModal();
    case 'from':
      el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el));
      $('#settle-form [name=from_person]').value = el.dataset.p; return;
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
  const secEl = el.closest('.section'); if (!secEl) return;
  const s = secByKey(secEl.dataset.key); if (!s) return;
  if (el.dataset.f) { s[el.dataset.f] = el.value; return refreshSummary(s); }
  if (el.dataset.item) { const i = +el.closest('.item-row').dataset.i; s.items[i][el.dataset.item] = el.value; refreshSummary(s); }
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.id === 'slip-input' && el.files.length) { const files = [...el.files]; el.value = ''; return addReceipts(files); }
  if (el.id === 'photo-input' && el.files[0] && photoTarget) {
    const s = photoTarget; photoTarget = null;
    if (s.slipPreview) URL.revokeObjectURL(s.slipPreview);
    s.slipFile = el.files[0]; s.slipPreview = URL.createObjectURL(el.files[0]); s.removeOldSlip = false; el.value = '';
    return refreshSection(s);
  }
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
    state.settings = { name_a: fd.name_a.trim() || 'A', name_b: fd.name_b.trim() || 'B' };
    try { await state.store.saveSettings(state.settings); toast(t('saved')); render(); }
    catch (err) { toast(t('error', { msg: err.message }), true); }
  }
  if (f.id === 'login-form') {
    const fd = Object.fromEntries(new FormData(f));
    try { await state.store.signIn(fd.email, fd.password); }
    catch (err) { toast(t('signInFail', { msg: err.message }), true); }
  }
});

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeModal(); });

boot();
