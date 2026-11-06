# Developer Implementation

## การค้นหาไฟล์และสำรวจสถาปัตยกรรม (ลดเวลาหาไฟล์ & ป้องกัน Context บวม)

- **Architecture First**: เริ่มต้นจากแผนผังโปรเจกต์เสมอ (`project-context.md`, `architecture.md`, `package.json`) เพื่อระบุ module boundary และ entry point ก่อนค้นหา
- **Targeted Discovery (ห้ามค้นหาแบบสุ่ม)**: ห้าม crawl หรือ recursive grep ทั้ง repository ให้ค้นหาเฉพาะ directory และ symbol ที่เกี่ยวข้องตรงจุด
- **Surgical Reading**: อ่านเฉพาะ function, class หรือ line range ที่จำเป็น ไม่โหลดทั้งไฟล์ขนาดใหญ่เข้าสู่ context เพื่อรักษา context window ไว้สำหรับการประมวลผลเชิงลึก
- **ป้องกัน Duplicate Code**: ก่อนแก้ไข ให้ตรวจดูไฟล์ที่เกี่ยวข้องในโมดูลเดียวกันเพื่อให้แน่ใจว่าฟังก์ชันการทำงานคล้ายกันยังไม่มีอยู่แล้ว และรักษา consistency ของ codebase

## การใช้ Tooling มาตรฐาน (ป้องกันการสร้าง Script แล้วพัง)

- **Deterministic Tooling First**: เรียกใช้คำสั่งหรือ npm scripts มาตรฐานของโปรเจกต์เสมอ (เช่น `npm test`, `npm run check`, standard CLI) ที่ผ่านการทดสอบมาแล้ว
- **หลีกเลี่ยง Fragile Ad-hoc Scripts**: ไม่เขียน one-off script สดๆ เพื่อรันงานที่มี tool รองรับอยู่แล้ว ป้องกันความผิดพลาดจาก cross-platform quirks (Windows PowerShell vs POSIX bash, path separators, encoding, missing packages)
- **Safe & Idempotent Execution**: หากจำเป็นต้องสร้าง utility script ชั่วคราว ต้องออกแบบให้เป็น idempotent, มี error handling ชัดเจน และไม่ทิ้ง artifact ตกค้าง

## ก่อนเริ่มและระหว่างพัฒนา

- อ่าน requirement, package scripts, README, architecture และโค้ดที่เกี่ยวข้องก่อนแก้
- ระบุ acceptance criteria และไฟล์ที่คาดว่าจะเปลี่ยน
- ถ้าพบ requirement ขัดแย้งหรือข้อมูลไม่พอ ให้ถามก่อนเดา
- เปลี่ยนโค้ดให้น้อยที่สุดและรักษา public API/behavior เดิมที่ไม่เกี่ยวข้อง
- ทำตาม conventions และ dependency ที่มีอยู่ก่อนเพิ่มของใหม่
- แยก business logic ออกจาก I/O, framework glue และ presentation ตาม architecture ของโปรเจกต์
- จัดการ error, validation, empty state และ boundary cases อย่างตั้งใจ
- ไม่ปิดบังปัญหาด้วยการปิด lint, ลดความเข้มงวดของ type หรือข้าม test

## การคิดแบบ Software Engineer

- ระบุ contract, invariant, state transition และ boundary ของ component ก่อนเลือก implementation
- เลือก data structure และ algorithm ให้เหมาะกับขนาดข้อมูล พร้อมพิจารณา time/space complexity และ hot path
- วิเคราะห์ผลกระทบระยะยาวต่อ coupling, cohesion, extensibility, observability, security และ operational cost
- แยก quick fix ที่จำเป็นออกจาก design ถาวร และบันทึก technical debt ที่ตั้งใจรับไว้
- ก่อนเพิ่ม abstraction ให้ยืนยันว่ามี behavior ซ้ำหรือ volatility จริง ไม่สร้าง framework ครอบโค้ดโดยไม่มีเหตุผล

## ก่อนส่งต่องาน

- รัน test ที่เกี่ยวข้องและตรวจ diff ด้วยตนเอง
- แสดงหลักฐานผลการรันคำสั่งจริง (Execution logs) ที่ผ่าน ไม่สรุปผลงานจากข้อสันนิษฐาน
- รายงานไฟล์ที่เปลี่ยน เหตุผล คำสั่งตรวจสอบ และข้อจำกัดที่ยังเหลือ
- ระบุ technical debt ใหม่หรือ debt ที่ค้นพบ พร้อมระดับความเสี่ยงและเงื่อนไขที่ควรกลับมาจัดการ
