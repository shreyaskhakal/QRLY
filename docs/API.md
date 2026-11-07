# API Specification - QR Print Kiosk (QRLY)

## 1. Global Standards & Conventions

### 1.1 Transport & Format
- All endpoints communicate over **HTTPS**.
- Payloads are JSON-encoded (`Content-Type: application/json`), except the Razorpay Webhook intake which requires raw body parsing for HMAC validation.
- All timestamps are ISO 8601 UTC strings (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- All currency amounts are represented in **integer paise** (1 INR = 100 paise). Floating-point values are strictly prohibited.

### 1.2 Authentication Schemes
1. **Public Customer**:
   - `GET /api/shops/{slug}`: No authentication required.
2. **Customer Order Session**:
   - Headers: `x-order-secret: <random_token>`
   - Generated during `POST /api/orders`. The raw secret is returned once to the client and persisted only as a SHA-256 hash (`guest_secret_hash`).
3. **Print Agent Authentication**:
   - Headers: `Authorization: Bearer <agent_api_key>`
   - Matched against `shops.agent_key_hash`.
4. **Shop Owner Session**:
   - Handled via Supabase Auth session cookies / Bearer JWT.
5. **Scheduled Cron**:
   - Headers: `x-cron-secret: <CRON_SECRET>`

### 1.3 Uniform Error Format
All non-2xx responses strictly conform to:
```json
{
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human readable explanation of the failure condition."
  }
}
```

Standard Error Codes:
- `UNAUTHORIZED`: Missing or invalid credentials / order secret.
- `FORBIDDEN`: Valid credentials but insufficient permissions.
- `NOT_FOUND`: Resource does not exist.
- `PRINTER_OFFLINE`: Printer is currently offline or paused.
- `VALIDATION_ERROR`: Request payload failed Zod schema checks.
- `ORDER_EXPIRED`: Order exceeded 30-minute validity window.
- `ORDER_LOCKED`: Attempted to mutate files after checkout initiation.
- `AMOUNT_MISMATCH`: Payment captured amount differs from order total.
- `INTERNAL_ERROR`: Unexpected server exception.

---

## 2. Customer Endpoints

### 2.1 Get Public Shop Info
- **Route**: `GET /api/shops/{slug}`
- **Auth**: None
- **Response** `200 OK`:
```json
{
  "shop": {
    "id": "c1f7b760-449e-4d43-981c-997e556e9c90",
    "name": "QuickPrint Express",
    "slug": "quickprint",
    "bwPricePaise": 200,
    "colorPricePaise": 1000,
    "qDraftMult": 1.0,
    "qNormalMult": 1.0,
    "qHighMult": 1.5,
    "maxFileMb": 25,
    "acceptingOrders": true,
    "printerStatus": "online",
    "activeQueueLength": 2
  }
}
```

### 2.2 Create Draft Order
- **Route**: `POST /api/orders`
- **Auth**: None
- **Request Body**:
```json
{
  "shopSlug": "quickprint"
}
```
- **Response** `201 Created`:
```json
{
  "orderId": "6c459ec7-c533-4f90-84cf-38cb44185799",
  "guestSecret": "sec_8f91a27e4b9c1d...",
  "expiresAt": "2026-11-07T13:15:00.000Z"
}
```
- **Error Conditions**:
  - `400 PRINTER_OFFLINE`: If printer is offline or `acceptingOrders = false`.

### 2.3 Initiate File Upload
- **Route**: `POST /api/orders/{id}/files`
- **Auth**: `x-order-secret`
- **Request Body**:
```json
{
  "fileName": "lecture_notes.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 1048576
}
```
- **Response** `200 OK`:
```json
{
  "fileId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "uploadUrl": "https://<supabase-storage-url>/upload/signed-token...",
  "storagePath": "c1f7b760.../6c459ec7.../9b1deb4d....pdf"
}
```
- **Validation**:
  - Total order files $\le 5$.
  - Size $\le 25 \text{ MB}$.
  - Allowed MIME: `application/pdf`, `image/jpeg`, `image/png`.

### 2.4 Complete File Upload & Validate
- **Route**: `POST /api/orders/{id}/files/{fileId}/complete`
- **Auth**: `x-order-secret`
- **Behavior**: Server downloads file header from private storage, verifies magic bytes, recounts total pages authoritatively.
- **Response** `200 OK`:
```json
{
  "file": {
    "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "originalName": "lecture_notes.pdf",
    "pageCount": 14,
    "selectedPages": 14,
    "pricePaise": 2800
  },
  "orderTotalPaise": 2800
}
```

### 2.5 Update File Print Options
- **Route**: `PATCH /api/orders/{id}/files/{fileId}`
- **Auth**: `x-order-secret`
- **Request Body**:
```json
{
  "colorMode": "bw",
  "quality": "normal",
  "copies": 2,
  "pageRange": "1-5, 8",
  "sides": "double"
}
```
- **Behavior**: Server validates `pageRange` against `page_count`, computes `selected_pages` (6 pages), re-runs `calculatePrice`, updates record, and returns new total.
- **Response** `200 OK`:
```json
{
  "file": {
    "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "colorMode": "bw",
    "quality": "normal",
    "copies": 2,
    "pageRange": "1-5, 8",
    "selectedPages": 6,
    "sides": "double",
    "pricePaise": 2400
  },
  "orderTotalPaise": 2400
}
```

### 2.6 Delete Uploaded File
- **Route**: `DELETE /api/orders/{id}/files/{fileId}`
- **Auth**: `x-order-secret`
- **Behavior**: Deletes file from Supabase private storage and deletes `order_files` row. Recalculates order total.
- **Response** `200 OK`:
```json
{
  "success": true,
  "newTotalPaise": 0
}
```

### 2.7 Checkout & Create Payment Order
- **Route**: `POST /api/orders/{id}/checkout`
- **Auth**: `x-order-secret`
- **Behavior**:
  1. Re-verifies printer status is `online` and shop `accepting_orders` is true.
  2. Recalculates order total from scratch from all `order_files`.
  3. Verifies `totalPaise >= 100` (Rs 1 minimum).
  4. Calls Razorpay Orders API: `orders.create({ amount: totalPaise, currency: "INR", receipt: orderId })`.
  5. Transitions order status to `awaiting_payment`.
- **Response** `200 OK`:
```json
{
  "orderId": "6c459ec7-c533-4f90-84cf-38cb44185799",
  "razorpayOrderId": "order_EKfLsu8GfbAQuh",
  "amountPaise": 2400,
  "currency": "INR",
  "razorpayKeyId": "rzp_test_..."
}
```

### 2.8 Get Order Status
- **Route**: `GET /api/orders/{id}`
- **Auth**: `x-order-secret` (or open if status is `paid`/`queued`/`printing`/`done` to permit token view)
- **Response** `200 OK`:
```json
{
  "order": {
    "id": "6c459ec7-c533-4f90-84cf-38cb44185799",
    "tokenLabel": "A-042",
    "status": "printing",
    "totalPaise": 2400,
    "queuePosition": 1,
    "filesDeleted": {
      "at": null,
      "verified": false
    },
    "jobs": [
      {
        "id": "d0590a37-567e-4078-aee5-1e3c2357790b",
        "fileName": "lecture_notes.pdf",
        "status": "printing",
        "copies": 2,
        "selectedPages": 6,
        "colorMode": "bw"
      }
    ]
  }
}
```

---

## 3. Webhook Intake

### 3.1 Razorpay Webhook Handler
- **Route**: `POST /api/webhooks/razorpay`
- **Auth**: Webhook signature verification via `X-Razorpay-Signature`
- **Headers**:
  - `X-Razorpay-Signature: <hmac_hex>`
- **Processing Logic**:
  1. Read raw body text using `req.text()`.
  2. Compute HMAC SHA-256 using `RAZORPAY_WEBHOOK_SECRET`. If signature does not match, return `400 Bad Request`.
  3. Insert event into `payment_events (razorpay_event_id, event_type, payload)`. If unique constraint violated, return `200 OK` immediately (idempotent).
  4. On event `order.paid` or `payment.captured`:
     - Match `payload.payment.entity.order_id` to `orders.razorpay_order_id`.
     - Verify `amount == orders.total_paise`. If mismatch, record `AMOUNT_MISMATCH`, alert owner, do not queue.
     - Within a single Postgres transaction:
       - Set `orders.status = 'paid'`, `paid_at = now()`.
       - Assign token using `next_shop_token(shop_id)`.
       - Insert a `print_jobs` row for every file in `order_files`.
       - Set `orders.status = 'queued'`.
  5. Return `200 OK` within 1.5 seconds.

---

## 4. Print Agent Endpoints

### 4.1 Agent Heartbeat
- **Route**: `POST /api/agent/heartbeat`
- **Auth**: `Authorization: Bearer <agentKey>`
- **Request Body**:
```json
{
  "systemName": "ShopPrinter_EPSON_L3250",
  "status": "online",
  "statusDetail": "Ready to print, paper tray full",
  "supportsColor": true,
  "supportsDuplex": true
}
```
- **Response** `200 OK`:
```json
{
  "acknowledged": true,
  "serverTime": "2026-11-07T12:47:00.000Z"
}
```

### 4.2 Claim Next Queued Job
- **Route**: `POST /api/agent/claim`
- **Auth**: `Authorization: Bearer <agentKey>`
- **Behavior**: Calls stored procedure `claim_next_job(shop_id, printer_id, 120)`. If a job is claimed, generates a 5-minute signed download URL from Supabase Storage.
- **Response** `200 OK` (when job available):
```json
{
  "job": {
    "id": "d0590a37-567e-4078-aee5-1e3c2357790b",
    "orderId": "6c459ec7-c533-4f90-84cf-38cb44185799",
    "tokenLabel": "A-042",
    "downloadUrl": "https://<supabase-storage-url>/...",
    "options": {
      "colorMode": "bw",
      "quality": "normal",
      "copies": 2,
      "pageRange": "1-5, 8",
      "sides": "double"
    }
  }
}
```
- **Response** `204 No Content`: If no eligible job is queued.

### 4.3 Report Job Status
- **Route**: `POST /api/agent/jobs/{id}/status`
- **Auth**: `Authorization: Bearer <agentKey>`
- **Request Body**:
```json
{
  "status": "done",
  "localFileDeleted": true,
  "errorCode": null,
  "errorMessage": null
}
```
- **Behavior on `done`**:
  1. Marks `print_jobs.status = 'done'`, `finished_at = now()`, `agent_local_deleted_at = now()`.
  2. Invokes storage deletion for the associated `order_files.storage_path`.
  3. Verifies deletion with storage lookup. If 404, marks `delete_verified = true`, `deleted_at = now()`.
  4. If all files in the order are verified deleted, updates `orders.files_deleted_at = now()`, `orders.status = 'done'`.
- **Response** `200 OK`:
```json
{
  "success": true
}
```

---

## 5. Shop Owner Dashboard Endpoints

### 5.1 Dashboard Summary
- **Route**: `GET /api/dashboard/summary`
- **Auth**: Supabase Auth (Owner)
- **Response** `200 OK`:
```json
{
  "todayEarningsPaise": 154000,
  "todayJobsCount": 42,
  "todayPagesCount": 380,
  "printer": {
    "status": "online",
    "lastSeenAt": "2026-11-07T12:47:10.000Z",
    "acceptingOrders": true
  }
}
```

### 5.2 List Jobs & History
- **Route**: `GET /api/dashboard/jobs?status=all&limit=50&offset=0`
- **Auth**: Supabase Auth (Owner)
- **Response** `200 OK`: Paginated list of jobs with token, customer order reference, status, file metadata, and error details.

### 5.3 Update Shop Configuration
- **Route**: `PATCH /api/dashboard/shop`
- **Auth**: Supabase Auth (Owner)
- **Request Body**:
```json
{
  "bwPricePaise": 250,
  "colorPricePaise": 1200,
  "acceptingOrders": false
}
```
- **Response** `200 OK`: Updated shop record.

### 5.4 Reprint Failed Job
- **Route**: `POST /api/dashboard/jobs/{id}/reprint`
- **Auth**: Supabase Auth (Owner)
- **Behavior**: Sets `status = 'queued'`, resets lease and error codes to re-enter the queue.
- **Response** `200 OK`: `{ "success": true }`

### 5.5 Refund Order
- **Route**: `POST /api/dashboard/orders/{id}/refund`
- **Auth**: Supabase Auth (Owner)
- **Behavior**: Calls Razorpay Refunds API: `payments.refund(razorpay_payment_id)`. Sets `orders.status = 'refunded'`. Triggers immediate file deletion.
- **Response** `200 OK`: `{ "refundId": "rfnd_...", "status": "refunded" }`

### 5.6 Rotate Agent Key
- **Route**: `POST /api/dashboard/agent-key/rotate`
- **Auth**: Supabase Auth (Owner)
- **Behavior**: Generates secure random string `agk_live_...`, computes SHA-256 hash, stores in `shops.agent_key_hash`. Returns raw key once.
- **Response** `200 OK`:
```json
{
  "agentKey": "agk_live_38bf8a7e029c7b89d4e21..."
}
```

---

## 6. Background Maintenance (Sweeper)

### 6.1 Periodic Cleanup Sweeper
- **Route**: `GET /api/cron/sweep`
- **Auth**: `x-cron-secret: <CRON_SECRET>`
- **Frequency**: Every 5 minutes
- **Actions Executed**:
  1. Finds orders in `draft` or `awaiting_payment` where `expires_at < now()`. Transitions to `expired` and deletes files from storage.
  2. Finds jobs in `printing` where `started_at < now() - interval '10 minutes'`. Marks `failed` with `error_code = 'AGENT_TIMEOUT'`.
  3. Finds printers where `last_seen_at < now() - interval '45 seconds'`. Sets status to `offline`.
  4. Retries any failed storage file deletions.
- **Response** `200 OK`:
```json
{
  "expiredOrders": 3,
  "stuckJobsFlagged": 0,
  "printersMarkedOffline": 1,
  "filesPurged": 5
}
```

---

## 7. Open Questions
1. *Guest Secret Storage in Browser*: Should the guest secret be saved in browser `localStorage` or `sessionStorage`? (`localStorage` is preferred so the customer can close and reopen their status page without losing access).
2. *Webhook Delay*: If Razorpay's webhook is delayed by more than 15 seconds, should the client poll `GET /api/orders/{id}` to detect when payment confirms? (Yes, the client polls while showing "Confirming payment...").
