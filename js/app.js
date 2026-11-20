import { t, getLang, setLang, locale } from './i18n.js';
import { createStore } from './store.js';
import { shares, balance, round2, itemsTotal, todayStr, monthOf, shiftMonth, monthStats } from './calc.js';

const CATS = [
  ['breakfast', '🍳'], ['lunch', '🍛'], ['dinner', '🍜'], ['snack', '🍪'],
  ['drink', '🧋'], ['store', '🏪'], ['other', '📦'],
];
const catEmoji = (c) => (CATS.find((x) => x[0] === c) || CATS[6])[1];

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '฿' + (Number(n) || 0).toLocaleString(locale(), { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const state = {
  store: null, session: null,
  settings: { name_a: '', name_b: '' },
  expenses: [], settlements: [],
  view: 'dashboard', month: monthOf(todayStr()), search: '',
  draft: null, chart: null,
};
const nameOf = (p) => (p === 'a' ? state.settings.name_a || 'A' : state.settings.name_b || 'B');

// ---------- boot ----------
async function boot() {
  setLang(getLang());
  state.store = createStore();
  if (state.store.mode === 'cloud') {
    state.session = await state.store.getSession();
    state.store.sb.auth.onAuthStateChange((_e, session) => {
      const was = !!state.session; state.session = session;
      if (!!session !== was) start();
    });
  } else {
    state.session = await state.store.getSession();
  }
  start();
}

async function start() {
  if (!state.session) return renderLogin();
  renderShell();
  $('#view').innerHTML = `<div class="empty">${t('loading')}</div>`;
  try {
    await reload();
    if (!state.settings.name_a && !state.settings.name_b) {
      state.settings = { name_a: getLang() === 'th' ? 'เรา' : 'Me', name_b: getLang() === 'th' ? 'แฟน' : 'Partner' };
    }
    if (!state.listening) {
      state.listening = true;
      state.store.subscribe(debounce(async () => { await reload(); if (!state.draft) render(); }, 400));
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && !state.draft && state.session) { await reload(); render(); }
      });
    }
  } catch (e) { toast(t('error', { msg: e.message }), true); }
  render();
}

async function reload() {
  const [settings, expenses, settlements] = await Promise.all([
    state.store.getSettings(), state.store.listExpenses(), state.store.listSettlements(),
  ]);
  state.settings = { ...state.settings, ...Object.fromEntries(Object.entries(settings || {}).filter(([, v]) => v)) };
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
      ${[['dashboard', '📊'], ['history', '🧾'], ['add', '＋'], ['settle', '💸'], ['settings', '⚙️']].map(([v, ic]) => `
        <button class="tab ${v === 'add' ? 'tab-add' : ''}" data-nav="${v}">
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
  ({ dashboard: viewDashboard, add: viewForm, history: viewHistory, settle: viewSettle, settings: viewSettings }[state.view])(v);
  window.scrollTo({ top: 0 });
}

function go(view) {
  if (view === 'add') state.draft = newDraft();
  else state.draft = null;
  state.view = view;
  render();
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
  const from = bal > 0 ? 'b' : 'a', to = bal > 0 ? 'a' : 'b';
  return `<section class="card balance">
    <div class="bal-label">${t('balance')}</div>
    <div class="bal-who"><span class="dot dot-${from}"></span>${esc(t('owes', { from: nameOf(from), to: nameOf(to) }))}</div>
    <div class="bal-big">${money(Math.abs(bal))}</div>
    ${withButton ? `<button class="btn btn-light" data-nav="settle">${t('settleNow')} →</button>` : ''}
  </section>`;
}

// ---------- dashboard ----------
function viewDashboard(v) {
  const s = monthStats(state.expenses, state.month);
  const catRows = Object.entries(s.byCat).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...catRows.map((r) => r[1]));
  const places = Object.entries(s.byPlace).sort((a, b) => b[1] - a[1]).slice(0, 5);

  v.innerHTML = `
    ${balanceCard()}
    ${monthNav()}
    ${!s.count ? `<div class="empty">${t('noData')}</div>` : `
    <section class="hero card">
      <div class="muted">${t('totalSpent')}</div>
      <div class="hero-num">${money(s.total)}</div>
      <div class="muted small">${t('daysWithMeals', { n: s.days })}</div>
    </section>
    <section class="grid2">
      ${['a', 'b'].map((p) => `
        <div class="card stat">
          <div class="stat-head"><span class="dot dot-${p}"></span>${esc(t('shareOf', { name: nameOf(p) }))}</div>
          <div class="stat-num">${money(s[p])}</div>
          <div class="muted small">${esc(t('paidBy', { name: nameOf(p) }))} ${money(p === 'a' ? s.paidA : s.paidB)}</div>
        </div>`).join('')}
      <div class="card stat"><div class="stat-head">${t('meals')}</div><div class="stat-num">${s.count}</div></div>
      <div class="card stat"><div class="stat-head">${t('avgPerMeal')}</div><div class="stat-num">${money(s.avgMeal)}</div>
        <div class="muted small">${t('perPerson')} ${money(s.avgMeal / 2)}</div></div>
      <div class="card stat span2"><div class="stat-head">${t('avgPerDay')}</div><div class="stat-num">${money(s.avgDay)}</div>
        <div class="muted small">${t('perPerson')} ${money(s.avgDay / 2)}</div></div>
    </section>`}
    <section class="card">
      <h3>${t('trend6')}</h3>
      <div class="legend">${['a', 'b'].map((p) => `<span><span class="dot dot-${p}"></span>${esc(nameOf(p))}</span>`).join('')}</div>
      <div class="chart-box"><canvas id="trend" aria-label="${t('trend6')}"></canvas></div>
    </section>
    ${catRows.length ? `<section class="card">
      <h3>${t('byCategory')}</h3>
      ${catRows.map(([c, amt]) => `
        <div class="hbar" title="${esc(t('cat_' + c))}: ${money(amt)}">
          <div class="hbar-label">${catEmoji(c)} ${esc(t('cat_' + c))}</div>
          <div class="hbar-track"><div class="hbar-fill" style="width:${(amt / maxCat) * 100}%"></div></div>
          <div class="hbar-val">${money(amt)}</div>
        </div>`).join('')}
    </section>` : ''}
    ${places.length ? `<section class="card">
      <h3>${t('topPlaces')}</h3>
      <ol class="places">${places.map(([p, amt]) => `<li><span>${esc(p)}</span><span>${money(amt)}</span></li>`).join('')}</ol>
    </section>` : ''}`;
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
      datasets: ['a', 'b'].map((p) => ({
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

// ---------- add / edit form ----------
function newDraft() {
  const h = new Date().getHours();
  return {
    id: null, date: todayStr(), title: '', note: '', payer: 'a', split: 'equal', total: '',
    category: h < 10 ? 'breakfast' : h < 15 ? 'lunch' : 'dinner',
    items: [{ name: '', price: '', owner: 'a' }, { name: '', price: '', owner: 'b' }],
    slip_path: null, slipFile: null, slipPreview: null, removeOldSlip: false,
  };
}
function draftFrom(e) {
  return {
    ...e, total: String(e.total ?? ''), slipFile: null, slipPreview: null, removeOldSlip: false,
    items: (e.items && e.items.length) ? e.items.map((i) => ({ ...i, price: String(i.price) })) : [{ name: '', price: '', owner: 'both' }],
  };
}
function draftTotal(d) { return d.split === 'items' ? itemsTotal(d.items) : round2(d.total); }

function chips(field, options, current, extra = '') {
  return `<div class="chips" ${extra}>${options.map(([val, label]) =>
    `<button type="button" class="chip ${val === current ? 'on' : ''}" data-chip="${field}" data-val="${val}">${label}</button>`).join('')}</div>`;
}

function viewForm(v) {
  const d = state.draft || (state.draft = newDraft());
  const people = [['a', esc(nameOf('a'))], ['b', esc(nameOf('b'))]];
  v.innerHTML = `
    <form id="exp-form" class="card form" autocomplete="off">
      <h2>${d.id ? t('editExpense') : t('addExpense')}</h2>
      <label class="field"><span>${t('date')}</span><input type="date" data-f="date" value="${esc(d.date)}" required></label>
      <div class="field"><span>${t('category')}</span>${chips('category', CATS.map(([c, e]) => [c, `${e} ${t('cat_' + c)}`]), d.category, 'data-wrap')}</div>
      <label class="field"><span>${t('title')}</span><input type="text" data-f="title" value="${esc(d.title)}" placeholder="${t('titlePh')}" list="place-list"></label>
      <datalist id="place-list">${[...new Set(state.expenses.map((e) => e.title).filter(Boolean))].slice(0, 30).map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
      <div class="field"><span>${t('whoPaid')}</span>${chips('payer', people, d.payer)}</div>
      <div class="field"><span>${t('splitMode')}</span>${chips('split', [['equal', '½ ' + t('splitEqual')], ['items', '🧾 ' + t('splitItems')]], d.split)}</div>
      ${d.split === 'equal' ? `
        <label class="field"><span>${t('total')} (฿)</span><input type="number" inputmode="decimal" step="0.01" min="0" data-f="total" value="${esc(d.total)}" class="big-input" placeholder="0"></label>
      ` : `
        <div class="field"><span>${t('items')}</span><p class="hint">${t('quickItems')}</p>
          <div id="items">${d.items.map((it, i) => `
            <div class="item-row" data-i="${i}">
              <input type="text" data-item="name" value="${esc(it.name)}" placeholder="${t('itemName')}">
              <input type="number" inputmode="decimal" step="0.01" min="0" data-item="price" value="${esc(it.price)}" placeholder="${t('price')}">
              <div class="owner-chips">${[['a', esc(nameOf('a'))], ['b', esc(nameOf('b'))], ['both', t('both')]].map(([o, l]) =>
                `<button type="button" class="chip sm ${it.owner === o ? 'on' : ''} ${o !== 'both' ? 'chip-' + o : ''}" data-owner="${o}">${l}</button>`).join('')}
                <button type="button" class="icon-btn danger" data-action="del-item" aria-label="${t('delete')}">✕</button>
              </div>
            </div>`).join('')}
          </div>
          <button type="button" class="btn btn-ghost" data-action="add-item">${t('addItem')}</button>
        </div>`}
      <div class="field"><span>${t('slip')}</span>
        <div id="slip-box">${slipBox(d)}</div>
        <input type="file" id="slip-input" accept="image/*" hidden>
      </div>
      <label class="field"><span>${t('note')}</span><input type="text" data-f="note" value="${esc(d.note || '')}" placeholder="${t('notePh')}"></label>
      <div id="summary" class="summary"></div>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" data-action="cancel">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`;
  updateSummary();
}

function slipBox(d) {
  const src = d.slipPreview || (!d.removeOldSlip && d._slipUrl) || null;
  const has = d.slipPreview || (d.slip_path && !d.removeOldSlip);
  if (!has) return `<button type="button" class="upload" data-action="pick-slip">${t('uploadSlip')}</button>`;
  return `<div class="slip-prev">${src ? `<img src="${esc(src)}" alt="slip">` : `<div class="muted">🧾</div>`}
    <div class="slip-actions"><button type="button" class="btn btn-ghost sm" data-action="pick-slip">${t('changeSlip')}</button>
    <button type="button" class="btn btn-ghost sm danger" data-action="remove-slip">${t('removeSlip')}</button></div></div>`;
}

function updateSummary() {
  const d = state.draft; const box = $('#summary'); if (!d || !box) return;
  const tot = draftTotal(d);
  const s = shares({ ...d, total: tot });
  const other = d.payer === 'a' ? 'b' : 'a';
  const owe = s[other];
  box.innerHTML = `
    <div class="sum-row"><span>${t('total')}</span><strong>${money(tot)}</strong></div>
    <div class="sum-row"><span><span class="dot dot-a"></span>${esc(nameOf('a'))}</span><span>${money(s.a)}</span></div>
    <div class="sum-row"><span><span class="dot dot-b"></span>${esc(nameOf('b'))}</span><span>${money(s.b)}</span></div>
    ${owe > 0 ? `<div class="sum-owe">${esc(t('thisMealOwes', { from: nameOf(other), to: nameOf(d.payer), amt: money(owe) }))}</div>` : ''}`;
}

async function saveDraft() {
  const d = state.draft;
  const total = draftTotal(d);
  if (!(total > 0)) return toast(t('errAmount'), true);
  const btn = $('#exp-form button[type=submit]'); btn.disabled = true; btn.textContent = t('saving');
  try {
    let slip_path = d.removeOldSlip ? null : d.slip_path;
    if (d.slipFile) {
      btn.textContent = t('uploading');
      slip_path = await state.store.uploadSlip(d.slipFile);
    }
    if ((d.slipFile || d.removeOldSlip) && d.slip_path && d.slip_path !== slip_path) await state.store.removeSlip(d.slip_path);
    const items = d.split === 'items'
      ? d.items.filter((i) => i.name.trim() || Number(i.price)).map((i) => ({ name: i.name.trim(), price: round2(i.price), owner: i.owner }))
      : [];
    await state.store.saveExpense({
      id: d.id || undefined, created_at: d.created_at, date: d.date, category: d.category,
      title: d.title.trim() || t('cat_' + d.category), payer: d.payer, split: d.split,
      total, items, slip_path, note: (d.note || '').trim() || null,
    });
    await reload();
    toast(t('saved'));
    state.month = monthOf(d.date);
    state.draft = null; state.view = 'history'; render();
  } catch (e) {
    toast(e.message === 'localStorageFull' ? t('localWarn') : t('error', { msg: e.message }), true);
    btn.disabled = false; btn.textContent = t('save');
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
      Object.entries(groups).map(([date, es]) => `
        <div class="day-head"><span>${fmtDate(date)}</span><span>${money(es.reduce((s, e) => s + Number(e.total), 0))}</span></div>
        <div class="card list">${es.map(expRow).join('')}</div>`).join('')}`;
}
function fmtDate(d) {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function expRow(e) {
  const s = shares(e);
  return `<button class="row" data-open="${esc(e.id)}">
    <span class="row-ic">${catEmoji(e.category)}</span>
    <span class="row-main"><span class="row-title">${esc(e.title)} ${e.slip_path ? '<span title="slip">📎</span>' : ''}</span>
      <span class="row-sub"><span class="dot dot-${e.payer}"></span>${esc(t('paidBy', { name: nameOf(e.payer) }))} · ${e.split === 'items' ? t('splitItems') : t('splitEqual')}</span></span>
    <span class="row-amt"><strong>${money(e.total)}</strong><span class="row-sub">${money(s.a)} / ${money(s.b)}</span></span>
  </button>`;
}

async function openExpense(id) {
  const e = state.expenses.find((x) => x.id === id); if (!e) return;
  const s = shares(e);
  showModal(`
    <div class="modal-head"><h3>${catEmoji(e.category)} ${esc(e.title)}</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
    <div class="muted">${fmtDate(e.date)} · ${esc(t('cat_' + e.category))}</div>
    <div class="sum-row big"><span>${t('total')}</span><strong>${money(e.total)}</strong></div>
    <div class="sum-row"><span>${t('whoPaid')}</span><span><span class="dot dot-${e.payer}"></span>${esc(nameOf(e.payer))}</span></div>
    ${e.split === 'items' && e.items?.length ? `<div class="items-view">${e.items.map((i) => `
      <div class="sum-row"><span>${esc(i.name || '—')} <span class="tag ${i.owner !== 'both' ? 'tag-' + i.owner : ''}">${i.owner === 'both' ? t('both') : esc(nameOf(i.owner))}</span></span><span>${money(i.price)}</span></div>`).join('')}</div>` : ''}
    <div class="sum-row"><span><span class="dot dot-a"></span>${esc(nameOf('a'))}</span><span>${money(s.a)}</span></div>
    <div class="sum-row"><span><span class="dot dot-b"></span>${esc(nameOf('b'))}</span><span>${money(s.b)}</span></div>
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

// ---------- settle ----------
function viewSettle(v) {
  const bal = balance(state.expenses, state.settlements);
  const from = bal < 0 ? 'a' : 'b';
  v.innerHTML = `
    ${balanceCard(false)}
    <form id="settle-form" class="card form">
      <h3>${t('recordPayment')}</h3>
      <div class="field"><span>${t('from')} → ${t('to')}</span>
        ${chips('from_person', [['b', `${esc(nameOf('b'))} → ${esc(nameOf('a'))}`], ['a', `${esc(nameOf('a'))} → ${esc(nameOf('b'))}`]], from)}</div>
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
        <span class="row-main"><span class="row-title">${esc(t('paidTo', { from: nameOf(p.from_person), to: nameOf(p.from_person === 'a' ? 'b' : 'a') }))}</span>
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
      ${chips('lang', [['th', '🇹🇭 ไทย'], ['en', '🇬🇧 English']], getLang())}
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
  const head = ['date', 'title', 'category', 'payer', 'split', 'total', `share_${state.settings.name_a}`, `share_${state.settings.name_b}`, 'items', 'note'];
  const rows = state.expenses.map((e) => {
    const s = shares(e);
    return [e.date, e.title, e.category, nameOf(e.payer), e.split, e.total, s.a, s.b,
      (e.items || []).map((i) => `${i.name}:${i.price}:${i.owner}`).join('; '), e.note].map(q).join(',');
  });
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
        <p class="muted small">${t('signInHint')}</p>
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
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-nav],[data-action],[data-chip],[data-owner],[data-open]');
  if (!el) { if (ev.target.id === 'modal') closeModal(); return; }
  const d = state.draft;

  if (el.dataset.nav) { closeModal(); return go(el.dataset.nav); }
  if (el.dataset.open) return openExpense(el.dataset.open);

  if (el.dataset.chip) {
    const f = el.dataset.chip, val = el.dataset.val;
    if (f === 'lang') { setLang(val); renderShell(); return render(); }
    if (f === 'from_person') {
      el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el));
      $('#settle-form [name=from_person]').value = val; return;
    }
    if (!d) return;
    if (f === 'split' && val === 'items' && d.split === 'equal' && Number(d.total) > 0 && !itemsTotal(d.items)) {
      d.items = [{ name: '', price: d.total, owner: 'both' }];
    }
    d[f] = val; return viewForm($('#view'));
  }
  if (el.dataset.owner) {
    const i = +el.closest('.item-row').dataset.i; d.items[i].owner = el.dataset.owner; return viewForm($('#view'));
  }

  switch (el.dataset.action) {
    case 'lang': setLang(getLang() === 'th' ? 'en' : 'th'); return state.session ? (renderShell(), render()) : renderLogin();
    case 'month': state.month = shiftMonth(state.month, +el.dataset.d); return render();
    case 'add-item': d.items.push({ name: '', price: '', owner: 'both' }); viewForm($('#view'));
      return $('#items .item-row:last-child input')?.focus();
    case 'del-item': { const i = +el.closest('.item-row').dataset.i; d.items.splice(i, 1);
      if (!d.items.length) d.items.push({ name: '', price: '', owner: 'both' }); return viewForm($('#view')); }
    case 'pick-slip': return $('#slip-input').click();
    case 'remove-slip': d.slipFile = null; d.slipPreview = null; d.removeOldSlip = true; $('#slip-box').innerHTML = slipBox(d); return;
    case 'cancel': state.draft = null; state.view = 'history'; return render();
    case 'close-modal': return closeModal();
    case 'edit-exp': {
      const e = state.expenses.find((x) => x.id === el.dataset.id); closeModal();
      state.draft = draftFrom(e); state.view = 'add'; render();
      if (e.slip_path) state.store.slipUrl(e.slip_path).then((u) => { if (state.draft?.id === e.id) { state.draft._slipUrl = u; $('#slip-box').innerHTML = slipBox(state.draft); } }).catch(() => {});
      return;
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
  const el = ev.target, d = state.draft;
  if (el.dataset.action === 'search') {
    state.search = el.value; const pos = el.selectionStart;
    viewHistory($('#view')); const s = $('.search'); s.focus(); s.setSelectionRange(pos, pos); return;
  }
  if (!d) return;
  if (el.dataset.f) { d[el.dataset.f] = el.value; return updateSummary(); }
  if (el.dataset.item) { const i = +el.closest('.item-row').dataset.i; d.items[i][el.dataset.item] = el.value; updateSummary(); }
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.id === 'slip-input' && el.files[0]) {
    const d = state.draft; d.slipFile = el.files[0];
    if (d.slipPreview) URL.revokeObjectURL(d.slipPreview);
    d.slipPreview = URL.createObjectURL(el.files[0]);
    $('#slip-box').innerHTML = slipBox(d);
  }
  if (el.id === 'import-input' && el.files[0]) {
    try { await state.store.importAll(JSON.parse(await el.files[0].text())); await reload(); toast(t('imported')); render(); }
    catch (err) { toast(t('error', { msg: err.message }), true); }
  }
});

document.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  if (f.id === 'exp-form') return saveDraft();
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
