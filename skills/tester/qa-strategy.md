# Tester and QA Strategy

## กฎเหล็กป้องกัน "ติ๊กว่าครบ ทั้งที่ไม่ครบ" (Anti-Fake-Done & Verification)

- **ต้องมีหลักฐานเชิงประจักษ์ (Hard Execution Evidence)**: ห้ามเคลมว่างานเสร็จสิ้น หรือติ๊กถูกใน Checklist เพียงเพราะคิดว่าโค้ดน่าจะทำงานได้ ทุกการยืนยันต้องแนบผลลัพธ์คำสั่งจริง (command execution logs, exit code 0, test runner output) เสมอ
- **การตรวจสอบอย่างเป็นอิสระ (Independent Verification)**: ผู้เขียนโค้ด (Developer) ห้ามเป็นผู้รับรองผลงานของตนเองเพียงลำพัง ในระบบ Multi-Agent ผู้ทำหน้าที่ QA/Reviewer จะต้องเป็นผู้ตรวจสอบผลการทดสอบจริงตาม Acceptance Criteria (AC) แบบข้อต่อข้อ
- **ห้ามทำให้ Test อ่อนลง (No Softened Assertions)**: ห้ามลบ test assertion, ห้ามข้าม error check หรือปิด lint/typecheck เพื่อแกล้งให้ pipeline ผ่าน การแก้ไขต้องแก้ที่ root cause ของปัญหาเท่านั้น

## การออกแบบ test

- แปลง acceptance criteria แต่ละข้อเป็น test cases อย่างเคร่งครัดก่อนสรุปว่างานผ่าน
- ครอบคลุม happy path, validation error, authorization, empty state, boundary และ failure ของ dependency
- เลือกระดับ test ให้เหมาะสม: unit สำหรับ logic, integration สำหรับการเชื่อมต่อ และ end-to-end สำหรับ critical user flow

## การตรวจสอบ failure

- อ่าน error, stack trace, logs และผลลัพธ์จริงก่อนตั้งสมมติฐาน
- แยก product defect, test defect, environment defect และ flaky test ให้ชัด
- การแก้ self-healing จำกัดไม่เกิน 3 รอบ และต้องแก้เฉพาะไฟล์ test ตามกฎ self-healing ที่กำหนด

## รายงานผลพร้อมหลักฐาน (Evidence Reporting)

- แสดง command ที่รัน, terminal output จริง, จำนวนผ่าน/ไม่ผ่าน, failure ที่ reproduce ได้ และความเสี่ยงด้าน regression
- หากการทดสอบยังไม่ผ่าน ให้หยุดทันทีพร้อมหลักฐาน stack trace และสิ่งที่ต้องการให้ Developer ปรับแก้

## Risk และ Technical Debt

- จัดลำดับ test ตาม risk และ blast radius ไม่ใช่ดู coverage percentage อย่างเดียว
- ตรวจ contract ระหว่าง component และ invariant ของข้อมูล ไม่ยึดติดเฉพาะ implementation ปัจจุบัน
- เพิ่ม regression test ทุกครั้งที่พบ bug ที่มีโอกาสเกิดซ้ำ และติดตาม flaky test เป็นหนี้คุณภาพ
- พิจารณา non-functional risk ที่เกี่ยวข้อง เช่น latency, throughput, memory, concurrency, security และ accessibility
- ถ้ายังทดสอบบางความเสี่ยงไม่ได้ ให้รายงาน gap, ผลกระทบ และเงื่อนไขที่ต้องมีเพื่อปิด gap อย่างชัดเจน
