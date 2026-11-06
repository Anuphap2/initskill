# Production Observability and Health

## Contract

Apply this skill when implementing, reviewing, or configuring health checks, graceful shutdown, container lifecycle probes, structured logging, distributed tracing, metrics, or error tracking.

## กฎเหล็กความพร้อมของระบบและการสังเกตการณ์ (Production Readiness)

- **Liveness & Readiness Probes แยกจากกันอย่างชัดเจน**:
  - **Liveness Probe (`/healthz` หรือ `/live`)**: ตรวจสอบเฉพาะว่า process ภายในยังทำงานและไม่เกิด deadlock (ห้ามเช็ค external database หรือ downstream services ใน liveness เพราะถ้า DB ช้า Kubernetes จะฆ่า pod ทุกตัวทิ้งจน cascading failure)
  - **Readiness Probe (`/readyz` หรือ `/ready`)**: ตรวจสอบว่าแอปพลิเคชันพร้อมรับ traffic จริง (ตรวจสอบ database connection pool, cache, และ downstream dependencies ที่จำเป็น)
- **Graceful Shutdown อย่างสมบูรณ์**:
  - ดักจับสัญญาณ `SIGTERM` และ `SIGINT`
  - เมื่อได้รับสัญญาณ ให้สลับ Readiness Probe เป็น unready ทันที เพื่อให้ Ingress/Load Balancer หยุดส่ง traffic ใหม่
  - รอเคลียร์ request ที่ค้างอยู่ (Drain in-flight requests) ภายใน timeout ที่กำหนด (เช่น 15-30 วินาที)
  - ปิด database connection pools, message broker subscriptions, และ background workers ให้เรียบร้อยก่อนเรียก `process.exit(0)`
- **Structured JSON Logging**:
  - บันทึก logs ในรูปแบบ JSON มาตรฐาน (ห้ามใช้ plain string `console.log` ที่ parse ยากใน production)
  - ทุกล็อกต้องมี metadata ขั้นต่ำ: `timestamp` (ISO 8601), `level` (DEBUG/INFO/WARN/ERROR), `message`, `service`, และ `environment`
  - แนบ Context Correlation ID: `trace_id` / `request_id` ในทุกล็อกเพื่อ trace ข้าม microservices ได้
  - ห้ามพิมพ์ PII, บัตรเครดิต, รหัสผ่าน หรือ tokens ใน logs เด็ดขาด
- **Resilience & Timeouts**:
  - ทุกการเรียก external I/O (HTTP requests, Database, Redis, Third-party APIs) ต้องมี timeout กำกับเสมอ (ห้ามปล่อย default ให้แขวนตลอดกาล)
  - การ retry ต้องใช้ Exponential Backoff พร้อม Jitter และกำหนด max attempts ชัดเจน เพื่อป้องกัน Thundering Herd Problem

## Procedure การตรวจรับระบบก่อน Deploy

1. ตรวจสอบ endpoint `/healthz` และ `/readyz` ว่าคืน status HTTP 200 อย่างถูกต้อง
2. ทดสอบจำลองส่งสัญญาณ `kill -15` (SIGTERM) แล้วดูว่า server ปิด connection อย่างนุ่มนวล ไม่ทิ้ง 502 Bad Gateway
3. ตรวจสอบ log output ว่าเป็น valid JSON และมี correlation ID กำกับ
4. ยืนยันว่า unhandled exceptions และ unhandled promise rejections ถูกดักจับและส่งไปยัง Error Monitoring (เช่น Sentry) พร้อม clean shutdown

## Verification

- แสดงตัวอย่าง structured log ที่มี trace ID และไม่มี sensitive data
- แสดงผลการทดสอบ graceful shutdown และผลลัพธ์ของ readiness/liveness checks
