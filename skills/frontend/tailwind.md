# Tailwind CSS

- ใช้ utility classes ตาม design tokens ที่มีอยู่ก่อนสร้างค่าเฉพาะกิจ
- รักษา responsive behavior ตั้งแต่ mobile ขึ้นไป
- ตรวจสอบ contrast, focus state และ keyboard navigation ของ interactive elements

## Maintainability และ UX Debt

- ใช้ design token และ component boundary ที่สอดคล้องกัน เพื่อไม่ให้เกิดค่าระยะห่าง สี หรือ breakpoint กระจัดกระจาย
- ตรวจ computed style, specificity, bundle impact และ duplication เมื่อ class list ยาวหรือซับซ้อนผิดปกติ
- พิจารณา responsive state, content overflow, zoom, reduced motion, dark mode และภาษา/ข้อความที่ยาวขึ้น
- UI ที่ดูถูกต้องในกรณีปกติต้องยังใช้งานได้เมื่อ loading, error, empty, disabled และ keyboard-only
- ถ้าต้องใช้ค่าเฉพาะกิจ ให้บันทึกเหตุผลและพิจารณาว่าควรยกระดับเป็น token หรือ component ในอนาคตหรือไม่
