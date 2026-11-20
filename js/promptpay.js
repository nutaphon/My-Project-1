// PromptPay QR (Thai QR Payment, EMVCo) — payload builder + QR renderer
const QR_URL = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';

const f = (id, val) => id + String(val.length).padStart(2, '0') + val;

function crc16(s) {
  let crc = 0xFFFF;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Cleans the ID; returns null if it isn't a phone (10 digits), national/tax ID (13) or e-wallet ID (15). */
export function normalizeId(id) {
  const d = String(id || '').replace(/\D/g, '');
  return [10, 13, 15].includes(d.length) ? d : null;
}

/** id: phone (0812345678), national ID (13 digits) or e-wallet (15 digits); amount in baht (optional). */
export function promptPayPayload(id, amount) {
  const d = normalizeId(id);
  if (!d) throw new Error('Invalid PromptPay ID');
  const acct = d.length === 10 ? f('01', ('0000000000000' + d.replace(/^0/, '66')).slice(-13))
    : d.length === 13 ? f('02', d) : f('03', d);
  const amt = Number(amount) > 0 ? f('54', Number(amount).toFixed(2)) : '';
  const body = f('00', '01') + f('01', amt ? '12' : '11') +
    f('29', f('00', 'A000000677010111') + acct) +
    f('58', 'TH') + f('53', '764') + amt + '6304';
  return body + crc16(body);
}

let libP;
function loadLib() {
  if (window.qrcode) return Promise.resolve();
  return (libP ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = QR_URL; s.onload = res; s.onerror = () => { libP = null; rej(new Error('QR library failed to load')); };
    document.head.appendChild(s);
  }));
}

/** Returns an <svg> string of the QR code. */
export async function promptPaySvg(id, amount) {
  await loadLib();
  const qr = window.qrcode(0, 'M');
  qr.addData(promptPayPayload(id, amount));
  qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true });
}
