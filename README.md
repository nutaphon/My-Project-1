# 🍱 Meal Split · หารค่าข้าว

เว็บแอปสำหรับหารค่าอาหารกับแฟน ใช้บนมือถือได้ มีอัปโหลดสลิป หารแยกรายการ (เช่นบิล 7-11) และ dashboard รายเดือน รองรับ **ภาษาไทย / English**

A mobile-first web app to split meal costs with your partner: slip uploads, per-item splitting (great for 7-11 bills), monthly dashboard, Thai/English.

---

## ✨ วิธีใช้ / How it works

**1. 🏪 ใบเสร็จ 7-11** (ใช้บ่อยสุด)
1. แคป E-receipt จากแอป 7-11 → **ขีดเส้นใต้ หรือจุดสีแดง** ที่เมนูของแฟน (ใช้ปากกาในแอปแก้รูปของมือถือ)
2. กด 🏪 → เลือกรูป → ระบบอ่านให้เอง: **วันที่ · ชื่อเมนู · ราคา · ยอดรวม**
3. เมนูที่ขีดไว้จะถูกตั้งเป็น "แฟน" อัตโนมัติ (แตะป้ายชื่อเพื่อสลับได้) → บันทึก
   - ไม่หารครึ่ง: ของใครของมัน แฟนติดเราเท่ากับราคาของที่แฟนกิน
   - ถ้ายอดที่อ่านได้ไม่ตรงกับยอดในใบเสร็จ ระบบจะเตือนให้ตรวจ

**2. 🍜 กินข้างนอก** — ใส่ชื่อร้าน + เมนูของแฟนกี่บาท (ใส่ของเราเพิ่มได้ ไว้ดูสถิติ)

**3. 🛵 ค่าวิน** — ปุ่มลัด "วินไป / วินกลับ" ใส่ราคา แตะเลือกว่าเป็นของใคร

**อื่นๆ:** ยอดคงค้าง + บันทึกการโอนคืน · Dashboard รายเดือน (ของแฟน / ของเรา / แยกประเภท / กราฟ 6 เดือน) · ภาษาไทย/English · ส่งออก CSV · Add to Home Screen

> การอ่านใบเสร็จใช้ [Tesseract.js](https://tesseract.projectnaptha.com/) ทำงานในเบราว์เซอร์ **ฟรี ไม่ต้องมี API key** ครั้งแรกจะโหลดข้อมูลภาษาไทยประมาณ 10 MB แล้วจะเร็วขึ้น

## 🏗️ สถาปัตยกรรม / Architecture

```
GitHub Pages (static: HTML/CSS/JS — ฟรี)
        │
        ▼
Supabase (ฟรี tier)
  ├─ Auth      → login ด้วยอีเมล/รหัสผ่าน (เฉพาะเจ้าของ)
  ├─ Postgres  → expenses, settlements, settings (+ Row Level Security)
  ├─ Storage   → bucket "slips" แบบ private
  └─ Realtime  → แฟนเพิ่มรายการ อีกเครื่องเห็นทันที
```

ไม่มี build step ไม่ต้องติดตั้ง Node — เป็นไฟล์ static ล้วน

**สองโหมด**
- **Local mode** (ค่าเริ่มต้น เมื่อ `config.js` ว่าง): เก็บข้อมูลในเบราว์เซอร์เครื่องเดียว — ไว้ลองเล่นได้ทันที
- **Cloud mode** (ใส่ค่า Supabase ใน `config.js`): ออนไลน์ ใช้ได้ทุกเครื่องที่ล็อกอิน อัปโหลดสลิปขึ้น cloud

> **ใช้คนเดียว:** มีแค่เราที่ล็อกอิน แฟนเป็น "คน B" ไว้คำนวณการหารเท่านั้น ไม่ต้องมีบัญชี
> (ถ้าวันหลังอยากให้แฟนล็อกอินด้วย เพิ่มอีเมลแฟนในตาราง `members` แล้วสร้าง user เพิ่ม)

---

## 🚀 วิธีติดตั้ง (ประมาณ 10 นาที)

### 1. สร้าง Supabase project
1. สมัครที่ <https://supabase.com> → **New project** (เลือก region Singapore จะเร็วสุดสำหรับไทย)
2. เปิด `supabase/schema.sql` ในโปรเจกต์นี้ → **แก้อีเมล** `you@example.com` ให้เป็นอีเมลของเรา
3. ใน Supabase ไปที่ **SQL Editor → New query** → วางทั้งไฟล์ → **Run**

### 2. สร้างบัญชีของเรา
1. **Authentication → Users → Add user → Create new user** ใส่อีเมล (ตรงกับข้อ 1) + รหัสผ่าน (ติ๊ก *Auto Confirm User*)
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

## 🧮 วิธีคิดเงิน

- ทุกเมนูเป็นของ **เรา** หรือ **แฟน** (ไม่หารครึ่ง)
- ถ้าเราเป็นคนจ่าย → แฟนติดเราเท่ากับผลรวมเมนูของแฟน (และกลับกันถ้าแฟนจ่าย)
- ยอดคงค้าง = ทุกรายการรวมกัน − เงินที่โอนคืนกันแล้ว

ตัวอย่าง 7-11 ฿116: ข้าวกะเพรา 45, **นมเปรี้ยว 12** ✏️, แซนวิช 32, **ชาเขียว 20** ✏️, น้ำ 7 → แฟนต้องจ่ายเรา **฿32**

## 📁 โครงสร้างไฟล์

```
index.html            หน้าเว็บหลัก
config.js             ค่าเชื่อมต่อ Supabase
css/style.css         สไตล์ (รองรับ dark mode)
js/app.js             UI ทุกหน้า
js/calc.js            สูตรคำนวณ (ไม่มี DOM)
js/receipt.js         อ่านใบเสร็จ (OCR) + ตรวจจับรอยขีดสีแดง
js/store.js           ชั้นข้อมูล: LocalStore / SupabaseStore
js/i18n.js            คำแปล ไทย / English
supabase/schema.sql   ตาราง + RLS + storage bucket
```

## 💡 ไอเดียต่อยอด
- ใช้ AI (เช่น Claude) อ่านใบเสร็จแทน OCR เพื่อความแม่นยำสูงขึ้น
- สร้าง QR PromptPay สำหรับโอนเคลียร์ยอดในคลิกเดียว
- แจ้งเตือนผ่าน LINE เมื่อยอดค้างเกินที่กำหนด
