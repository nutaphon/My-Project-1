// Thai / English dictionary
const dict = {
  en: {
    appName: 'Meal Split',
    tagline: 'Track what your partner owes — receipts, meals & rides',
    nav_dashboard: 'Home', nav_add: 'Add', nav_history: 'History', nav_settle: 'Settle', nav_settings: 'Settings',
    // kinds
    kind_store: '7-11 receipt', kind_food: 'Eating out', kind_travel: 'Rides',
    kindShort_store: '7-11', kindShort_food: 'Eating out', kindShort_travel: 'Travel',
    kindHint_store: 'Upload the e-receipt — I read it for you',
    kindHint_food: 'Add what your partner ate',
    kindHint_travel: 'Motorbike taxi, bus, etc.',
    // dashboard
    balance: 'Balance', owes: '{from} owes {to}', allSettled: 'All settled up 🎉', settleNow: 'Settle up',
    partnerThisMonth: '{name}\'s total this month', mineThisMonth: '{name}\'s total', allTotal: 'Total spent',
    avgPerDay: 'Avg / day', travelTotal: 'Travel', byKind: 'By type', trend6: 'Last 6 months',
    recent: 'Recent', seeAll: 'See all →', noData: 'Nothing yet this month. Start by uploading a 7-11 receipt!',
    daysCount: '{n} days',
    // editor
    addExpense: 'Add', editExpense: 'Edit', date: 'Date', place: 'Store / place',
    placePh_store: '7-Eleven', placePh_food: 'e.g. Noodle shop, Canteen', placePh_travel: 'e.g. Motorbike taxi',
    items: 'Items', itemName: 'Item', price: '฿', addItem: '+ Add item',
    tapToToggle: 'Tap the name tag to switch whose item it is',
    uploadReceipt: '📷 Upload 7-11 e-receipt', uploadHint: 'Tip: draw a red dot or underline on your partner\'s items before uploading — they\'ll be selected automatically.',
    orTypeManually: 'or type items manually', reading: 'Reading receipt… {p}%', loadingOcr: 'Loading reader (first time only)…',
    readDone: 'Found {n} items. Check whose each item is 👇', readNone: 'Couldn\'t read items — please type them in.',
    readMarked: '{n} marked items set to {name}', totalMismatch: 'Receipt total {r} ≠ items {s}. Please check.',
    showReceipt: 'Show receipt', hideReceipt: 'Hide receipt', rereadReceipt: 'Read again', changePhoto: 'Change photo', removePhoto: 'Remove photo',
    attachPhoto: '📎 Attach photo (optional)',
    quickRide: '+ Ride', rideThere: 'Ride there', rideBack: 'Ride back',
    whoPaid: 'Who paid', note: 'Note', notePh: 'Optional',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', close: 'Close',
    sumMine: '{name}', sumPartner: '{name}', total: 'Total',
    thisOwes: '{from} owes {to} {amt}',
    errAmount: 'Please add at least one item with a price', saved: 'Saved ✓', deleted: 'Deleted',
    confirmDelete: 'Delete this?', saving: 'Saving…', uploading: 'Uploading photo…',
    // history
    search: 'Search…', noResults: 'Nothing found for this month.', partnerPart: '{name} {amt}',
    // settle
    recordPayment: 'Record a payment', amount: 'Amount', settlements: 'Payment history', noSettlements: 'No payments recorded yet.',
    paidTo: '{from} paid {to}', settledMsg: 'Payment recorded ✓',
    // settings
    names: 'Names', nameA: 'You', nameB: 'Partner', language: 'Language',
    dataMode: 'Data storage', modeLocal: 'Local mode — data is saved only in this browser.',
    modeCloud: 'Online (Supabase) — synced on every device you sign in.', signedInAs: 'Signed in as {email}',
    signOut: 'Sign out', exportCsv: 'Export CSV', exportJson: 'Backup (JSON)', importJson: 'Restore backup',
    clearLocal: 'Clear local data', confirmClear: 'Delete ALL local data? This cannot be undone.',
    imported: 'Backup restored ✓', backup: 'Export & backup',
    // auth
    signIn: 'Sign in', email: 'Email', password: 'Password', signInFail: 'Sign in failed: {msg}',
    loading: 'Loading…', error: 'Error: {msg}', localWarn: 'Browser storage is full.',
  },
  th: {
    appName: 'หารค่าข้าว',
    tagline: 'จดว่าแฟนติดเงินเท่าไร — ใบเสร็จ 7-11, กินข้างนอก, ค่าวิน',
    nav_dashboard: 'หน้าหลัก', nav_add: 'เพิ่ม', nav_history: 'ประวัติ', nav_settle: 'เคลียร์เงิน', nav_settings: 'ตั้งค่า',
    kind_store: 'ใบเสร็จ 7-11', kind_food: 'กินข้างนอก', kind_travel: 'ค่าวิน',
    kindShort_store: '7-11', kindShort_food: 'กินข้างนอก', kindShort_travel: 'ค่าเดินทาง',
    kindHint_store: 'อัปโหลด E-receipt ระบบอ่านให้เอง',
    kindHint_food: 'ใส่ว่าแฟนกินอะไร กี่บาท',
    kindHint_travel: 'วินมอไซค์ รถเมล์ ฯลฯ',
    balance: 'ยอดคงค้าง', owes: '{from} ต้องจ่าย {to}', allSettled: 'เคลียร์กันครบแล้ว 🎉', settleNow: 'เคลียร์เงิน',
    partnerThisMonth: 'ของ{name}เดือนนี้', mineThisMonth: 'ของ{name}', allTotal: 'รวมทั้งหมด',
    avgPerDay: 'เฉลี่ย / วัน', travelTotal: 'ค่าเดินทาง', byKind: 'แยกตามประเภท', trend6: '6 เดือนล่าสุด',
    recent: 'ล่าสุด', seeAll: 'ดูทั้งหมด →', noData: 'เดือนนี้ยังไม่มีรายการ เริ่มจากอัปโหลดใบเสร็จ 7-11 ได้เลย!',
    daysCount: '{n} วัน',
    addExpense: 'เพิ่มรายการ', editExpense: 'แก้ไขรายการ', date: 'วันที่', place: 'ร้าน / สถานที่',
    placePh_store: '7-Eleven', placePh_food: 'เช่น ร้านก๋วยเตี๋ยว, โรงอาหาร', placePh_travel: 'เช่น วินหน้ามอ',
    items: 'รายการ', itemName: 'ชื่อเมนู', price: '฿', addItem: '+ เพิ่มเมนู',
    tapToToggle: 'แตะป้ายชื่อเพื่อสลับว่าเป็นของใคร',
    uploadReceipt: '📷 อัปโหลด E-receipt 7-11', uploadHint: 'เคล็ดลับ: ขีดเส้นใต้หรือจุดสีแดงที่เมนูของแฟนในรูปก่อนอัปโหลด ระบบจะเลือกให้อัตโนมัติ',
    orTypeManually: 'หรือพิมพ์รายการเอง', reading: 'กำลังอ่านใบเสร็จ… {p}%', loadingOcr: 'กำลังโหลดตัวอ่าน (ครั้งแรกจะนานหน่อย)…',
    readDone: 'อ่านได้ {n} รายการ ตรวจว่าอันไหนของใคร 👇', readNone: 'อ่านรายการไม่ได้ ลองพิมพ์เองนะ',
    readMarked: 'เจอที่ขีดไว้ {n} รายการ → ตั้งเป็นของ{name}แล้ว', totalMismatch: 'ยอดในใบเสร็จ {r} ≠ รวมรายการ {s} ลองตรวจอีกที',
    showReceipt: 'ดูรูปใบเสร็จ', hideReceipt: 'ซ่อนรูป', rereadReceipt: 'อ่านใหม่', changePhoto: 'เปลี่ยนรูป', removePhoto: 'ลบรูป',
    attachPhoto: '📎 แนบรูป (ไม่บังคับ)',
    quickRide: '+ วิน', rideThere: 'วินไป', rideBack: 'วินกลับ',
    whoPaid: 'ใครจ่าย', note: 'โน้ต', notePh: 'ไม่บังคับ',
    save: 'บันทึก', cancel: 'ยกเลิก', delete: 'ลบ', edit: 'แก้ไข', close: 'ปิด',
    sumMine: 'ของ{name}', sumPartner: 'ของ{name}', total: 'รวม',
    thisOwes: '{from} ต้องจ่าย {to} {amt}',
    errAmount: 'ใส่อย่างน้อย 1 รายการที่มีราคานะ', saved: 'บันทึกแล้ว ✓', deleted: 'ลบแล้ว',
    confirmDelete: 'ต้องการลบรายการนี้?', saving: 'กำลังบันทึก…', uploading: 'กำลังอัปโหลดรูป…',
    search: 'ค้นหา…', noResults: 'ไม่พบรายการในเดือนนี้', partnerPart: '{name} {amt}',
    recordPayment: 'บันทึกการโอนเงิน', amount: 'จำนวนเงิน', settlements: 'ประวัติการโอน', noSettlements: 'ยังไม่มีการโอนเงิน',
    paidTo: '{from} โอนให้ {to}', settledMsg: 'บันทึกการโอนแล้ว ✓',
    names: 'ชื่อ', nameA: 'เรา', nameB: 'แฟน', language: 'ภาษา',
    dataMode: 'การเก็บข้อมูล', modeLocal: 'โหมดออฟไลน์ — ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น',
    modeCloud: 'ออนไลน์ (Supabase) — ล็อกอินเครื่องไหนก็เห็นข้อมูลเดียวกัน', signedInAs: 'เข้าสู่ระบบด้วย {email}',
    signOut: 'ออกจากระบบ', exportCsv: 'ส่งออก CSV', exportJson: 'สำรองข้อมูล (JSON)', importJson: 'กู้คืนข้อมูล',
    clearLocal: 'ล้างข้อมูลในเครื่อง', confirmClear: 'ลบข้อมูลทั้งหมดในเครื่อง? ย้อนกลับไม่ได้นะ',
    imported: 'กู้คืนข้อมูลแล้ว ✓', backup: 'ส่งออก & สำรองข้อมูล',
    signIn: 'เข้าสู่ระบบ', email: 'อีเมล', password: 'รหัสผ่าน', signInFail: 'เข้าสู่ระบบไม่สำเร็จ: {msg}',
    loading: 'กำลังโหลด…', error: 'เกิดข้อผิดพลาด: {msg}', localWarn: 'พื้นที่เบราว์เซอร์เต็ม',
  },
};

let lang = (() => {
  try { return localStorage.getItem('mealsplit:lang') || 'th'; } catch { return 'th'; }
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
