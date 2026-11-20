// Receipt reading: OCR (Tesseract.js, runs in the browser — free, no API key)
// + detection of coloured marks (red dot / underline / highlight) on item lines.

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

// ---------- pure parsing (no DOM; unit-testable) ----------
const PRICE_RE = /(-?\s?\d{1,3}(?:,\d{3})*[.,]\d{2})\s*[-]?\s*(?:฿|บาท|B)?\s*$/;
const SKIP_RE = /(รวม|ยอด|สุทธิ|ทั้งสิ้น|total|sub ?total|ทอน|เงินสด|cash|change|vat|ภาษี|true ?money|wallet|บัตร|card|ชำระ|แต้ม|point|รับเงิน|คงเหลือ|balance|tax|ราคาก่อน|มูลค่า|amount|qr|promptpay|พร้อมเพย์|ref|เลขที่|pos|tel|โทร)/i;
const TOTAL_RE = /(สุทธิ|ทั้งสิ้น|ยอดชำระ|ยอดรวม|รวม|net|grand ?total|total)/i;
const DISCOUNT_RE = /(ส่วนลด|ลด|discount|คูปอง|coupon|promotion|โปร)/i;
const TH_MONTHS = ['ม.ค', 'ก.พ', 'มี.ค', 'เม.ย', 'พ.ค', 'มิ.ย', 'ก.ค', 'ส.ค', 'ก.ย', 'ต.ค', 'พ.ย', 'ธ.ค'];

const toNum = (s) => Number(String(s).replace(/\s/g, '').replace(/,(?=\d{3})/g, '').replace(',', '.'));
const pad = (n) => String(n).padStart(2, '0');

function normYear(y) {
  y = Number(y);
  if (y < 100) y = y >= 60 ? 2500 + y : 2000 + y; // 2-digit: 69 → 2569 (BE), 25 → 2025
  if (y > 2400) y -= 543;                         // Buddhist Era → CE
  return y;
}

export function parseDate(text) {
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
  return s
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
 */
export function parseReceiptLines(lines) {
  const items = [];
  let total = null, date = null;
  lines.forEach((raw, idx) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (!date) date = parseDate(text);
    const m = text.match(PRICE_RE);
    if (!m) return;
    let price = toNum(m[1]);
    if (!isFinite(price)) return;
    const before = text.slice(0, m.index).trim();
    if (TOTAL_RE.test(before)) { total = price; return; }  // keep the last "total"-like line
    if (SKIP_RE.test(before)) return;
    if (/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(before)) return; // date/time line
    const name = cleanName(before);
    if (!name || name.replace(/[^\p{L}]/gu, '').length < 2) return;
    if (DISCOUNT_RE.test(name) || /-\s*$/.test(text) || /^-/.test(m[1])) price = -Math.abs(price);
    items.push({ name, price, lineIdx: idx });
  });
  return { date, total, items };
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
export async function readReceipt(file, onProgress) {
  progressCb = onProgress;
  const bmp = await createImageBitmap(file);
  const targetW = Math.min(1600, Math.max(1000, bmp.width));
  const s = targetW / bmp.width;
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
  });
  return parsed;
}
