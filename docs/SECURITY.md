# Security, Privacy & Compliance Architecture - QR Print Kiosk (QRLY)

## 1. Threat Model & Defense-in-Depth

The QR Print Kiosk system processes potentially sensitive and confidential personal documents (e.g., government IDs, medical records, financial statements, academic transcripts). The platform operates under a **Zero-Trust Security Architecture** ensuring that no party (other customers, unauthorized shops, or network observers) can intercept, inspect, or retain user files.

```
       [Untrusted Mobile Client]
                  │ (HTTPS + Ephemeral Guest Secret)
                  ▼
       [API Gateway & Zod Validation]
                  │ (Magic Bytes Check, Size Caps, Page Limits)
                  ▼
       [Private Cloud Storage] ◄─── (5-Minute Signed URLs Only)
                  │
                  ▼
       [Outbound Print Agent] (Local DeviceGray Conversion, Spooling)
                  │
                  ▼
       [Dual Verified Deletion] ───► Cloud Storage 404 + Local Disk Unlink
```

---

## 2. Core Security Controls

### 2.1 Zero-Trust Client Model
- **No Client Authority**: Client browsers never submit calculated prices, page counts, or state transitions. Every calculation is performed authoritatively on the server.
- **Client Session Isolation**: Customers are anonymous and issued a cryptographically secure random token (`guestSecret`) at order initiation.
  - The secret is transmitted via the `x-order-secret` header.
  - The server stores only a SHA-256 hash (`guest_secret_hash`).
  - Access to `/api/orders/{id}/*` strictly verifies the hash before returning or modifying order state.

### 2.2 Payment Webhook Cryptographic Verification
- **HMAC SHA-256 Validation**: Every incoming Razorpay webhook payload is validated against the raw byte stream using `RAZORPAY_WEBHOOK_SECRET`.
- **Replay Protection**: The `payment_events` table enforces a unique constraint on `razorpay_event_id`. Replayed events are acknowledged with 200 OK without re-executing state transitions.
- **Value Reconciliation**: Captured payment amounts are checked against `orders.total_paise`. Any deviation triggers an immediate `AMOUNT_MISMATCH` security exception.

### 2.3 Row Level Security & Multi-Tenant Isolation
- **No Public Access**: The Supabase `anon` key has all direct table operations (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) revoked.
- **Owner Data Boundary**: Shop owners authenticated via Supabase Auth can access only their own shop's data via Postgres RLS:
  ```sql
  create policy "Owners manage own shop"
    on shops for all
    using (owner_id = auth.uid());
  ```
- **Service Role Isolation**: Server-side route handlers use `SUPABASE_SERVICE_ROLE_KEY` to interact with the database. This key is strictly forbidden from client bundle exposure.

### 2.4 File Ingestion & Storage Hardening
- **MIME & Magic Bytes Validation**: Uploaded files are inspected for true file headers (e.g., `%PDF-`, `\xFF\xD8\xFF` for JPEG, `\x89PNG` for PNG). Renamed executables or scripts are rejected.
- **Exploit Mitigation**: PDF parsing is performed within memory-safe libraries (`pdf-lib`). Server-side shell execution of arbitrary user input is prohibited.
- **Strict Caps**:
  - Maximum file size: 25 MB per file.
  - Maximum files per order: 5 files.
  - Maximum pages per order: 100 pages.
- **Private Storage Bucket**:
  - Bucket `uploads` is completely private.
  - Files are uploaded and fetched exclusively via signed presigned URLs with a maximum Time-To-Live (TTL) of 5 minutes (300 seconds).

---

## 3. Privacy by Default & The Deletion Guarantee

### 3.1 The Deletion Lifecycle
Files are deleted under three definitive conditions:
1. **Upon Print Completion**: The instant physical printing concludes.
2. **Upon Failure Resolution**: If a job fails and the owner issues a refund.
3. **Upon Order Expiry**: If a customer does not complete checkout within 30 minutes.

### 3.2 Dual Verification Protocol
A file is considered legally and technically deleted only when verified across both cloud storage and local agent hardware:

```
[Agent Completes Spool] ➔ [Agent Unlinks Local Files] ➔ [Agent reports localFileDeleted: true]
                                                                     │
[Server Deletes Storage Object] ◄─────────────────────────────────────┘
       │
       ▼
[Server Performs Head/Lookup Request]
       │
       ├─► Returns 404 Not Found ➔ [order_files.delete_verified = true]
       │                                     │
       │                                     ▼
       │                    [All Files Deleted?] ➔ [orders.files_deleted_at = now()]
       │                                                      │
       │                                                      ▼
       │                                    [Status Page: "Files Deleted at <time>"]
       │
       └─► Storage Returns 200 (Still Exists) ➔ [Retry with backoff; keep "Deleting..."]
```

### 3.3 Status Page Display Rules
- **Rule 1**: While deletion is pending or in verification, display:
  > *"Printing done. Deleting your files from our servers..."* (with spinner).
- **Rule 2**: Only when `orders.files_deleted_at` is non-null, display the verified confirmation:
  > **"Your files have been deleted from our servers at 12:31 PM."**
  > *"We keep only your order number and the amount paid."*
- **Honest Wording**: Never claim files are erased from the customer's personal device. State clearly that deletion applies to kiosk cloud and local servers.

### 3.4 Data Minimization & Audit Logs
- No customer names, phone numbers, or email addresses are captured for MVP orders.
- Log statements must omit file names and document contents. Only `orderId`, `jobId`, file sizes, and deletion timestamps are recorded for audit compliance.
- Long-term audit records retain only `order_id`, `amount_paise`, and `deleted_at`.

---

## 4. Network Security & Content Security Policy (CSP)

### 4.1 Content Security Policy Headers
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; frame-src https://api.razorpay.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com; img-src 'self' data: blob: https://*.supabase.co; style-src 'self' 'unsafe-inline';
```

### 4.2 Rate Limiting
- Order creation (`POST /api/orders`): 10 requests per minute per IP.
- File upload initialization (`POST /api/orders/{id}/files`): 10 requests per minute per order.
- Agent polling endpoints (`/api/agent/*`): Limited to registered shop agents.

---

## 5. Open Questions
1. *Local Disk Shredding*: Should the print agent overwrite temp files with zeros (`shred` or random bytes) before unlinking, or is standard filesystem `os.remove` sufficient for local SSDs? (Standard `os.remove` is sufficient for MVP; secure overwrite can be an opt-in config for high-security environments).
2. *GDPR / DPDP Compliance*: In India, the Digital Personal Data Protection (DPDP) Act mandates notice and consent. Does our anonymous, zero-retention model satisfy exemptions, or is an explicit consent checkbox required before upload? (Displaying our explicit privacy notice on the upload and review cards satisfies transparent notice).
