# บุญมี รีไซเคิล — Price CMS

ระบบจัดการราคารับซื้อของเก่าสำหรับร้านบุญมี รีไซเคิล

- **ปรับปรุงราคา** แก้ทุกรายการได้ในหน้าเดียว พิมพ์ราคาแล้วกด `Enter` ระบบจะ **บันทึกร่าง** และไปแถวถัดไป (`Shift+Enter` ย้อนกลับ, `↑/↓` เลื่อนแถว, `Esc` ยกเลิก)
- **Publish** ทำให้ราคาร่างทั้งหมดมีผลจริง และสร้าง **เมนูราคา A4** (2480×3508) เก็บไว้ ดาวน์โหลด JPG/PDF หรือแชร์ส่งลูกค้าย้อนหลังได้ ทุกหน้ามี header/footer และหมวดจะไม่ถูกตัดข้ามหน้า
- **แนวโน้มราคา** แสดง ▲ ขึ้น / ▼ ลง พร้อมส่วนต่างและ sparkline จากประวัติแบบป้ายราคาน้ำมัน
- **สินค้ารับซื้อ** datatable ค้นหา กรอง เรียงลำดับ แบ่งหน้า และสลับ active/inactive (ต้องกรอกหัวข้อกับราคา ส่วนรูปและรายละเอียดไม่บังคับ)
- **หมวดหมู่** หมวดหลัก 1 : หมวดย่อยหลายหมวด และ **หน่วย** (master) ใช้เป็น dropdown
- **เมนูราคา (สตอรี่)** ขนาด 1080×1920 เป็น PNG / PDF หรือแชร์เข้า LINE จากมือถือ
- **Login ด้วยอีเมล + 2FA (TOTP)** ใช้กับ Google/Microsoft Authenticator ล็อกบัญชี 15 นาทีเมื่อใส่ผิด 5 ครั้ง
- **Super admin** (`SUPER_ADMIN_EMAIL`) เชิญ admin ด้วยลิงก์ (ใช้ครั้งเดียว 72 ชม.) ผู้รับตั้งรหัสผ่านตามกฎความปลอดภัย (≥ 8 ตัว, ตัวใหญ่, ตัวเล็ก, ตัวเลข, อักขระพิเศษ) แล้วสแกน QR Google Authenticator เอง ระงับผู้ใช้/รีเซ็ต 2FA/ลบได้

Stack: Next.js 15 (App Router, Server Actions) · PostgreSQL · Drizzle ORM · Tailwind CSS v4

## เริ่มใช้งาน (local)

```bash
cp .env.example .env          # แล้วตั้ง SESSION_SECRET ใหม่ (openssl rand -base64 32)
docker compose up -d          # Postgres ที่ localhost:54330
npm install
npm run db:migrate            # รัน migration
npm run db:seed               # ใส่ข้อมูลตัวอย่าง + ผู้ใช้ admin
npm run dev                   # http://localhost:3000
```

เข้าสู่ระบบด้วย `SUPER_ADMIN_EMAIL` / `ADMIN_PASSWORD` จาก `.env`
login ครั้งแรกระบบจะให้สแกน QR เพื่อผูกแอป Authenticator **เปลี่ยนรหัสผ่านที่หน้า ตั้งค่า หลัง login ครั้งแรก**

| คำสั่ง | ใช้ทำอะไร |
| --- | --- |
| `npm run db:generate` | สร้างไฟล์ migration ใหม่หลังแก้ `src/db/schema.ts` |
| `npm run db:migrate` | รัน migration ที่ยังไม่ได้รัน |
| `npm run db:seed` | seed ข้อมูล (ข้ามถ้ามีข้อมูลแล้ว) |
| `npm run db:reset` | ล้างแคตตาล็อกแล้ว seed ใหม่ (ผู้ใช้ยังอยู่) |
| `npm run db:studio` | เปิด Drizzle Studio |

### รีเซ็ต 2FA (กรณีทำมือถือหาย)

```sql
UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE email = 'mongkon.dev@gmail.com';
```

login ครั้งถัดไปจะให้สแกน QR ใหม่ (admin คนอื่น super admin กดปุ่มรีเซ็ต 2FA ที่หน้า ผู้ดูแลระบบ ได้)

### ส่งอีเมลเชิญอัตโนมัติ (ไม่บังคับ)

ตั้ง `RESEND_API_KEY` และ `MAIL_FROM` ([resend.com](https://resend.com) free tier) ถ้าไม่ตั้ง ระบบจะแสดงลิงก์ให้คัดลอก / ส่งทาง LINE / เปิดแอปอีเมลแทน

## Deploy (ฟรี: Vercel + Neon)

1. สร้างฐานข้อมูลที่ [neon.tech](https://neon.tech) (free tier) แล้วคัดลอก connection string แบบ **pooled**
2. Import repo นี้ใน Vercel แล้วตั้ง env `DATABASE_URL`, `SESSION_SECRET`, `SUPER_ADMIN_EMAIL`, `ADMIN_PASSWORD`
3. Build command คือ `npm run vercel-build` (ตั้งไว้ใน `vercel.json` แล้ว) ซึ่งรัน migration และ seed ก่อน build โดย seed จะข้ามถ้ามีข้อมูลอยู่แล้ว

รูปสินค้าเก็บในตาราง `images` (bytea) ย่อเป็น WebP ขนาดไม่เกิน 800px ฝั่ง browser ก่อนอัปโหลด จึงใช้กับ serverless ได้โดยไม่ต้องมี storage แยก
