// Thai / English dictionary
const dict = {
  en: {
    appName: 'Meal Split',
    tagline: 'Split meals with your partner, fair and easy',
    nav_dashboard: 'Dashboard', nav_add: 'Add', nav_history: 'History', nav_settle: 'Settle', nav_settings: 'Settings',
    // categories
    cat_breakfast: 'Breakfast', cat_lunch: 'Lunch', cat_dinner: 'Dinner', cat_snack: 'Snack',
    cat_drink: 'Drink', cat_store: '7-11 / Store', cat_other: 'Other',
    // dashboard
    thisMonth: 'This month', totalSpent: 'Total spent', meals: 'Meals', avgPerMeal: 'Avg / meal',
    avgPerDay: 'Avg / day', shareOf: '{name}\'s share', paidBy: 'Paid by {name}',
    balance: 'Balance', owes: '{from} owes {to}', allSettled: 'All settled up 🎉',
    settleNow: 'Settle up', trend6: 'Last 6 months (share per person)', byCategory: 'By category',
    topPlaces: 'Top places', noData: 'No expenses yet. Tap + to add your first meal!',
    perPerson: 'Per person', daysWithMeals: '{n} days with meals',
    // form
    addExpense: 'Add expense', editExpense: 'Edit expense', date: 'Date', category: 'Type',
    title: 'Place / what', titlePh: 'e.g. Canteen, 7-11, Noodle shop', whoPaid: 'Who paid?',
    splitMode: 'How to split', splitEqual: 'Split 50/50', splitItems: 'By item',
    total: 'Total', items: 'Items', itemName: 'Item', price: 'Price', both: 'Both',
    addItem: '+ Add item', note: 'Note', notePh: 'Optional', slip: 'Slip / receipt',
    uploadSlip: '📷 Upload slip or receipt photo', changeSlip: 'Change photo', removeSlip: 'Remove',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', close: 'Close',
    summary: 'Summary', thisMealOwes: '{from} owes {to} {amt} for this',
    errAmount: 'Please enter an amount greater than 0', saved: 'Saved ✓', deleted: 'Deleted',
    confirmDelete: 'Delete this item?', saving: 'Saving…', uploading: 'Uploading slip…',
    quickItems: 'Quick tip: add each item and tap who ate it.',
    // history
    search: 'Search…', noResults: 'Nothing found for this month.', viewSlip: 'View slip',
    // settle
    recordPayment: 'Record a payment', from: 'From', to: 'To', amount: 'Amount',
    settlements: 'Payment history', noSettlements: 'No payments recorded yet.',
    paidTo: '{from} paid {to}', settledMsg: 'Payment recorded ✓',
    // settings
    names: 'Names', nameA: 'Person A (you)', nameB: 'Person B (partner)', language: 'Language',
    dataMode: 'Data storage', modeLocal: 'Local mode — data is saved only in this browser. Connect Supabase (see README) to sync between both phones and upload slips online.',
    modeCloud: 'Cloud mode (Supabase) — synced online.', signedInAs: 'Signed in as {email}',
    signOut: 'Sign out', exportCsv: 'Export CSV', exportJson: 'Backup (JSON)', importJson: 'Restore backup',
    clearLocal: 'Clear local data', confirmClear: 'Delete ALL local data? This cannot be undone.',
    imported: 'Backup restored ✓', backup: 'Export & backup',
    // auth
    signIn: 'Sign in', email: 'Email', password: 'Password', signInFail: 'Sign in failed: {msg}',
    signInHint: 'Accounts are created by the owner in the Supabase dashboard.',
    loading: 'Loading…', error: 'Error: {msg}', localWarn: 'Browser storage is full. Use cloud mode or remove some slips.',
  },
  th: {
    appName: 'หารค่าข้าว',
    tagline: 'หารค่าอาหารกับแฟน ง่ายและแฟร์',
    nav_dashboard: 'ภาพรวม', nav_add: 'เพิ่ม', nav_history: 'ประวัติ', nav_settle: 'เคลียร์เงิน', nav_settings: 'ตั้งค่า',
    cat_breakfast: 'มื้อเช้า', cat_lunch: 'มื้อกลางวัน', cat_dinner: 'มื้อเย็น', cat_snack: 'ขนม',
    cat_drink: 'เครื่องดื่ม', cat_store: '7-11 / ร้านสะดวกซื้อ', cat_other: 'อื่นๆ',
    thisMonth: 'เดือนนี้', totalSpent: 'ใช้ไปทั้งหมด', meals: 'จำนวนมื้อ', avgPerMeal: 'เฉลี่ย / มื้อ',
    avgPerDay: 'เฉลี่ย / วัน', shareOf: 'ส่วนของ {name}', paidBy: '{name} จ่ายไป',
    balance: 'ยอดคงค้าง', owes: '{from} ต้องจ่าย {to}', allSettled: 'เคลียร์กันครบแล้ว 🎉',
    settleNow: 'เคลียร์เงิน', trend6: '6 เดือนล่าสุด (ส่วนของแต่ละคน)', byCategory: 'แยกตามประเภท',
    topPlaces: 'ร้านที่ไปบ่อย', noData: 'ยังไม่มีรายการ กด + เพื่อเพิ่มมื้อแรกเลย!',
    perPerson: 'ต่อคน', daysWithMeals: 'กินข้าวด้วยกัน {n} วัน',
    addExpense: 'เพิ่มรายการ', editExpense: 'แก้ไขรายการ', date: 'วันที่', category: 'ประเภท',
    title: 'ร้าน / รายการ', titlePh: 'เช่น โรงอาหาร, 7-11, ร้านก๋วยเตี๋ยว', whoPaid: 'ใครจ่าย?',
    splitMode: 'วิธีหาร', splitEqual: 'หารครึ่ง 50/50', splitItems: 'แยกรายการ',
    total: 'ยอดรวม', items: 'รายการ', itemName: 'ชื่อของ', price: 'ราคา', both: 'ทั้งคู่',
    addItem: '+ เพิ่มรายการ', note: 'โน้ต', notePh: 'ไม่บังคับ', slip: 'สลิป / ใบเสร็จ',
    uploadSlip: '📷 อัปโหลดรูปสลิปหรือใบเสร็จ', changeSlip: 'เปลี่ยนรูป', removeSlip: 'ลบรูป',
    save: 'บันทึก', cancel: 'ยกเลิก', delete: 'ลบ', edit: 'แก้ไข', close: 'ปิด',
    summary: 'สรุป', thisMealOwes: '{from} ต้องจ่าย {to} {amt} สำหรับรายการนี้',
    errAmount: 'กรุณาใส่ยอดเงินมากกว่า 0', saved: 'บันทึกแล้ว ✓', deleted: 'ลบแล้ว',
    confirmDelete: 'ต้องการลบรายการนี้?', saving: 'กำลังบันทึก…', uploading: 'กำลังอัปโหลดสลิป…',
    quickItems: 'เคล็ดลับ: ใส่ของทีละชิ้น แล้วกดเลือกว่าใครกิน',
    search: 'ค้นหา…', noResults: 'ไม่พบรายการในเดือนนี้', viewSlip: 'ดูสลิป',
    recordPayment: 'บันทึกการโอนเงิน', from: 'จาก', to: 'ถึง', amount: 'จำนวนเงิน',
    settlements: 'ประวัติการโอน', noSettlements: 'ยังไม่มีการโอนเงิน',
    paidTo: '{from} โอนให้ {to}', settledMsg: 'บันทึกการโอนแล้ว ✓',
    names: 'ชื่อ', nameA: 'คน A (เรา)', nameB: 'คน B (แฟน)', language: 'ภาษา',
    dataMode: 'การเก็บข้อมูล', modeLocal: 'โหมดออฟไลน์ — ข้อมูลเก็บไว้ในเบราว์เซอร์นี้เท่านั้น เชื่อม Supabase (ดู README) เพื่อซิงก์ระหว่างมือถือสองเครื่องและอัปโหลดสลิปออนไลน์',
    modeCloud: 'โหมดออนไลน์ (Supabase) — ซิงก์ข้อมูลแล้ว', signedInAs: 'เข้าสู่ระบบด้วย {email}',
    signOut: 'ออกจากระบบ', exportCsv: 'ส่งออก CSV', exportJson: 'สำรองข้อมูล (JSON)', importJson: 'กู้คืนข้อมูล',
    clearLocal: 'ล้างข้อมูลในเครื่อง', confirmClear: 'ลบข้อมูลทั้งหมดในเครื่อง? ย้อนกลับไม่ได้นะ',
    imported: 'กู้คืนข้อมูลแล้ว ✓', backup: 'ส่งออก & สำรองข้อมูล',
    signIn: 'เข้าสู่ระบบ', email: 'อีเมล', password: 'รหัสผ่าน', signInFail: 'เข้าสู่ระบบไม่สำเร็จ: {msg}',
    signInHint: 'บัญชีถูกสร้างโดยเจ้าของระบบใน Supabase dashboard',
    loading: 'กำลังโหลด…', error: 'เกิดข้อผิดพลาด: {msg}', localWarn: 'พื้นที่เบราว์เซอร์เต็ม ใช้โหมดออนไลน์หรือลบสลิปบางรูป',
  },
};

let lang = (() => {
  try { return localStorage.getItem('mealsplit:lang') || 'th'; }
  catch { return 'th'; }
})();

export function getLang() { return lang; }
export function setLang(l) {
  lang = l;
  try { localStorage.setItem('mealsplit:lang', l); } catch {}
  document.documentElement.lang = l;
}
export function locale() { return lang === 'th' ? 'th-TH' : 'en-GB'; }
export function t(key, vars = {}) {
  const s = dict[lang][key] ?? dict.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
