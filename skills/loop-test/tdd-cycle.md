# TDD Cycle

## วงจรการพัฒนาพร้อมหลักฐานจริง (Verifiable TDD Cycle)

1. **Red**: เขียนหรือปรับ test ให้สะท้อน Acceptance Criteria (AC) ก่อนเสมอ รันคำสั่งจริงและยืนยันว่า test ล้มเหลวด้วยเหตุผลที่ถูกต้อง (ห้ามข้ามขั้นตอนหรือสมมติว่า fail เอง)
2. **Green**: เขียนโค้ด production ขั้นต่ำให้ test ผ่าน รันคำสั่งจริงเพื่อยืนยันผลการทดสอบผ่านด้วย terminal output
3. **Refactor**: ปรับปรุงโครงสร้างโค้ด รักษาความสะอาดและลด complexity โดยรัน test ซ้ำเพื่อให้มั่นใจว่าไม่มี regression

## กฎปฏิบัติป้องกัน Fake Done

- **ต้องมีผลการรันจริงยืนยัน**: ห้ามข้ามขั้นตอนการเขียนและรัน test เมื่อเพิ่ม behavior ใหม่
- **ห้ามติ๊กว่าผ่านโดยไม่มี log**: ทุกขั้นตอนของรอบ TDD ต้องมี execution log และ exit code ยืนยัน
- **ตรวจพฤติกรรมจริง (Behavior-focused)**: Test ต้องตรวจ behavior ที่ผู้ใช้หรือระบบต้องการ ไม่ผูกกับ implementation โดยไม่จำเป็น
- **ห้ามลดความเข้มงวดของ assertion**: ห้ามแก้ test ให้อ่อนลงเพื่อให้ผ่านหลอกๆ

## Design Quality

- เขียน test ให้สะท้อน behavior, contract และ invariant ที่มีคุณค่าต่อผู้ใช้ ไม่ล็อก implementation โดยไม่จำเป็น
- ใช้ failure ของ test เพื่อค้นหาปัญหาใน model หรือ design ไม่ใช่แค่แก้ assertion ให้ผ่าน
- ระหว่าง refactor ตรวจ complexity, coupling, state management และผลกระทบต่อ test อื่น
- ถ้า test ยากเกินไป ให้พิจารณา boundary และ dependency design ก่อนเพิ่ม mock จำนวนมาก
- บันทึก test gap และ technical debt แทนการแกล้งทำให้ coverage หรือ test result ดูดี
