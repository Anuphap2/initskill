# MongoDB Schema

- ระบุ shape, required fields, indexes และความสัมพันธ์ของ document ก่อนแก้ schema
- หลีกเลี่ยงการเปลี่ยนชื่อ field โดยไม่มี migration หรือ compatibility plan
- ตรวจสอบ query ที่เพิ่มขึ้นด้วย index และทดสอบกรณีข้อมูลว่าง/ข้อมูลเก่า

## Data Modeling และอนาคต

- ออกแบบจาก access patterns, cardinality, read/write ratio และ consistency requirement ไม่ใช่จาก object model อย่างเดียว
- พิจารณา document size, array growth, hot document, query selectivity และ time/space cost ของ index
- ระบุ invariant ที่ต้องรักษาเมื่อมี concurrent writes, retry หรือ duplicate request และเลือก atomic operation/transaction ให้เหมาะสม
- ทุก schema change ต้องมี rollout, backfill, rollback/forward-fix และ compatibility plan สำหรับข้อมูลเก่า
- เฝ้าระวัง denormalization ที่ทำให้ update หลายจุดและ normalization ที่ทำให้ query ซับซ้อนหรือช้าเกินจำเป็น
- บันทึก migration หรือ cleanup ที่เลื่อนออกไปเป็น technical debt พร้อม trigger จากขนาดข้อมูลหรือ performance metric
