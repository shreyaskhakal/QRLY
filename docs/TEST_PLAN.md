# Test Plan & Quality Assurance Strategy - QR Print Kiosk (QRLY)

## 1. Quality Assurance Standards & Mandates

To ensure zero paper wastage, zero unverified print jobs, and total privacy guarantees, every checkpoint requires clean execution of the test suite without skipping or disabling any assertions.

### 1.1 Mandatory Quality Gates
Before reporting any phase checkpoint, the following test pipeline must pass with exit code 0:
```bash
# 1. Static Analysis & Linting
npm run lint

# 2. TypeScript Strict Mode Compilation Check
npm run typecheck

# 3. Unit & Integration Test Suite (Vitest)
npm run test

# 4. Next.js Production Build Verification
npm run build

# 5. Playwright End-to-End Suite (from Phase 2 onward)
npm run test:e2e

# 6. Python Print Agent Verification (from Phase 4 onward)
cd print-agent && pytest -q && ruff check .
```

---

## 2. Self-Check Reporting Protocol
Every checkpoint artifact must explicitly answer the following six questions:
1. **Requirements Coverage**: Which requirements from sections 2 and 3 does this phase cover, and which remain open?
2. **Contract Stability**: Which files changed, and did any API or schema contract change? If yes, are `docs/API.md`, `docs/SCHEMA.sql`, and `docs/DECISIONS.md` updated?
3. **Zero Browser Trust**: Did any server handler trust a client-provided value for price, page count, or payment state? (Must be: *No*).
4. **Idempotency & Replay Resilience**: What happens if this operation is called twice? Out of order? With missing or corrupted credentials?
5. **Fault Recovery**: What occurs if the network connection drops mid-flight? If the printer goes offline? If the uploaded file is malformed?
6. **Data Privacy**: Are any secrets, uploaded file contents, or customer personal identifiers present in logs, commits, or screenshots? (Must be: *No*).

---

## 3. Comprehensive Test Matrix

### 3.1 Pricing Engine Tests (`src/lib/pricing/__tests__/calculatePrice.test.ts`)
| Test Case ID | Input Parameters | Expected Outcome |
| :--- | :--- | :--- |
| `PRICE-01` | 10 pages, 1 copy, B&W (200p), Normal (1.0x) | 2000 paise (Rs 20.00) |
| `PRICE-02` | 10 pages, 1 copy, Color (1000p), Normal (1.0x) | 10000 paise (Rs 100.00) |
| `PRICE-03` | 5 pages, 2 copies, B&W, High Quality (1.5x) | $\lceil 5 \times 2 \times 200 \times 1.5 \rceil = 3000$ paise |
| `PRICE-04` | 3 pages, 1 copy, Color, Draft Quality (1.0x) | 3000 paise |
| `PRICE-05` | 1 page, 1 copy, B&W, Draft (200p) | 200 paise |
| `PRICE-06` | Fractional paise rounding calculation | Always rounded UP to nearest whole integer paise |
| `PRICE-07` | Minimum order constraint (< 100 paise) | Enforces minimum order of 100 paise (Rs 1.00) |
| `PRICE-08` | Negative copies, zero pages, invalid quality string | Throws validation error; calculation rejected |

### 3.2 Page Range Parser Tests (`src/lib/parser/__tests__/parsePageRange.test.ts`)
| Test Case ID | Input String | Total Pages | Expected Output |
| :--- | :--- | :--- | :--- |
| `RANGE-01` | `"1-5"` | 10 | `[1, 2, 3, 4, 5]` (Count: 5) |
| `RANGE-02` | `"1-3, 5, 8-10"` | 10 | `[1, 2, 3, 5, 8, 9, 10]` (Count: 7) |
| `RANGE-03` | `"  1 - 3 ,  7 "` (padded spaces) | 10 | `[1, 2, 3, 7]` (Count: 4) |
| `RANGE-04` | `"5"` (single page) | 10 | `[5]` (Count: 1) |
| `RANGE-05` | `"5-2"` (inverted span) | 10 | Throws `INVALID_RANGE_ORDER` error |
| `RANGE-06` | `"1-12"` (out of bounds) | 10 | Throws `PAGE_OUT_OF_BOUNDS` error |
| `RANGE-07` | `"1-3, abc, 5"` (alphanumeric error) | 10 | Throws `MALFORMED_RANGE_SYNTAX` error |
| `RANGE-08` | `""` or `null` | 10 | Defaults to all pages `[1..10]` |
| `RANGE-09` | `"1-3, 2-4"` (overlapping ranges) | 10 | Deduplicates to `[1, 2, 3, 4]` (Count: 4) |

### 3.3 File Ingestion & Security Validation Tests
| Test Case ID | Test Condition | Expected Behavior |
| :--- | :--- | :--- |
| `FILE-01` | Executable renamed to `.pdf` | Magic bytes check fails; rejected with `INVALID_FILE_TYPE` |
| `FILE-02` | 0-byte empty file | Rejected with `EMPTY_FILE` |
| `FILE-03` | File size 25.1 MB | Rejected with `FILE_TOO_LARGE` |
| `FILE-04` | Password-protected / encrypted PDF | Rejected with `ENCRYPTED_PDF_NOT_SUPPORTED` |
| `FILE-05` | Corrupted PDF with broken cross-reference table | Rejected with `CORRUPT_DOCUMENT` |
| `FILE-06` | Uploading 6th file to order (limit 5) | Rejected with `MAX_FILES_EXCEEDED` |
| `FILE-07` | Order total pages exceeding 100 pages | Rejected with `PAGE_LIMIT_EXCEEDED` |

### 3.4 Webhook & Payment Verification Tests
| Test Case ID | Test Condition | Expected Behavior |
| :--- | :--- | :--- |
| `PAY-01` | Valid HMAC signature from Razorpay test UPI | Order set to `paid`, token assigned, `print_jobs` created |
| `PAY-02` | Webhook body altered by 1 byte | HMAC verification fails; HTTP 400 returned |
| `PAY-03` | Same webhook delivered 5 times consecutively | First delivery processes; subsequent 4 return 200 OK without duplicating jobs |
| `PAY-04` | Captured amount does not match `orders.total_paise` | Flags `AMOUNT_MISMATCH`, logs security alert, creates zero jobs |
| `PAY-05` | Payment failure event (`payment.failed`) | Order remains in `awaiting_payment` / `failed`; zero jobs created |

### 3.5 Atomic Job Claiming & Concurrency Tests
| Test Case ID | Test Condition | Expected Behavior |
| :--- | :--- | :--- |
| `CLAIM-01` | Two agents invoke `claim_next_job` simultaneously | Row-level `SKIP LOCKED` ensures each agent gets a distinct job or 204 |
| `CLAIM-02` | Job claimed but agent dies before starting (120s lease expires) | Job lease expires; returned to queue on subsequent claim poll |
| `CLAIM-03` | Job left in `printing` for > 10 minutes | Sweeper marks job `failed` with `AGENT_TIMEOUT` (never duplicates paper) |
| `CLAIM-04` | Owner clicks `Reprint` on failed job | Exactly one new attempt allowed; job re-enters `queued` status |

### 3.6 Print Agent & Dry-Run Output Tests
| Test Case ID | Configuration | Verification Command & Target |
| :--- | :--- | :--- |
| `AGENT-01` | Black & White mode verification | `gs -q -o - -sDEVICE=inkcov out/<jobId>.pdf` confirms CMY = 0.00000 |
| `AGENT-02` | Page range extraction verification | `pdfinfo out/<jobId>.pdf \| grep Pages` matches selected pages |
| `AGENT-03` | Agent restart with existing marker `state/printed-{jobId}` | Agent detects marker, logs `ALREADY_PRINTED`, reports `done`, skips spooler |
| `AGENT-04` | Cleanup verification | All temporary working files in `WORK_DIR` deleted in `finally` block |

### 3.7 Privacy & File Deletion Tests
| Test Case ID | Condition | Verification Requirement |
| :--- | :--- | :--- |
| `DEL-01` | Job completes printing successfully | Supabase storage object deleted; GET returns 404; `delete_verified` = true |
| `DEL-02` | Premature customer status check | Deletion banner is NOT displayed while `files_deleted_at` is null |
| `DEL-03` | Storage deletion network failure | System retries with backoff; customer sees *"Deleting your files..."* until confirmed |
| `DEL-04` | Order expires without payment | Sweeper deletes uploaded files; sets `orders.status = 'expired'` |
| `DEL-05` | Reopening `/o/{orderId}` 2 hours later | Confirms: *"Your files have been deleted from our servers at <time>"* |

---

## 4. Open Questions
1. *Automated Printer Emulation in CI*: How should we test CUPS spooling in headless GitHub Actions? (Use virtual CUPS-PDF printer in Docker container).
2. *Realtime Subscription Flakiness in Headless Tests*: Should Playwright tests wait for Supabase Realtime WebSocket events or poll? (Playwright tests will listen to Realtime with a 5-second polling fallback).
