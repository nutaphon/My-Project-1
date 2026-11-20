// Receipt reading: OCR (Tesseract.js, runs in the browser — free, no API key)
// + detection of coloured marks (red dot / underline / highlight) on item lines.

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

// ---------- pure parsing (no DOM; unit-testable) ----------
// price at end of line; tolerate OCR noise: "9.00N", "@.00ผ", "Q.00N", Thai digits
const D = '[\\d๐-๙@QOoดค]';
const PRICE_RE = new RegExp(`(-?\\s?${D}{1,3}(?:,\\d{3})*[.,]${D}{2})\\s*-?\\s*(?:[A-Za-zก-ฮะ-ฺเ-ํ*'"\\])|.]{0,3})?\\s*$`);
// lines that are never products (payment, totals, 7-11 promos/missions/stamps)
const SKIP_RE = /(ยอด|รวม|สุทธิ|สูทธิ|ทั้งสิ้น|total|ทอน|เงินสด|cash|change|vat|ภาษี|true|ทรู|ทร[ูุ]?ว|วอล|wallet|money|บัตร|card|ชำระ|แต้ม|point|รับเงิน|คงเหลือ|balance|tax|มูลค่า|amount|qr|promptpay|พร้อมเพย์|ref|เลขที่|tid|pos|tel|โทร|ภารกิ|ารกิ|ช[้็]?[อo]ป|ซ[้็]?[อo]ป|ครบ|สิทธิ|สิทธ|ทรธ|แลก|stamp|amb|คืน|cashback|\(บาท|บาท\)|7app|7-?app|all ?member)/i;
const TOTAL_RE = /(ยอด|สุทธิ|สูทธิ|ทั้งสิ้น|รวม|net|grand ?total|total)/i;
const DISCOUNT_RE = /(ส่วนลด|discount|คูปอง|coupon)/i;
const TH_MONTHS = ['ม.ค', 'ก.พ', 'มี.ค', 'เม.ย', 'พ.ค', 'มิ.ย', 'ก.ค', 'ส.ค', 'ก.ย', 'ต.ค', 'พ.ย', 'ธ.ค'];

const thaiDigits = (s) => s.replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 0x0E50));
const toNum = (s) => Number(thaiDigits(String(s)).replace(/[@QOoดค]/g, '0').replace(/\s/g, '').replace(/,(?=\d{3})/g, '').replace(',', '.'));
const pad = (n) => String(n).padStart(2, '0');

/** Fix common Thai OCR artefacts (nikhahit + sara aa → sara am, doubled marks, etc.) */
export function normThai(s) {
  return s.normalize('NFC')
    .replace(/ํา/g, 'ำ')               // ํา → ำ
    .replace(/([่-๋])ํ/g, 'ํ$1')   // tone before nikhahit
    .replace(/าํ/g, 'ำ')
    .replace(/([ั-ฺ็-๎])\1+/g, '$1'); // doubled vowel/tone marks
}

function normYear(y) {
  y = Number(y);
  if (y < 100) y = y >= 60 ? 2500 + y : 2000 + y; // 2-digit: 69 → 2569 (BE), 25 → 2025
  if (y > 2400) y -= 543;                         // Buddhist Era → CE
  return y;
}

export function parseDate(text) {
  text = thaiDigits(text);
  let m = text.match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})/);
  if (m) {
    const d = +m[1], mo = +m[2], y = normYear(m[3]);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  const flat = text.replace(/\s/g, '');
  for (let i = 0; i < 12; i++) {
    const re = new RegExp(`(\\d{1,2})${TH_MONTHS[i].replace(/\./g, '\\.')}\\.?(\\d{2,4})`);
    m = flat.match(re);
    if (m) return `${normYear(m[2])}-${pad(i + 1)}-${pad(+m[1])}`;
  }
  return null;
}

function cleanName(s) {
  return normThai(s)
    .replace(/^[\s๐-๙•·*°]+(?=\S)/, '')            // stray marks read as Thai digits / bullets
    .replace(/^\s*\d+\s*[xX×@]?\s+/, '')          // leading qty "1 " / "2 x "
    .replace(/\s+\d+\s*[@xX×]\s*\d+[.,]\d{2}\s*$/, '') // trailing "2 @ 15.00"
    .replace(/[|_~*]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * lines: array of strings (one per receipt line, top→bottom)
 * returns { date, total, items: [{ name, price, lineIdx }] }
 * Items stop at the total line ("ยอดสุทธิ") — everything below is payment info.
 */
export function parseReceiptLines(lines) {
  const items = [];
  let total = null, date = null, ended = false;
  lines.forEach((raw, idx) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (!date) date = parseDate(text);
    if (ended) return;
    const m = text.match(PRICE_RE);
    if (!m) return;
    let price = toNum(m[1]);
    if (!isFinite(price)) return;
    const before = text.slice(0, m.index).trim();
    if (TOTAL_RE.test(before) && items.length) { total = price; ended = true; return; }
    if (SKIP_RE.test(before)) return;
    if (/\d{1,2}[\/\-.:]\d{1,2}/.test(before) && /\d{2}[\/\-.]\d{2,4}/.test(before)) return; // date/time line
    if (price === 0) return;                                // free promo lines (0.00)
    const name = cleanName(before);
    if (!name || name.replace(/[^\p{L}]/gu, '').length < 2) return;
    if (DISCOUNT_RE.test(name) || /^-/.test(m[1].trim())) price = -Math.abs(price);
    items.push({ name, price, lineIdx: idx });
  });
  // No total keyword read? A line equal to the sum of everything above it is the total.
  if (total == null) {
    let run = 0;
    for (let i = 0; i < items.length; i++) {
      if (i >= 2 && Math.abs(items[i].price - run) < 0.01) { total = items[i].price; items.length = i; break; }
      run += items[i].price;
    }
  }
  return { date, total, items };
}

// ---------- learning: correct OCR names using names you saved before ----------
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j), cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
// compare without spaces/punctuation/tone marks (the parts OCR gets wrong most)
const squash = (s) => normThai(s).replace(/[\s\-_.()\u0E48-\u0E4C]/g, '').toLowerCase();
/**
 * known: [{ key, name }] — key is what OCR read last time (or the name itself), name is what you saved.
 * Returns the saved name of the closest match if similar enough, else the original.
 */
export function correctName(name, known) {
  const q = squash(name); if (q.length < 2) return name;
  let best = null, bestScore = 0;
  for (const { key, name: fixed } of known) {
    const kk = squash(key); if (!kk) continue;
    const k = fixed;
    if (Math.abs(kk.length - q.length) > Math.max(kk.length, q.length) * 0.4) continue;
    const score = 1 - lev(q, kk) / Math.max(q.length, kk.length);
    if (score > bestScore) { bestScore = score; best = k; }
  }
  return bestScore >= 0.6 ? best : name;
}

// ---------- marks (pixel analysis) ----------
/** Counts strongly coloured pixels (red/pink/orange/any marker) in a horizontal band. */
export function markScore(imgData, y0, y1) {
  const { width, height, data } = imgData;
  y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(height - 1, Math.ceil(y1));
  let hits = 0;
  for (let y = y0; y <= y1; y++) {
    let o = y * width * 4;
    for (let x = 0; x < width; x++, o += 4) {
      const r = data[o], g = data[o + 1], b = data[o + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max - min > 90 && max > 120) hits++;
    }
  }
  return hits;
}

// ---------- OCR ----------
let tessLoad, workerP, progressCb = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  return (tessLoad ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = TESSERACT_URL; s.onload = res; s.onerror = () => { tessLoad = null; rej(new Error('OCR library failed to load')); };
    document.head.appendChild(s);
  }));
}
async function getWorker() {
  await loadTesseract();
  workerP ||= window.Tesseract.createWorker(['tha', 'eng'], 1, {
    logger: (m) => progressCb && progressCb(m),
  }).catch((e) => { workerP = null; throw e; });
  return workerP;
}

/**
 * Reads a receipt image. onProgress({status, progress}) is called while loading / reading.
 * Returns { date, total, items: [{ name, price, owner: 'a'|'b', marked }] }
 */
export async function readReceipt(file, onProgress, known = []) {
  progressCb = onProgress;
  const bmp = await createImageBitmap(file);
  // small (compressed) screenshots read best at ~2×; full-size phone screenshots as-is (capped)
  const s = bmp.width < 800 ? 2 : Math.min(1, 2000 / bmp.width);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);

  const worker = await getWorker();
  const { data } = await worker.recognize(c);
  progressCb = null;
  const lines = (data.lines || []).map((l) => ({ text: l.text || '', bbox: l.bbox }));
  const parsed = parseReceiptLines(lines.map((l) => l.text));

  // detect coloured marks on each item line (dot, underline, highlight, circle)
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const scores = parsed.items.map((it) => {
    const { y0, y1 } = lines[it.lineIdx].bbox;
    const h = y1 - y0;
    return markScore(img, y0 - h * 0.15, y1 + h * 0.6);
  });
  // threshold: absolute floor + relative to the "unmarked" baseline (in case the receipt itself is coloured)
  const sorted = [...scores].sort((a, b) => a - b);
  const baseline = sorted[Math.floor(sorted.length / 4)] || 0; // lower quartile = typical unmarked line
  const floor = Math.max(25, c.width * 0.02);
  parsed.items.forEach((it, i) => {
    it.marked = scores[i] > floor && scores[i] > baseline * 3 + floor;
    it.owner = it.marked ? 'b' : 'a';
    it.rawName = it.name;
    it.name = correctName(it.name, known);
  });
  return parsed;
}
