# Product Requirements Document (PRD) - QR Print Kiosk (QRLY)

## 1. Executive Summary & Problem Statement
Traditional printing in print shops, university campuses, libraries, and co-working spaces is slow, manual, and introduces severe privacy risks. Customers typically queue up, physically plug in personal USB drives or forward private documents (such as IDs, tax forms, confidential contracts, or academic papers) over WhatsApp or email to print shop attendants. Shop staff must manually configure page ranges, color options, and calculate charges before collecting cash or manual UPI payments.

**QR Print Kiosk (QRLY)** automates this end-to-end workflow:
1. A customer scans a dedicated QR code on the printer kiosk (`/p/{shopSlug}`).
2. Directly in mobile web (no account creation, no app download), the customer uploads files, configures printing parameters per file, and views an immutable server-calculated quote.
3. The customer pays instantly via UPI (powered by Razorpay Checkout).
4. Upon verified payment webhook arrival, the print job is automatically dispatched to the kiosk printer via an outbound-polling local print agent.
5. The customer tracks progress in real time (token number, queue position) and collects their printed sheets directly from the tray.
6. **Privacy by Default**: Files are permanently deleted from both cloud storage and local agent storage immediately after printing, with cryptographic verification and real-time deletion confirmation displayed to the customer.

---

## 2. Target Personas & User Journeys

### 2.1 The Anonymous Mobile Customer
- **Environment**: Mobile browser (iOS Safari, Android Chrome), mobile data or shop Wi-Fi.
- **Pain Points**: Long lines, having staff browse their files, awkward payment steps, delayed pickup.
- **Goals**: Scan, upload, pay, and get prints in under 60–90 seconds with absolute privacy guarantees.
- **Key Characteristics**: Anonymous; no account or password; identified only by an ephemeral guest secret; expects clear feedback and live order tracking.

### 2.2 The Print Shop Owner / Attendant
- **Environment**: Desktop or tablet web browser at the store counter.
- **Pain Points**: Congestion at counters, handling manual USB transfers, resolving pricing disputes, handling printer jams manually while customers wait.
- **Goals**: Monitor the real-time queue, view daily revenue and page volume, adjust pricing rules, pause printing during paper reload, and handle reprints or refunds with one click.

---

## 3. Product Scope

### 3.1 In Scope (MVP)
1. **Dedicated Kiosk Entry Point**: Dynamic QR code URL `/p/{shopSlug}` displaying shop identity, real-time printer availability, and active queue length.
2. **File Ingestion**:
   - Supports PDF, JPG, and PNG formats.
   - Up to 5 files per order.
   - Max 25 MB per file.
   - Max 100 pages per order total.
   - Strict server-side validation of MIME types, magic bytes, and integrity.
3. **Per-File Print Options**:
   - Color Mode: Black & White (Grayscale) or Full Color.
   - Print Quality: Draft (1.0x multiplier), Normal (1.0x multiplier), High (1.5x multiplier).
   - Copies: 1 to 50 copies.
   - Page Selection: All pages or custom range (e.g., `1-3, 5, 8-10`) with live validation against server-detected page count.
   - Page Sides: Single-sided (Simplex) or Double-sided (Duplex - long-edge).
4. **Authoritative Pricing Engine**:
   - Server-only computation; client-submitted prices are strictly ignored.
   - Stored in integer paise (1 INR = 100 paise) to prevent float inaccuracies.
   - Configurable base rates per shop.
   - Minimum order amount of 100 paise (Rs 1.00).
5. **Seamless UPI Payment**:
   - Razorpay Checkout integration supporting all UPI apps (GPay, PhonePe, Paytm, BHIM, Cred).
   - Server-side order generation and webhook signature verification using HMAC SHA256.
   - Idempotent processing of payment events.
6. **Outbound Automated Printing**:
   - Lightweight Python print agent running on the shop machine.
   - Zero inbound open ports; communicates exclusively via HTTPS outbound polling (every 3 seconds).
   - Hardware printer integration via CUPS `lp` on Linux/macOS and SumatraPDF on Windows.
   - Hardware dry-run mode (`PRINT_DRY_RUN=true`) writing processed PDFs to `./out` for zero-paper development.
7. **Live Order Status & Verification**:
   - Status page `/o/{orderId}` updating via Supabase Realtime (Paid -> Queued -> Printing -> Done / Failed).
   - Daily formatted Token Number (e.g., `A-042`).
   - Real-time queue position display.
8. **Shop Owner Dashboard**:
   - Supabase Auth protected.
   - Summary telemetry: Today's revenue, completed jobs, total pages printed, printer connectivity status.
   - Live queue table with Reprint and Refund actions.
   - Pricing and operational settings editor (pause printing toggle, per-page rates, expiry).
   - Agent API key generation and rotation.
   - High-resolution QR code generator with downloadable/printable assets.
9. **Verified File Deletion Protocol**:
   - Automatic deletion of private cloud storage objects upon print completion or order expiry.
   - Local agent deletion of all temp files (original, sliced, grayscale copies).
   - Customer UI displays explicit verified deletion timestamp: *"Your files have been deleted from our servers at 12:31 PM."*

### 3.2 Out of Scope (Deferred to Future Phases)
- User accounts / login for customers.
- Loyalty programs, discount coupons, or referral codes.
- Multi-printer routing inside a single shop.
- Physical scanning, photocopying, or OCR services.
- Document finishing (binding, lamination, stapling).
- Native mobile applications (iOS/Android).
- Automated GST invoices (simple digital receipt provided for MVP).
- DOCX/PPTX file conversion (deferred to Phase 2 with dedicated containerized LibreOffice worker).

---

## 4. Pricing & Business Rules

### 4.1 Default Pricing Matrix (Stored in Integer Paise)
| Parameter | Default Value | Notes |
| :--- | :--- | :--- |
| Black & White Rate (`bw_price_paise`) | 200 paise (Rs 2.00) | Per page |
| Color Rate (`color_price_paise`) | 1000 paise (Rs 10.00) | Per page |
| Quality Multiplier: Draft | 1.00 | Standard toner/ink density |
| Quality Multiplier: Normal | 1.00 | Default print setting |
| Quality Multiplier: High | 1.50 | High DPI / saturated presentation |
| Double Sided (Duplex) | Same per-page rate | Each printed side counts as one page billable |

### 4.2 Exact Pricing Formula
For each file $i$ in an order:
$$\text{Price}_i = \left\lceil \text{SelectedPages}_i \times \text{Copies}_i \times \text{BaseRate}(\text{ColorMode}_i) \times \text{Multiplier}(\text{Quality}_i) \right\rceil$$

Order total:
$$\text{TotalPaise} = \max\left(100, \sum_{i=1}^{N} \text{Price}_i\right)$$

All rounding occurs upward to the nearest integer paise. Floating-point types are strictly forbidden in persistence, transmission, and calculations.

### 4.3 Core Business Guarantees
1. **No Payment, No Print**: Printing actions are mechanically impossible without a cryptographically verified webhook event from Razorpay.
2. **Kiosk Availability Guard**: If the shop's printer is offline (no heartbeat within 45 seconds) or flagged as paused (`accepting_orders = false`), customers are prevented from checking out. A clear banner is presented explaining that the printer is temporarily unavailable.
3. **Automatic Single Retry on Error**: If a print job encounters a transient error (e.g., driver glitch, download timeout), the agent retries once. If it fails again, the job transitions to `failed` and alerts the owner for manual reprint or refund.
4. **Order Expiry**: Unpaid draft orders expire strictly after 30 minutes. The cleanup sweeper purges unreferenced storage files immediately.
5. **Double Print Prevention**: A local marker file `state/printed-<jobId>` is written immediately before physical output. If the agent crashes or restarts, it inspects the marker file and reports `done` without duplicating paper prints.

---

## 5. Non-Functional Requirements & Success Metrics

### 5.1 Success Metrics
- **Transaction Speed**: Customer scan-to-paid completed in $< 90$ seconds for 80% of users.
- **Print Latency**: Time from payment confirmation to physical print dispatch $< 15$ seconds under an empty queue.
- **Integrity**: Exactly 0 duplicate prints; exactly 0 prints without verified payment capture.
- **Privacy Compliance**: 100% of temporary files purged within 5 minutes of print completion or order expiry.

### 5.2 Performance & Scalability
- **Page Load Time**: Customer mobile pages load in $< 1.5$ seconds over 4G mobile connections.
- **Concurrent Load**: Kiosk API handles up to 20 concurrent orders per shop without queue deadlocks or race conditions.
- **Agent Polling Overhead**: Negligible network overhead (< 1 KB payload per 3-second heartbeat/claim poll).

### 5.3 Reliability & Fault Tolerance
- Graceful reconnection of agent when Wi-Fi drops.
- Resilient webhook intake with immediate 200 OK responses to prevent provider retries.
- Webhook idempotency via unique database constraints on `razorpay_event_id`.

---

## 6. Open Questions
1. *Hardware Tray Sensing*: Can consumer ink-tank printers reliably report physical paper-out vs paper-jam status over USB CUPS, or will certain budget printers report a generic "error"?
2. *Customer Reconnection*: If a customer closes their browser tab before viewing the token, how should they retrieve their token if they didn't bookmark `/o/{orderId}`? (Currently relying on the Razorpay receipt notes and shop owner queue lookup by file name / time).
3. *Split Payouts*: When onboarding multiple distinct shop owners in production, will Razorpay Route or Linked Accounts be used, or will all payments initially flow into a platform account with periodic payouts?
