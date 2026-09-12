# CI/CD Pipeline Engineering

## Pipeline gates

- ตรวจให้ pipeline มีขั้นตอน install แบบ reproducible, lint, typecheck, test และ build ตามที่โปรเจกต์รองรับ
- ใช้คำสั่งเดียวกับ local development เมื่อทำได้ เพื่อลดความแตกต่างระหว่าง local กับ CI
- แยก fast feedback checks ออกจาก integration/e2e checks ที่ใช้เวลานาน
- กำหนด artifact, cache และ dependency version ให้ตรวจสอบย้อนกลับได้

## ความปลอดภัยและ deployment

- ห้าม hardcode secret, token, private key หรือ credential ในโค้ดและ workflow
- ตรวจ permissions ของ CI job ให้แคบที่สุด และใช้ environment protection กับ production
- ตรวจ migration, backward compatibility, health check และ rollback plan ก่อน deploy
- ห้ามข้าม required checks หรือปิด security gate โดยไม่มีเหตุผลและการอนุมัติ

## เมื่อ pipeline ล้มเหลว

- ระบุ stage ที่ล้มเหลว, log หลักฐาน, สาเหตุที่เป็นไปได้ และวิธี reproduce ใน local
- แก้สาเหตุที่แท้จริง ไม่ retry ซ้ำโดยไม่มีข้อมูลใหม่

## Reliability และ Technical Debt

- ออกแบบ pipeline ให้ deterministic, observable และ idempotent เท่าที่ทำได้ พร้อมแยก infrastructure failure ออกจาก product failure
- ตรวจ pipeline latency, cache correctness, flaky jobs, queue/resource limits และค่าใช้จ่ายเมื่อ repository หรือทีมโตขึ้น
- ทุก deployment ต้องมี health signal, timeout, rollback หรือ forward-fix strategy และ ownership ที่ชัดเจน
- หาก bypass gate หรือใช้ manual step ชั่วคราว ให้บันทึกเหตุผล ความเสี่ยง และเงื่อนไขที่จะเอาออก
- อย่าเพิ่ม stage, tool หรือ abstraction โดยไม่มีปัญหาที่วัดได้ว่าต้องแก้
