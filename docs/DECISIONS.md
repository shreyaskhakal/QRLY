# Architecture Decision Records (ADRs) - QR Print Kiosk (QRLY)

## 1. Overview & Decision Framework
All key architectural and technical trade-offs are documented here using the Architecture Decision Record (ADR) framework. When trade-offs or ambiguities arise during implementation, the default specified in `MASTER_PROMPT.md` is selected, recorded here, and adhered to across all subagents.

---

## 2. Active Decision Records

### ADR-001: Next.js App Router for Unified Web & API
- **Context**: The kiosk requires high-performance mobile web pages for customers, a desktop dashboard for shop owners, and low-latency API route handlers for webhook processing and print agent communication.
- **Decision**: Standardize on Next.js 15+ (App Router) with TypeScript in strict mode.
- **Rationale**: Single unified repository for UI components and server route handlers; server-side rendering for instant mobile initial page loads; seamless deployment to Vercel.
- **Status**: Accepted.

---

### ADR-002: Integer Paise Currency Representation (Zero-Float Policy)
- **Context**: Currency calculations using standard IEEE-754 floating-point types (`0.1 + 0.2 = 0.30000000000000004`) lead to compounding rounding errors, database discrepancies, and payment gateway rejection.
- **Decision**: All financial amounts in database schemas, API payloads, internal functions, and Razorpay interactions are strictly represented as 64-bit integer paise (1 INR = 100 paise).
- **Rationale**: Eliminates rounding inconsistencies; matches Razorpay's native API contract; enforces deterministic integer math.
- **Status**: Accepted.

---

### ADR-003: Pure Server-Side Pricing Engine
- **Context**: Client-side pricing calculations are vulnerable to tampering, stale configuration data, and network manipulation.
- **Decision**: Centralize all pricing in a pure, deterministic TypeScript function `calculatePrice(file, shop)` utilized exclusively by server route handlers. Any price submitted by the browser is strictly ignored.
- **Rationale**: Guarantees single source of truth; prevents revenue loss; provides 100% testable logic.
- **Status**: Accepted.

---

### ADR-004: Dual-Channel Verified Deletion Protocol
- **Context**: Privacy is a core value proposition of QRLY. Users must have verified proof that their personal documents are deleted upon printing.
- **Decision**: Deletion is only confirmed to the customer when:
  1. The cloud storage object in Supabase is deleted AND a subsequent lookup returns 404 (`delete_verified = true`).
  2. The local print agent reports that its temporary files (original, sliced, grayscale) were deleted from disk (`localFileDeleted: true`).
- **Rationale**: Ensures the green deletion card ("Your files have been deleted from our servers at <time>") reflects cryptographic truth, never an unverified assumption.
- **Status**: Accepted.

---

### ADR-005: Ghostscript DeviceGray Conversion for B&W Jobs
- **Context**: Sending a color PDF to a printer with only a driver-level monochrome flag often results in printer drivers using color cartridges to simulate "rich black" (composite black), causing unintended color ink consumption.
- **Decision**: For all black-and-white print jobs, the print agent explicitly runs Ghostscript with `-dProcessColorModel=/DeviceGray` to convert the PDF into pure 8-bit grayscale before sending to the print spooler.
- **Rationale**: Guarantees CMY ink coverage is exactly 0.00000%, saving expensive color ink for the print shop owner.
- **Status**: Accepted.

---

### ADR-006: Atomic Job Claiming via PostgreSQL `FOR UPDATE SKIP LOCKED`
- **Context**: In multi-agent or concurrent worker configurations, multiple agents might poll for queued jobs simultaneously, risking race conditions and duplicate prints.
- **Decision**: Encapsulate job claiming in a PL/pgSQL function (`claim_next_job`) utilizing `SELECT id FROM print_jobs ... FOR UPDATE SKIP LOCKED` with a 120-second lease timeout.
- **Rationale**: Eliminates race conditions at the database engine level without distributed locking services like Redis.
- **Status**: Accepted.

---

### ADR-007: Outbound-Only HTTPS Polling for Local Print Agent
- **Context**: Print shops operate on consumer or shared commercial Wi-Fi with dynamic IPs, strict NATs, and no public port forwarding.
- **Decision**: The print agent runs as a local daemon making only outbound HTTPS requests (heartbeat every 15s, claim poll every 3s) to the Next.js API.
- **Rationale**: Zero firewall configuration; no router changes needed; completely secure against incoming network scanning.
- **Status**: Accepted.

---

### ADR-008: Ephemeral Customer Authentication via Salted Guest Secret Hash
- **Context**: Customers must not be burdened with sign-up forms or passwords, but unauthorized users must not be able to view or manipulate another customer's order.
- **Decision**: Issue a cryptographically random `guestSecret` when an order is created. Persist only the SHA-256 hash (`guest_secret_hash`) in the database. Customer sends raw secret in `x-order-secret` header.
- **Rationale**: Frictionless mobile customer experience while preventing URL enumeration attacks on `/o/{orderId}`.
- **Status**: Accepted.

---

### ADR-009: Raw Request Body Webhook Signature Verification
- **Context**: Standard Express / Next.js body parsers convert request streams to JSON objects, which alters whitespace and key order, causing Razorpay HMAC SHA-256 signature checks to fail.
- **Decision**: Read raw request body as text via `await req.text()` in the Next.js App Router route handler before performing HMAC verification.
- **Rationale**: Guarantees byte-for-byte fidelity with the payload signed by Razorpay.
- **Status**: Accepted.

---

### ADR-010: Native Tooling Split (CUPS on Linux/macOS vs SumatraPDF on Windows)
- **Context**: Different operating systems have distinct command-line print interfaces. Linux/macOS has CUPS `lp`, while Windows lacks native CLI PDF spooling flags.
- **Decision**: Support CUPS `lp` on Linux/macOS (defaulting to Raspberry Pi OS) and SumatraPDF CLI on Windows.
- **Rationale**: Maximizes compatibility across shop hardware without requiring proprietary vendor SDKs.
- **Status**: Accepted.

---

### ADR-011: Hardware Dry-Run Mode (`PRINT_DRY_RUN=true`)
- **Context**: Automated testing, continuous integration, and local development should not consume real paper and ink.
- **Decision**: Implement a dry-run flag in the print agent that performs all downloading, page slicing, and grayscale conversions, but saves the final output to `./out/{jobId}.pdf` instead of dispatching to the printer.
- **Rationale**: Allows comprehensive end-to-end verification and automated testing of print options with zero paper waste.
- **Status**: Accepted.

---

### ADR-012: Deferral of DOCX/PPTX Conversion to Phase 2
- **Context**: Converting Microsoft Office formats (DOCX, PPTX) requires LibreOffice or Microsoft Word binaries, which cannot execute within serverless edge environments (Vercel).
- **Decision**: Scope MVP exclusively to PDF, JPG, and PNG. Defer Office document conversion to Phase 2, which will utilize a dedicated Docker worker container running headless LibreOffice.
- **Rationale**: Keeps MVP lean, robust, and cost-effective without infrastructure bloat.
- **Status**: Accepted.

---

## 3. Open Questions
1. *Agent Communication Protocol Evolution*: If shop volume scales significantly, should the 3-second HTTPS polling loop be replaced with Server-Sent Events (SSE) or a persistent WebSocket connection? (For MVP, 3s HTTP polling uses minimal bandwidth and handles disconnects naturally).
