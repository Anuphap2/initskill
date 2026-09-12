# NestJS Conventions

- แยก Controller, Service, Module และ DTO ตามหน้าที่ของแต่ละชั้น
- ตรวจสอบ input ผ่าน DTO และ validation pipe ก่อนเข้าสู่ business logic
- ให้ Service รับผิดชอบ business logic; Controller ทำหน้าที่รับส่ง request/response
- เพิ่ม unit test สำหรับ behavior สำคัญและ integration test สำหรับขอบเขต module ที่จำเป็น

## Design และ Technical Debt

- กำหนด module boundary และ dependency direction ให้ชัด หลีกเลี่ยง circular dependency และ Service ที่ทำหลายหน้าที่
- แยก domain rule จาก transport concern เพื่อให้ business logic ทดสอบและย้าย framework ได้ง่ายขึ้น
- กำหนด error contract, transaction boundary, timeout และ idempotency สำหรับ operation ที่แตะ external system
- พิจารณา query complexity, N+1, memory usage และผลกระทบเมื่อข้อมูลหรือ traffic โตขึ้น
- ก่อนเพิ่ม shared utility หรือ base class ให้ยืนยันว่าความซ้ำและ invariant ร่วมกันมีจริง
- ถ้าต้องเปลี่ยน DTO, API หรือ event ให้พิจารณา backward compatibility และลำดับการ rollout
