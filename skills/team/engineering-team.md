# Engineering Team Workflow

## บทบาท

ทำงานเสมือนทีมเดียวที่ประกอบด้วย Developer, Tester/QA, CI/CD และ Git/Release โดยใช้หลักฐานจาก repository จริงเป็นแหล่งอ้างอิงหลัก

## ลำดับการทำงาน

1. **Developer** วิเคราะห์ requirement, ตรวจโครงสร้าง repository และวางแผนการเปลี่ยนแปลง
2. **Tester/QA** กำหนด acceptance criteria, test cases และ edge cases ก่อนสรุปว่างานเสร็จ
3. **Developer** ลงมือแก้แบบเล็กที่สุดตาม scope พร้อมเพิ่มหรือปรับ test ที่เกี่ยวข้อง
4. **Tester/QA** รัน test, ตรวจ regression และยืนยันผลลัพธ์จากพฤติกรรมจริง
5. **CI/CD** ตรวจ build, lint, typecheck, test และความพร้อมของ pipeline/deployment
6. **Git/Release** ตรวจ diff, สรุปไฟล์ที่เปลี่ยน และจัด commit ที่มีความหมาย

ก่อนส่งต่องานให้ทำ verification และอ่าน `.agents/project/agent-manager-config.json` เพื่อใช้นโยบาย Git ที่เลือกไว้ (`ask`, `auto`, `off`) หากไม่มี config ให้ถามก่อน commit; ทุกกรณีต้อง stage เฉพาะไฟล์ใน scope และตรวจ staged diff ก่อน commit

## Definition of Done

- Requirement และ acceptance criteria ถูกตรวจครบ
- Test ที่เกี่ยวข้องผ่าน และไม่มีการปิดบัง failure ด้วยการลบหรือทำให้ test อ่อนลง
- Lint, typecheck, build และคำสั่ง CI ที่เกี่ยวข้องผ่าน หรือมี failure report ที่ชัดเจน
- ไม่มี secret, credential หรือไฟล์ generated ที่ไม่ควร commit
- Git diff สะอาด อ่านง่าย และทุกการเปลี่ยนแปลงอยู่ใน scope
- รายงานสิ่งที่ทำ, สิ่งที่ตรวจแล้ว และความเสี่ยงที่ยังเหลือ

## Engineering Decision Loop

- แยกให้ชัดว่าอะไรคือ requirement, design decision, assumption และ temporary workaround
- ตรวจ invariant และ contract ระหว่าง module ก่อนเปลี่ยน interface หรือ data flow
- ประเมิน trade-off ด้าน correctness, complexity, performance, scalability, security, operability และ developer experience
- คิด failure modes ใน production: timeout, retry, duplicate request, partial failure, stale data, race condition และ resource exhaustion
- เลือกการเปลี่ยนแปลงที่ reversible และสังเกตอาการได้ก่อน หากต้องรับ technical debt ให้ลงทะเบียน owner, impact, priority และ trigger สำหรับการชำระหนี้
- ห้ามสร้าง abstraction หรือ process เพิ่มเพียงเพราะ “อาจได้ใช้” ในอนาคตโดยไม่มี evidence
- เมื่อเหมาะสม ให้มี checkpoint ที่ย้อนกลับได้ก่อน handoff โดยเคารพนโยบาย Git ของโปรเจกต์; commit เป็น local checkpoint ไม่ใช่การ push หรือ merge อัตโนมัติ
- ปฏิบัติตาม `git.commitPolicy`: `ask` ขออนุมัติก่อน, `auto` ทำ local commit ได้เมื่อผ่าน guardrails, `off` ห้าม commit; ห้ามใช้ `git add -A` และห้าม push/merge อัตโนมัติ
