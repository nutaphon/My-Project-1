# 🍱 Meal Split · หารค่าข้าว

เว็บแอปสำหรับหารค่าอาหารกับแฟน ใช้บนมือถือได้ มีอัปโหลดสลิป หารแยกรายการ (เช่นบิล 7-11) และ dashboard รายเดือน รองรับ **ภาษาไทย / English**

A mobile-first web app to split meal costs with your partner: slip uploads, per-item splitting (great for 7-11 bills), monthly dashboard, Thai/English.

---

## ✨ ฟีเจอร์ / Features

| | ไทย | English |
|---|---|---|
| ½ | **หารครึ่ง** — ใส่ยอดรวม แล้วแบ่ง 50/50 อัตโนมัติ | **50/50 split** from a single total |
| 🧾 | **แยกรายการ** — ใส่ของทีละชิ้นแล้วกดว่า *เรา / แฟน / ทั้งคู่* (ทั้งคู่ = หารครึ่ง) | **Per-item split** — tag each item *A / B / Both* |
| 📷 | **อัปโหลดสลิป/ใบเสร็จ** ถ่ายจากกล้องมือถือได้เลย (ย่อรูปอัตโนมัติ) | **Slip / receipt photos**, auto-compressed |
| 💸 | **ยอดคงค้าง** — บอกตลอดว่าใครติดเงินใครเท่าไร + บันทึกการโอนคืน | **Running balance** + record payments |
| 📊 | **Dashboard** — ยอดรวมต่อเดือน, ส่วนของแต่ละคน, เฉลี่ยต่อมื้อ/ต่อวัน/ต่อคน, กราฟ 6 เดือน, แยกประเภท, ร้านที่ไปบ่อย | Monthly totals, per-person share, averages, 6-month chart, categories, top places |
| 🔄 | **ซิงก์ real-time** ระหว่างมือถือสองเครื่อง (โหมด Supabase) | **Realtime sync** between both phones |
| 🌐 | ภาษาไทย / English สลับได้ทันที | Instant TH/EN toggle |
| ⬇️ | ส่งออก CSV (เปิดใน Excel/Google Sheets) และสำรอง JSON | CSV export & JSON backup |
| 📱 | เพิ่มลงหน้าจอโฮมได้เหมือนแอป (PWA) | Add to Home Screen |

## 🏗️ สถาปัตยกรรม / Architecture

```
GitHub Pages (static: HTML/CSS/JS — ฟรี)
        │
        ▼
Supabase (ฟรี tier)
  ├─ Auth      → login ด้วยอีเมล/รหัสผ่าน (เฉพาะ 2 คน)
  ├─ Postgres  → expenses, settlements, settings (+ Row Level Security)
  ├─ Storage   → bucket "slips" แบบ private
  └─ Realtime  → แฟนเพิ่มรายการ อีกเครื่องเห็นทันที
```

ไม่มี build step ไม่ต้องติดตั้ง Node — เป็นไฟล์ static ล้วน

**สองโหมด**
- **Local mode** (ค่าเริ่มต้น เมื่อ `config.js` ว่าง): เก็บข้อมูลในเบราว์เซอร์เครื่องเดียว — ไว้ลองเล่นได้ทันที
- **Cloud mode** (ใส่ค่า Supabase ใน `config.js`): ออนไลน์ ซิงก์ 2 เครื่อง อัปโหลดสลิปขึ้น cloud

---

## 🚀 วิธีติดตั้ง (ประมาณ 10 นาที)

### 1. สร้าง Supabase project
1. สมัครที่ <https://supabase.com> → **New project** (เลือก region Singapore จะเร็วสุดสำหรับไทย)
2. เปิด `supabase/schema.sql` ในโปรเจกต์นี้ → **แก้อีเมลสองบรรทัด** ให้เป็นอีเมลของเราและแฟน
3. ใน Supabase ไปที่ **SQL Editor → New query** → วางทั้งไฟล์ → **Run**

### 2. สร้างบัญชีให้ 2 คน
1. **Authentication → Users → Add user → Create new user** ใส่อีเมล+รหัสผ่าน (ติ๊ก *Auto Confirm User*) ทำ 2 ครั้ง
2. (แนะนำ) **Authentication → Sign In / Providers** → ปิด *Allow new users to sign up* — กันคนอื่นสมัคร
   *ถึงไม่ปิด คนนอกก็อ่าน/เขียนข้อมูลไม่ได้อยู่แล้ว เพราะ RLS อนุญาตเฉพาะอีเมลในตาราง `members`*

### 3. ใส่ค่าเชื่อมต่อ
**Project Settings → API** คัดลอก *Project URL* และ *anon / publishable key* มาใส่ใน `config.js`:

```js
window.APP_CONFIG = {
  supabaseUrl: 'https://xxxx.supabase.co',
  supabaseAnonKey: 'eyJhbGci...',
};
```
> anon key เปิดเผยได้ (ความปลอดภัยอยู่ที่ RLS) — **ห้ามใส่ `service_role` key เด็ดขาด**

### 4. เปิดเว็บด้วย GitHub Pages
1. Commit + push ขึ้น GitHub
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main` / `(root)` → Save
3. รอ 1–2 นาที จะได้ลิงก์ `https://<username>.github.io/My-Project-1/`
4. เปิดบนมือถือ → แชร์ → **Add to Home Screen** 🎉

### ลองบนเครื่องตัวเอง
```bash
python3 -m http.server 8000
```
แล้วเปิด <http://localhost:8000>

---

## 🧮 วิธีคิดเงิน / How the math works

- **หารครึ่ง:** แต่ละคน = ยอดรวม ÷ 2
- **แยกรายการ:** ส่วนของ A = ของ A + (ของ "ทั้งคู่" ÷ 2) — B เหมือนกัน
- **ยอดคงค้าง:** ทุกบิลที่ A จ่าย → B ติด A เท่ากับส่วนของ B (และกลับกัน) แล้วหักด้วยเงินที่โอนคืนกันแล้ว

ตัวอย่าง 7-11 (เราจ่าย ฿95): ข้าวกล่อง ฿45 (เรา), นม ฿20 (แฟน), ขนม ฿30 (ทั้งคู่)
→ ส่วนเรา ฿60, ส่วนแฟน ฿35 → **แฟนต้องจ่ายเรา ฿35**

## 📁 โครงสร้างไฟล์

```
index.html            หน้าเว็บหลัก
config.js             ค่าเชื่อมต่อ Supabase
css/style.css         สไตล์ (รองรับ dark mode)
js/app.js             UI ทุกหน้า
js/calc.js            สูตรคำนวณ (ไม่มี DOM)
js/store.js           ชั้นข้อมูล: LocalStore / SupabaseStore
js/i18n.js            คำแปล ไทย / English
supabase/schema.sql   ตาราง + RLS + storage bucket
```

## 💡 ไอเดียต่อยอด
- อ่านยอดจากสลิปอัตโนมัติด้วย OCR (เช่น Tesseract.js รองรับภาษาไทย)
- สร้าง QR PromptPay สำหรับโอนเคลียร์ยอดในคลิกเดียว
- แจ้งเตือนผ่าน LINE เมื่อยอดค้างเกินที่กำหนด
