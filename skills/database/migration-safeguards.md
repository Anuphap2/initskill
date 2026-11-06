# Database Migration Safeguards

## Contract

Apply this skill when creating, reviewing, or executing database schema changes, migrations, indexes, data backfills, or table alteration scripts in production environments.

## กฎเหล็กการทำ Zero-Downtime Migration ระดับ Production

- **Expand/Contract Pattern (Two-Phase Evolution)**:
  - **ห้าม** แก้ไขหรือลบคอลัมน์ที่ application version ปัจจุบันยังใช้งานอยู่เด็ดขาด
  - **ขั้นตอนที่ 1 (Expand)**: เพิ่มคอลัมน์ใหม่แบบ nullable หรือมี default value โดยไม่กระทบโค้ดเดิม
  - **ขั้นตอนที่ 2 (Dual-write / Code Deploy)**: Deploy application version ใหม่ที่เขียนลงทั้งสองที่ หรือเริ่มอ่านจากคอลัมน์ใหม่
  - **ขั้นตอนที่ 3 (Backfill)**: ทยอย migrate ข้อมูลเก่าไปยังคอลัมน์ใหม่แบบ chunked
  - **ขั้นตอนที่ 4 (Contract)**: ตัดโค้ดที่อ่านคอลัมน์เก่าออก และ drop คอลัมน์เดิมใน release ถัดไป
- **Avoid Table Locks (ป้องกัน Database Freeze)**:
  - ใน PostgreSQL: ใช้ `CREATE INDEX CONCURRENTLY` และ `DROP INDEX CONCURRENTLY` เสมอ (ห้ามสร้าง index บนตารางขนาดใหญ่แบบ blocking)
  - หลีกเลี่ยงการรัน DDL ที่ใช้เวลา lock ตารางนานในชั่วโมงเร่งด่วน ตั้งค่า `lock_timeout` หรือ `statement_timeout` สั้นๆ เพื่อป้องกัน query คิวยาว
  - การเติม `NOT NULL` บนตารางขนาดใหญ่ ให้เพิ่ม constraint แบบ `NOT VALID` ก่อน แล้วค่อย `VALIDATE CONSTRAINT` แยกต่างหาก
- **Chunked Data Backfills (ทยอยย้ายข้อมูล)**:
  - การ update หรือ backfill ข้อมูลขนาดใหญ่ ต้องแบ่งทำเป็น batch เล็กๆ (เช่น 500-1,000 rows ต่อ transaction) พร้อมเว้น sleep interval เล็กน้อย เพื่อป้องกัน transaction log เต็ม และป้องกัน replication lag ไปยัง Read Replicas
- **Reversibility & Rollback Plan**:
  - ทุก migration ต้องมี script `down` (rollback) ที่ผ่านการทดสอบจริง หรือมีแผน compensating action ที่ชัดเจน
  - ห้ามเขียน migration แบบทำลายล้างที่ย้อนกลับไม่ได้ (เช่น `DROP TABLE` กะทันหัน) ให้ใช้วิธี rename/soft-deprecate ก่อน

## Procedure การตรวจสอบ Migration

1. ประเมินขนาดตาราง (Row count & Data size) และ impact ต่อ throughput ของระบบ
2. ตรวจสอบ compatibility ย้อนหลัง: หาก deploy migration แล้วแอปเวอร์ชันเดิมยังรันอยู่ ระบบจะพังหรือไม่
3. ทดสอบการรัน migration ทั้ง `up` และ `down` ใน staging environment หรือ isolated test database
4. ตรวจสอบ execution plan และ index coverage สำหรับ queries ใหม่ที่เพิ่มเข้ามา
5. จัดเตรียม runbook และคำสั่ง abort/rollback หาก migration ใช้เวลานานเกินกำหนด

## Verification

- แสดง log การทดสอบรัน migration ทั้งคำสั่ง up และ down สำเร็จ
- ยืนยันว่าไม่มีคำสั่ง blocking table lock บน high-traffic tables
- มี verification query ตรวจสอบความถูกต้องของ schema และ index หลังจาก migration เสร็จสิ้น
