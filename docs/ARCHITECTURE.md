# System Architecture - QR Print Kiosk (QRLY)

## 1. System Overview & Component Diagram

The QR Print Kiosk platform consists of seven decoupled components designed for high security, zero incoming port exposure at the print shop, and atomic state synchronization between web clients and physical hardware.

```mermaid
flowchart TD
    subgraph Clients["Client Layer"]
        CustomerPhone["Customer Phone (Mobile Web)\nScan, Upload, Configure, Pay"]
        OwnerBrowser["Shop Owner Browser\nDashboard, Live Queue, Config"]
    end

    subgraph Payments["External Services"]
        Razorpay["Razorpay Gateway\nUPI Checkout & Webhook Engine"]
    end

    subgraph CloudHosting["Cloud Application Layer (Vercel)"]
        WebApp["Next.js Web App & API\nRoute Handlers, Zod Validation,\nPricing Engine, Webhook Verifier, Sweeper"]
    end

    subgraph DataLayer["Managed Backend (Supabase Cloud)"]
        Postgres["PostgreSQL Database\nRLS, Atomic Procedures, Counters"]
        Storage["Private Storage Bucket\nTemporary File Objects"]
        Realtime["Realtime Engine\nPostgres Change Subscriptions"]
        Auth["Supabase Auth\nShop Owner Credentials"]
    end

    subgraph ShopPremises["Shop Hardware Environment (Local Network)"]
        PrintAgent["Print Agent (Shop PC / Raspberry Pi)\nPython 3.11 Daemon, Outbound Polling (3s),\nFile Prep (qpdf, Ghostscript)"]
        Printer["Physical Printer\nCUPS (Linux/macOS) / SumatraPDF (Windows)"]
    end

    CustomerPhone -->|"HTTPS (Upload, Options, Pay)"| WebApp
    OwnerBrowser -->|"HTTPS (Dashboard, Auth, Controls)"| WebApp
    WebApp -->|"Create Order, Verify Webhook"| Razorpay
    Razorpay -->|"Signed Webhook (HMAC SHA256)"| WebApp
    WebApp -->|"Service Role Key (CRUD, Storage)"| Postgres
    WebApp -->|"Signed Upload/Download URLs"| Storage
    WebApp -->|"Publish Changes"| Realtime
    Realtime -->|"WebSocket Live Updates"| CustomerPhone
    Realtime -->|"WebSocket Live Updates"| OwnerBrowser
    OwnerBrowser -->|"Auth Tokens"| Auth
    PrintAgent -->|"HTTPS Outbound Poll & Heartbeat (Bearer Token)"| WebApp
    PrintAgent -->|"Download File (5-min Signed URL)"| Storage
    PrintAgent -->|"Local Print Spooler (lp / SumatraPDF)"| Printer
```

### Key Architectural Boundaries
1. **Zero Inbound Ports on Shop Network**: The print shop PC/Pi resides behind typical NAT/routers. It **never** exposes an open port or web server. All communication between the print agent and cloud infrastructure happens via outbound HTTPS requests to `/api/agent/*`.
2. **Untrusted Client Boundary**: Customer browsers never talk directly to Postgres or cloud storage without signed, time-limited tokens. Prices, page counts, and state transitions are strictly governed by the Next.js API layer.
3. **Storage Isolation**: The Supabase Storage bucket `uploads` is strictly private. Files can only be uploaded and downloaded via short-lived signed URLs (5-minute TTL).
4. **Authority Separation**: The database tables have Row Level Security (RLS) enabled. The Supabase `anon` public key has zero table permissions. Server route handlers interact using the privileged `service_role` key, which is kept entirely server-side.

---

## 2. Order and Payment Sequence Flow

The end-to-end lifecycle guarantees that no document can ever reach the printer without a cryptographically verified Razorpay payment.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (Mobile Web)
    participant Web as Web API (Next.js)
    participant DB as Postgres (Supabase)
    participant Storage as Private Bucket (Supabase)
    participant Razorpay as Razorpay API & Webhook
    participant Agent as Print Agent (Shop PC)
    actor Printer as Physical Printer

    Note over Customer, Web: 1. Ingestion & Options
    Customer->>Web: POST /api/orders (shopSlug)
    Web->>DB: Insert Order (status: draft, guest_secret_hash)
    Web-->>Customer: orderId, guestSecret
    Customer->>Web: POST /api/orders/{id}/files (metadata)
    Web-->>Customer: Signed Upload URL (5-min TTL), fileId
    Customer->>Storage: Direct PUT (File binary)
    Customer->>Web: POST /api/orders/{id}/files/{fileId}/complete
    Web->>Storage: Verify magic bytes & extract exact page count
    Web->>DB: Update order_files (page_count)
    Customer->>Web: PATCH /api/orders/{id}/files/{fileId} (options)
    Web->>DB: Recalculate selected_pages & price_paise
    Web-->>Customer: Updated order total (paise)

    Note over Customer, Razorpay: 2. Checkout & Verification
    Customer->>Web: POST /api/orders/{id}/checkout
    Web->>DB: Check printer heartbeat & lock total_paise
    Web->>Razorpay: Create Razorpay Order (total_paise)
    Razorpay-->>Web: razorpay_order_id
    Web->>DB: Update order (status: awaiting_payment)
    Web-->>Customer: razorpay_order_id, keyId
    Customer->>Razorpay: Open Razorpay UPI Modal & Authorize Payment
    Razorpay-->>Customer: Payment Successful UI

    Note over Razorpay, DB: 3. Authoritative Webhook Intake
    Razorpay->>Web: POST /api/webhooks/razorpay (signed event)
    Web->>Web: Verify HMAC SHA256 Signature
    Web->>DB: Insert payment_events (idempotency check)
    Web->>DB: Transaction: set order to 'paid', assign daily token, insert print_jobs (queued)
    Web-->>Razorpay: 200 OK

    Note over Customer, DB: 4. Realtime Status Tracking
    DB-->>Customer: Realtime: Order status changed to 'paid' (Token: A-042)

    Note over Agent, Printer: 5. Job Execution & Cleanup
    loop Polling every 3 seconds
        Agent->>Web: POST /api/agent/claim (Bearer agentKey)
        Web->>DB: Call claim_next_job(shop_id, printer_id)
        DB-->>Web: Atomically claimed job
        Web-->>Agent: Job details + 5-minute signed download URL
    end
    Agent->>Web: POST /api/agent/jobs/{id}/status (status: printing)
    Agent->>Storage: Download file using signed URL
    Agent->>Agent: Slice pages (qpdf) & Grayscale conversion (gs)
    Agent->>Agent: Write marker state/printed-{jobId}
    Agent->>Printer: Dispatch print command (lp / SumatraPDF)
    Printer-->>Agent: Print spool completed
    Agent->>Agent: Delete local temp files (original, sliced, grayscale)
    Agent->>Web: POST /api/agent/jobs/{id}/status (status: done, localFileDeleted: true)
    Web->>Storage: Delete file from private storage
    Web->>Storage: Verify object deletion (lookup returns 404)
    Web->>DB: Update order_files (delete_verified: true, deleted_at: now())
    Web->>DB: Update orders (files_deleted_at: now(), status: done)
    DB-->>Customer: Realtime: Order 'done' + files deleted timestamp verified!
```

---

## 3. Order and Job State Machine

State transitions are strictly unidirectional and enforced by database check constraints and atomic transactions.

```mermaid
stateDiagram-v2
    [*] --> Draft : Customer initiates order
    Draft --> AwaitingPayment : Customer taps 'Pay' (Checkout created)
    Draft --> Expired : Unpaid 30m timeout (Sweeper)

    AwaitingPayment --> Paid : Verified Razorpay webhook received
    AwaitingPayment --> Expired : Unpaid 30m timeout (Sweeper)

    Paid --> Queued : Atomic transaction creates print_jobs
    Queued --> Claimed : Agent claims via claim_next_job()
    Claimed --> Printing : Agent downloads file & dispatches spooler
    Claimed --> Queued : Lease expires (120s timeout without heartbeat)

    Printing --> Done : Print finished & local files deleted
    Printing --> Failed : Hardware error / driver timeout

    Failed --> Queued : Owner clicks 'Reprint' in dashboard
    Failed --> Refunded : Owner clicks 'Refund' (Razorpay refund initiated)

    Done --> [*]
    Expired --> [*]
    Refunded --> [*]
```

### Detailed State Invariants
- **`Draft`**: Order metadata created, files are being uploaded and configured. Total price is mutable.
- **`AwaitingPayment`**: Razorpay order created, total price is locked. No changes to order files permitted.
- **`Paid`**: Webhook signature and amount verified. Daily shop token (e.g., `A-042`) assigned atomically.
- **`Queued`**: Individual `print_jobs` rows exist for every file. Awaiting print agent pickup.
- **`Claimed`**: Leased by an active print agent for 120 seconds (`claim_expires_at`).
- **`Printing`**: Print agent has acquired the binary, prepared pages, and submitted to CUPS / SumatraPDF.
- **`Done`**: Physical printing completed, local temp files purged, cloud storage object verified deleted.
- **`Failed`**: Agent encountered an unrecoverable printer error or crash. Awaits owner intervention.
- **`Refunded`**: Owner issued a refund via Razorpay API; order marked closed.
- **`Expired`**: Draft or unpaid order exceeded 30 minutes; storage files deleted by the sweeper.

---

## 4. Subsystem Details

### 4.1 Next.js App Router Web Application
- **Role**: Central coordinator for customer web pages, owner dashboard, and backend route handlers.
- **Validation**: All incoming payloads are parsed and sanitized via Zod schemas.
- **Pricing Calculation**: Centralized pure TypeScript function `calculatePrice` shared by all routes.
- **Realtime Dispatch**: Relies on Supabase Realtime to broadcast row-level changes on `orders` and `print_jobs` to connected browser clients.

### 4.2 Database & Storage (Supabase Postgres)
- **Concurrency Control**: Job claiming uses Postgres row-level locks via `FOR UPDATE SKIP LOCKED` inside a PL/pgSQL function (`claim_next_job`), guaranteeing that concurrent agents can never claim the same job twice.
- **Row Level Security (RLS)**:
  - Tables: `shops`, `printers`, `shop_counters`, `orders`, `order_files`, `print_jobs`, `payment_events`.
  - Public anonymous key has zero select/insert/update/delete permissions on all tables.
  - Shop owners authenticate via Supabase Auth and can only read/mutate records where `shop.owner_id = auth.uid()`.
- **Private Storage Bucket**:
  - Bucket name: `uploads`.
  - Stored paths follow convention: `{shopId}/{orderId}/{fileId}.pdf`.
  - Direct download forbidden; requires signed URL generation with 5-minute expiry.

### 4.3 Outbound Print Agent (Python 3.11)
- **Host System**: Windows, Linux (Debian / Ubuntu), or Raspberry Pi OS (Debian-based).
- **Daemon Lifecycle**: Runs as a systemd service (Linux) or Scheduled Task (Windows) with automatic restart on failure.
- **File Pre-processing Pipeline**:
  1. Validates downloaded PDF structure using `qpdf --check`.
  2. Extracts requested page range using `qpdf --pages <input> <range> -- <output>`.
  3. If Color Mode is `bw`, runs Ghostscript to convert PDF to pure DeviceGray:
     ```bash
     gs -sDEVICE=pdfwrite -dColorConversionStrategy=/LeaveColorUnchanged -dProcessColorModel=/DeviceGray -dCompatibilityLevel=1.4 -dNOPAUSE -dBATCH -sOutputFile=<gray_output> <input>
     ```
  4. Writes idempotency marker file: `state/printed-{jobId}`.
  5. Dispatches print command to CUPS `lp` or SumatraPDF.
  6. Purges all temporary files in a `finally` block and reports `localFileDeleted: true`.

---

## 5. Open Questions
1. *Agent Heartbeat Sensitivity*: Is 15 seconds heartbeat frequency and 45 seconds offline threshold optimal for flaky retail Wi-Fi networks, or should we allow a configurable grace period?
2. *Realtime Fallback*: In environments where corporate or college Wi-Fi blocks WebSocket connections, should the client fall back to HTTP short-polling every 3 seconds for `/o/{orderId}`? (Decision: Yes, customer status page should feature an automatic polling fallback if WebSocket connection fails).
3. *Multi-File Print Order*: When an order has multiple files, should the agent print them sequentially in one batch or claim them one by one? (Decision: Claim per file via `print_jobs`, but keep them grouped under the order token).
