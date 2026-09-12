# Next.js App Router

- ใช้ Server Components เป็นค่าเริ่มต้น และเพิ่ม `use client` เฉพาะ component ที่ต้องใช้ browser state หรือ event
- แยก loading, error และ not-found states สำหรับ route ที่ทำ data fetching
- รักษา data fetching และ mutation ให้สอดคล้องกับ caching/revalidation strategy ของโปรเจกต์

## Engineering Reasoning: Architecture และ Performance

- กำหนด ownership ของ state, data fetching และ mutation ให้ชัดระหว่าง Server/Client boundary
- วิเคราะห์ cache key, freshness, invalidation และ race condition เพื่อป้องกัน stale หรือ inconsistent UI
- พิจารณา latency, waterfall request, bundle size, hydration cost และจำนวน re-render ใน critical path
- ออกแบบ loading, error และ retry behavior ให้ไม่ทำให้ state สูญหายหรือเกิด duplicate mutation
- รักษา URL, API contract และ behavior เดิมเมื่อทำ refactor เพื่อไม่สร้าง migration debt ให้ผู้ใช้
- เพิ่ม client-side abstraction เท่าที่จำเป็น และอย่าใช้ global state เพื่อแก้ปัญหาที่เป็น local state
