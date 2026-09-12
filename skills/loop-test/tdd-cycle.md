# TDD Cycle

## วงจรการพัฒนา

1. เขียนหรือปรับ test ให้บอก behavior ที่ต้องการก่อน
2. รัน test และยืนยันว่า test ล้มเหลวด้วยเหตุผลที่ถูกต้อง (Red)
3. เขียนโค้ด production ขั้นต่ำให้ test ผ่าน (Green)
4. Refactor โดยรักษา test ให้ผ่าน และตรวจสอบ test ซ้ำ

## กฎปฏิบัติ

- ห้ามข้ามขั้นตอนการเขียน test เมื่อเพิ่ม behavior ใหม่
- Test ต้องตรวจ behavior ที่ผู้ใช้หรือระบบต้องการ ไม่ผูกกับ implementation โดยไม่จำเป็น
- ทุกการเปลี่ยนแปลงต้องจบด้วยผลการตรวจสอบที่รายงานได้

## Design Quality

- เขียน test ให้สะท้อน behavior, contract และ invariant ที่มีคุณค่าต่อผู้ใช้ ไม่ล็อก implementation โดยไม่จำเป็น
- ใช้ failure ของ test เพื่อค้นหาปัญหาใน model หรือ design ไม่ใช่แค่แก้ assertion ให้ผ่าน
- ระหว่าง refactor ตรวจ complexity, coupling, state management และผลกระทบต่อ test อื่น
- ถ้า test ยากเกินไป ให้พิจารณา boundary และ dependency design ก่อนเพิ่ม mock จำนวนมาก
- บันทึก test gap และ technical debt แทนการแกล้งทำให้ coverage หรือ test result ดูดี
