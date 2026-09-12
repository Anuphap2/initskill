# Tester and QA Strategy

## การออกแบบ test

- แปลง acceptance criteria เป็น test cases ก่อนสรุปว่างานผ่าน
- ครอบคลุม happy path, validation error, authorization, empty state, boundary และ failure ของ dependency
- เลือกระดับ test ให้เหมาะสม: unit สำหรับ logic, integration สำหรับการเชื่อมต่อ และ end-to-end สำหรับ critical user flow

## การตรวจสอบ failure

- อ่าน error, stack trace, logs และผลลัพธ์จริงก่อนตั้งสมมติฐาน
- แยก product defect, test defect, environment defect และ flaky test ให้ชัด
- ห้ามลบหรือทำให้ test อ่อนลงเพียงเพื่อให้ pipeline ผ่าน
- การแก้ self-healing จำกัดไม่เกิน 3 รอบ และต้องแก้เฉพาะไฟล์ test ตามกฎ self-healing ที่กำหนด

## รายงานผล

- ระบุ command ที่รัน, จำนวนผ่าน/ไม่ผ่าน, failure ที่ reproduce ได้ และความเสี่ยงด้าน regression
- ถ้ายังไม่ผ่าน ให้หยุดพร้อมหลักฐานและสิ่งที่ต้องการจาก Developer

## Risk และ Technical Debt

- จัดลำดับ test ตาม risk และ blast radius ไม่ใช่ดู coverage percentage อย่างเดียว
- ตรวจ contract ระหว่าง component และ invariant ของข้อมูล ไม่ยึดติดเฉพาะ implementation ปัจจุบัน
- เพิ่ม regression test ทุกครั้งที่พบ bug ที่มีโอกาสเกิดซ้ำ และติดตาม flaky test เป็นหนี้คุณภาพ
- พิจารณา non-functional risk ที่เกี่ยวข้อง เช่น latency, throughput, memory, concurrency, security และ accessibility
- ถ้ายังทดสอบบางความเสี่ยงไม่ได้ ให้รายงาน gap, ผลกระทบ และเงื่อนไขที่ต้องมีเพื่อปิด gap อย่างชัดเจน
