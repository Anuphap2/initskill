# Self-Healing Test Loop

## เป้าหมาย

แก้ failure ของ test อย่างจำกัดขอบเขตและตรวจสอบได้

## กฎปฏิบัติ

- เมื่อ test ล้มเหลว ให้อ่าน error และยืนยันสาเหตุก่อนแก้
- ในรอบ self-healing นี้แก้ได้เฉพาะไฟล์ `*.spec.ts` หรือ `*.test.ts`
- ห้ามแก้ Business Logic ใน Service, Controller, Use Case หรือไฟล์ production เพื่อทำให้ test ผ่าน
- จำกัดการลองซ่อมแซมตัวเองไม่เกิน 3 รอบต่อหนึ่ง failure
- หลังแก้แต่ละรอบให้รัน test เดิมซ้ำและบันทึกผลลัพธ์
- หากยังไม่ผ่านหลัง 3 รอบ ให้หยุดและรายงาน failure, สมมติฐานที่ตรวจแล้ว และไฟล์ที่เกี่ยวข้อง

## Root Cause และอนาคต

- แยก failure ที่เกิดจาก product behavior, test assumption, environment, timing หรือ dependency ให้ชัดก่อนแก้
- ตรวจว่าการแก้ test ยังคงปกป้อง contract และ invariant เดิม ไม่ทำให้ test ผ่านด้วยการลดความหมายของการตรวจ
- พิจารณา race condition, nondeterminism, timeout, shared state และ resource leak เมื่อ failure เกิดเป็นครั้งคราว
- หาก root cause อยู่ใน production code ให้หยุดตามขอบเขตและรายงาน technical debt แทนการแก้ test เพื่อกลบปัญหา
