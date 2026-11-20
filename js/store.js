// Data layer: LocalStore (browser only) or SupabaseStore (online, synced, slip uploads)
const LS_KEY = 'mealsplit:data:v1';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

/** Resize + compress an image file to a JPEG blob (keeps slips small). */
export async function compressImage(file, maxSide = 1600, quality = 0.8) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', quality));
}
const blobToDataURL = (blob) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob);
});

class LocalStore {
  mode = 'local';
  constructor() {
    try { this.data = JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch { this.data = null; }
    this.data ||= { expenses: [], settlements: [], settings: { name_a: '', name_b: '' } };
  }
  _persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.data)); }
    catch (e) { const err = new Error('localStorageFull'); err.cause = e; throw err; }
  }
  async init() { return true; }
  async getSession() { return { user: { email: null } }; }
  async getSettings() { return { ...this.data.settings }; }
  async saveSettings(s) { this.data.settings = { ...s }; this._persist(); }
  async listExpenses() { return [...this.data.expenses]; }
  async saveExpense(e) {
    const row = { ...e, id: e.id || uid(), created_at: e.created_at || new Date().toISOString() };
    const i = this.data.expenses.findIndex((x) => x.id === row.id);
    if (i >= 0) this.data.expenses[i] = row; else this.data.expenses.push(row);
    this._persist(); return row;
  }
  async deleteExpense(e) { this.data.expenses = this.data.expenses.filter((x) => x.id !== e.id); this._persist(); }
  async listSettlements() { return [...this.data.settlements]; }
  async saveSettlement(s) {
    const row = { ...s, id: uid(), created_at: new Date().toISOString() };
    this.data.settlements.push(row); this._persist(); return row;
  }
  async deleteSettlement(id) { this.data.settlements = this.data.settlements.filter((x) => x.id !== id); this._persist(); }
  async uploadSlip(blob) { return blobToDataURL(await compressImage(blob, 1200, 0.7)); }
  async removeSlip() {}
  async slipUrl(path) { return path; }
  exportAll() { return JSON.parse(JSON.stringify(this.data)); }
  async importAll(d) {
    this.data = { expenses: d.expenses || [], settlements: d.settlements || [], settings: d.settings || this.data.settings };
    this._persist();
  }
  async clear() { localStorage.removeItem(LS_KEY); this.data = { expenses: [], settlements: [], settings: { name_a: '', name_b: '' } }; }
  subscribe() {}
}

const EXP_COLS = ['date', 'title', 'category', 'payer', 'split', 'total', 'items', 'slip_path', 'note'];

class SupabaseStore {
  mode = 'cloud';
  constructor(url, key) {
    this.sb = window.supabase.createClient(url, key);
  }
  async init() { return true; }
  async getSession() { const { data } = await this.sb.auth.getSession(); return data.session; }
  async signIn(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }
  async signOut() { await this.sb.auth.signOut(); }
  _ok({ data, error }) { if (error) throw error; return data; }
  async getSettings() {
    const d = this._ok(await this.sb.from('settings').select('*').eq('id', 1).maybeSingle());
    return d || { name_a: '', name_b: '' };
  }
  async saveSettings(s) {
    this._ok(await this.sb.from('settings').upsert({ id: 1, name_a: s.name_a, name_b: s.name_b }));
  }
  async listExpenses() {
    return this._ok(await this.sb.from('expenses').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }));
  }
  async saveExpense(e) {
    const row = Object.fromEntries(EXP_COLS.map((k) => [k, e[k] ?? null]));
    row.items = e.items || [];
    const q = e.id
      ? this.sb.from('expenses').update(row).eq('id', e.id).select().single()
      : this.sb.from('expenses').insert(row).select().single();
    return this._ok(await q);
  }
  async deleteExpense(e) {
    this._ok(await this.sb.from('expenses').delete().eq('id', e.id));
    if (e.slip_path) await this.removeSlip(e.slip_path);
  }
  async listSettlements() {
    return this._ok(await this.sb.from('settlements').select('*').order('date', { ascending: false }));
  }
  async saveSettlement(s) {
    return this._ok(await this.sb.from('settlements').insert({
      date: s.date, from_person: s.from_person, amount: s.amount, note: s.note || null,
    }).select().single());
  }
  async deleteSettlement(id) { this._ok(await this.sb.from('settlements').delete().eq('id', id)); }
  async uploadSlip(file) {
    const blob = await compressImage(file);
    const d = new Date();
    const path = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${uid()}.jpg`;
    this._ok(await this.sb.storage.from('slips').upload(path, blob, { contentType: 'image/jpeg' }));
    return path;
  }
  async removeSlip(path) {
    if (path) await this.sb.storage.from('slips').remove([path]).catch(() => {});
  }
  async slipUrl(path) {
    const { data, error } = await this.sb.storage.from('slips').createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  }
  async exportAll() {
    return { expenses: await this.listExpenses(), settlements: await this.listSettlements(), settings: await this.getSettings() };
  }
  /** Live updates when the partner adds something on their phone. */
  subscribe(onChange) {
    this.sb.channel('mealsplit')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, onChange)
      .subscribe();
  }
}

export function createStore() {
  const cfg = window.APP_CONFIG || {};
  if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
    return new SupabaseStore(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }
  return new LocalStore();
}
