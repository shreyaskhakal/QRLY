# Debugging & Diagnostics Guide - QR Print Kiosk (QRLY)

## 1. The 8-Step Order Tracing Pipeline

When investigating an issue with an order, follow the order sequentially along its execution chain. **Stop at the first step that does not verify.**

```
[1. Order Exists] ➔ [2. Files Stored] ➔ [3. Total Locked] ➔ [4. Payment Event]
       ➔ [5. Jobs Queued] ➔ [6. Agent Claimed] ➔ [7. Spooler Dispatched] ➔ [8. Cleanup Verified]
```

### Verification Checklist:
1. **Order Exists in Database**:
   - Query: `select id, status, shop_id, total_paise, created_at from orders where id = '<orderId>';`
   - Expectation: Row exists, valid `shop_id`, status is appropriate.
2. **Files Valid & Stored**:
   - Query: `select id, original_name, page_count, selected_pages, price_paise, storage_path from order_files where order_id = '<orderId>';`
   - Expectation: `storage_path` populated; object exists in Supabase Storage `uploads` bucket; `page_count > 0`.
3. **Total Amount Matches**:
   - Expectation: `orders.total_paise` equals sum of `order_files.price_paise` and equals Razorpay order amount.
4. **Payment Event Arrived & Verified**:
   - Query: `select razorpay_event_id, event_type, processed_at from payment_events where payload->'payment'->'entity'->>'order_id' = '<razorpay_order_id>';`
   - Expectation: Row exists, `processed_at` populated. If missing, inspect Razorpay Webhook delivery log.
5. **Jobs Created**:
   - Query: `select id, order_file_id, status, attempts from print_jobs where order_id = '<orderId>';`
   - Expectation: Exactly one job per file; initial status `queued`.
6. **Agent Claimed Job**:
   - Expectation: `status` is `claimed` or `printing`; `claimed_at` is set; `attempts >= 1`.
   - If not claimed: Check printer heartbeat (`printers.last_seen_at`) and agent polling logs.
7. **Printer Received Spool**:
   - On shop PC: Inspect print queue via `lpstat -W not-completed -o ShopPrinter` (Linux) or Windows Print Spooler.
8. **Final Status & Verified Deletion**:
   - Expectation: `print_jobs.status = 'done'`, `agent_local_deleted_at` set, `order_files.delete_verified = true`, `orders.files_deleted_at` set.

> [!IMPORTANT]
> **Logging Mandate**: Every server route, background task, and print agent log line MUST include `orderId` and `jobId` (when available) so a single grep (`grep "<orderId>"`) surfaces the full end-to-end lifecycle.

---

## 2. Symptom, Cause, and Fix Reference Matrix

| Symptom | Probable Cause | Diagnostic & Resolution Steps |
| :--- | :--- | :--- |
| **Customer paid but nothing printed** | Webhook not delivered or rejected | 1. Check Razorpay Dashboard -> Webhooks for HTTP status codes.<br>2. Check for signature secret mismatch.<br>3. Ensure raw request body was read as string before JSON parsing.<br>4. Check webhook URL is publicly reachable. |
| **Webhook returns 400 invalid signature** | Wrong secret or altered request body | 1. Verify using `RAZORPAY_WEBHOOK_SECRET` (NOT `RAZORPAY_KEY_SECRET`).<br>2. In Next.js, read raw string via `await req.text()`. Do not use pre-parsed JSON. |
| **Job printed twice** | Webhook retried without idempotency | 1. Verify `payment_events.razorpay_event_id` unique constraint.<br>2. Ensure order state transition and job creation occur within single database transaction.<br>3. Verify local marker `state/printed-{jobId}` on print agent. |
| **Order remains `awaiting_payment` after payment** | Missing webhook event subscription | 1. Verify Razorpay webhook is subscribed to both `order.paid` and `payment.captured`.<br>2. Confirm API keys match current environment (test vs live). |
| **Pay button disabled for customer** | Printer offline, shop paused, or stale heartbeat | 1. Check `shops.accepting_orders` flag in DB.<br>2. Check `printers.last_seen_at`; if older than 45 seconds, agent heartbeat is dead.<br>3. Confirm print agent daemon is running. |
| **Agent never claims jobs** | Invalid agent key, wrong shop, or printer not online | 1. Inspect agent console log for HTTP 401 Unauthorized.<br>2. Verify agent key hash in `shops.agent_key_hash`.<br>3. Verify `lpstat -p` reports printer is idle and enabled. |
| **Same job claimed by two agents** | Non-atomic claim query | Ensure claiming uses `claim_next_job` function with `FOR UPDATE SKIP LOCKED`. |
| **Prints wrong pages** | Range parser discrepancy between server & agent | Both TypeScript API and Python agent must implement identical range expansion rules. Run `qpdf` command manually and compare page count with `pdfinfo`. |
| **B&W job prints in color** | Driver ignored monochrome flag | 1. Confirm Ghostscript converted file to pure `DeviceGray`. Verify with `gs -q -o - -sDEVICE=inkcov output.pdf`.<br>2. Check CUPS option name via `lpoptions -p <name> -l`. Update `color_option_bw` in `agent-config.yaml`. |
| **Duplex option ignored** | Model-specific CUPS option string | Inspect `lpoptions -p <name> -l \| grep -i duplex`. Configure exact option string in `agent-config.yaml`. (SumatraPDF on Windows uses `duplex` in print settings). |
| **`lp: Unauthorized` or printer not found** | CUPS permissions or typo in printer name | 1. Add agent user to `lpadmin` group: `sudo usermod -aG lpadmin $USER`.<br>2. Check printer names via `lpstat -p -d`. |
| **Printer shows stopped / disabled** | Paper jam, out of paper, or CUPS error pause | Clear paper jam or reload paper, then run: `cupsenable ShopPrinter && cupsaccept ShopPrinter`. |
| **Agent works manually, fails as service** | Different environment, working dir, or user permissions | 1. Verify systemd unit `User=`, `WorkingDirectory=`.<br>2. Verify `.env` file permissions.<br>3. Check logs via `journalctl -u printagent -f`. |
| **Upload fails on customer phone only** | File size exceeds limits, mobile timeout, or CORS | 1. Check file size against 25 MB limit.<br>2. Verify Supabase Storage CORS allows customer origin.<br>3. Verify presigned URL TTL has not expired. |
| **Page count incorrect** | Browser-only estimate used or encrypted PDF | Server must recount pages using `pdf-lib`/`pdf-parse`. Reject password-protected PDFs with user-friendly error. |
| **Files still in storage after 24 hours** | Sweeper cron job inactive | Verify scheduler is pinging `GET /api/cron/sweep` with valid `x-cron-secret`. Inspect sweeper execution logs. |
| **Owner sees another shop's data** | Supabase RLS policy misconfiguration | Run RLS security tests. Ensure `shops.owner_id = auth.uid()` is enforced and server routes never leak service role to browser. |
| **Deletion message never appears** | Deletion unverified on server or agent | 1. If `print_jobs.agent_local_deleted_at` is null, agent failed to delete local temp file (check disk permissions on `WORK_DIR`).<br>2. If `order_files.delete_verified` is false, storage deletion failed. Check storage bucket permissions. |

---

## 3. Essential Diagnostic Commands

### Linux & Raspberry Pi (CUPS)
```bash
# View complete printer status, active jobs, and defaults
lpstat -t

# View detailed options supported by specific printer
lpoptions -p ShopPrinter -l

# Check active, uncompleted jobs
lpstat -W not-completed -o ShopPrinter

# Cancel all pending jobs in printer queue
cancel -a ShopPrinter

# Re-enable and accept jobs on a paused printer
cupsenable ShopPrinter && cupsaccept ShopPrinter

# Inspect print agent systemd logs
journalctl -u printagent -n 100 --no-pager -f
```

### Windows (PowerShell)
```powershell
# List installed printers and status
Get-Printer | Select-Object Name, PrinterStatus, JobCount

# Inspect active print jobs
Get-PrintJob -PrinterName "ShopPrinter"

# Test SumatraPDF silent print
& "C:\Program Files\SumatraPDF\SumatraPDF.exe" -print-to "ShopPrinter" -print-settings "1x,monochrome,duplex" "test.pdf" -silent
```

### PDF & Color Inspection
```bash
# Verify extracted page count
pdfinfo out/<jobId>.pdf | grep Pages

# Verify ink coverage (DeviceGray B&W must report CMY = 0.00000)
gs -q -o - -sDEVICE=inkcov out/<jobId>.pdf
```

---

## 4. Open Questions
1. *Remote Diagnostic Telemetry*: Should the print agent capture and report the last 50 lines of CUPS error log to the dashboard upon a `CUPS_ERROR` failure? (Useful for remote debugging; ensure no user document names are leaked).
