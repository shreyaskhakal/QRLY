# QR Print Kiosk: Antigravity Master Prompt
Nov 7, 2026 · @MASTER

## 0. How to use this prompt
Paste this whole document into the Antigravity Agent Manager as a new task (Planning mode) inside an empty project folder. If it is too long for the box, export it as Markdown, save it as MASTER_PROMPT.md in the folder, and tell the agent: "Read MASTER_PROMPT.md fully and follow it." The agent first writes the planning documents (Phase 0), you review them, then you approve one build phase at a time.
Everything below this line is addressed to the agent.

## 1. Your role and global rules
You are a senior full-stack engineer and product architect. Build QR Print Kiosk: a web app where a customer scans a QR code at a print shop, uploads documents, picks print options, pays by UPI, and the shop's printer prints automatically after payment.
Follow these rules in every phase:
- **Phase 0 first.** Before writing app code, create the documents listed in section 10 inside a /docs folder, based on this spec. Stop and wait for my approval.
- **One phase at a time.** At each checkpoint, run the checks from section 11, attach the results as Artifacts (test output, screenshots, browser recording), then stop for approval.
- **The server is the source of truth** for price, page count, and payment status. Never trust a value sent by the browser.
- **Money is stored as integer paise** (Rs 1 = 100 paise). Never use floats for money.
- **Secrets live only in .env.** Commit a .env.example with placeholder values. Never paste real keys into code, logs, or chat.
- **Razorpay TEST mode only** until I explicitly say go live.
- **Print agent has a dry-run mode** (PRINT_DRY_RUN=true) that saves the final file to ./out instead of printing, so everything can be tested without a printer.
- **Privacy by default.** Uploaded files are deleted after printing, after failure resolution, or after the expiry window, whichever comes first.
- **Ambiguity rule.** If something is unclear, pick the default written here, record it in /docs/DECISIONS.md, and continue. Ask me only if you are truly blocked.
- **Code quality.** TypeScript strict mode, no any, small commits, a README that lets a new developer run everything in under 15 minutes.
- **Verify before installing.** Check that every npm or pip package really exists and is maintained before you add it. Do not invent package names or API endpoints. Check the current Razorpay and Supabase documentation for exact API shapes.
- **Stay inside the project folder.** Do not run destructive shell commands outside it, and do not delete files without telling me.

## 2. Product requirements (PRD)
**Problem.** At busy print shops, colleges and libraries, people queue, hand over USB drives or WhatsApp files, wait for staff to set options, and pay cash. This is slow, error-prone, and a privacy risk.
**Goal.** A customer scans a QR code, uploads files on their phone, chooses options, pays by UPI, and the printer prints without any staff action. A shop owner sees every job and the day's earnings on a dashboard.
**Users.**
- Customer: anonymous, on a phone, no login, no app install. Wants it done in under 60 seconds.
- Shop owner: logs in to a dashboard, sets prices, watches the queue, handles failures and refunds.
**MVP scope (must have).**
- One QR code per shop opening /p/{shopSlug}.
- Upload up to 5 files per order: PDF, JPG, PNG (max 25 MB each, max 100 pages per order). DOCX/PPTX are phase 2 (see section 4).
- Per file options: color or black and white, quality (Draft, Normal, High), copies, page range or all pages, single or double sided.
- Live price shown before payment, calculated on the server.
- UPI payment through Razorpay Checkout (test mode first).
- After the payment webhook confirms, the job is queued and the print agent prints it automatically.
- Live order status page with a token number and queue position.
- Owner dashboard: today's jobs, earnings, printer online or offline, pause printing, set prices, reprint, refund, QR code page.

**Pricing defaults (configurable per shop, stored in paise).**
| Item | Default |
| :--- | :--- |
| Black and white, per page | Rs 2 (200 paise) |
| Color, per page | Rs 10 (1000 paise) |
| Quality multiplier: Draft / Normal / High | 1.0 / 1.0 / 1.5 |
| Double sided | Same per-page price (each side counts as a page) |

Price for one file = pages selected x copies x per-page rate x quality multiplier, rounded up to the nearest paise. Order total = sum of its files, with a minimum order amount of Rs 1.

**Business rules.**
- Printing starts only after a verified payment. No exceptions.
- If the printer is offline or paused, the customer cannot pay. Show a clear message instead.
- A paid job that fails to print is retried once automatically, then flagged for the owner to reprint or refund.
- Unpaid orders expire after 30 minutes and their files are deleted.
- Deletion promise. Every uploaded file is deleted right after it is printed, and the customer is told on screen when the deletion is confirmed. The message is shown only after the deletion has been verified, never before.

**Out of scope for MVP.** Customer accounts, loyalty or coupons, multi-printer routing inside one shop, scanning or copying, stapling or binding, native mobile app, GST invoices (add later).
**Success metrics.** Scan to paid in under 90 seconds. Paid to printing started in under 15 seconds when the queue is empty. Zero duplicate prints. Zero prints without payment.

## 3. User flows and how the app works
### 3.1 Customer journey (mobile web, no login)
1. Scan. The customer scans the QR code on the printer. It opens https://<domain>/p/<shopSlug>. The page shows the shop name, a green or red "Printer online" badge, and the current queue length.
2. Upload. Large "Choose files" button plus drag and drop on desktop. Each file shows a thumbnail, name, detected page count, and a progress bar. The server rejects unsupported types, files over 25 MB, and unreadable PDFs with a plain-language message.
3. Choose options per file. Color or Black and white (two big toggle cards with the price per page shown), Quality (Draft, Normal, High), Copies (stepper, 1 to 50), Pages (All pages, or a range field such as 1-3, 5, 8-10 with live validation against the page count), Sides (Single or Double).
4. Review. A summary card lists each file, its options, pages x copies, and its price, then the order total. A sticky bottom bar shows the total and a Pay Rs X button.
5. Pay. Tapping Pay opens Razorpay Checkout with UPI. The customer approves in any UPI app. The browser then shows "Confirming payment..." and waits. It never marks the order paid on its own.
6. Confirmed. When the Razorpay webhook reaches our server and is verified, the order becomes paid and the jobs are queued. The page updates in real time and shows a token number, for example A-042.
7. Track. The status page shows: Paid, In queue (position 3), Printing, Done. On Done it says "Collect your pages from the tray" and shows the token again. After the files are verified deleted, a green card appears: "Your files have been deleted from our servers at 12:31 PM." Until then it shows "Printing done. Deleting your files..." (rules in section 13.2).
8. If something fails. The page shows "We could not print this. The shop has been notified" and the owner reprints or refunds. The customer can keep the page open or bookmark /o/<orderId>.

Edge cases the UI must handle: printer offline or paused (Pay button disabled with an explanation), customer closes the tab after paying (the status page can be reopened from the link or from the token shown on the Razorpay receipt screen), payment failed or cancelled (return to the review step with the files kept), order expired (start again message).

### 3.2 Shop owner journey (dashboard)
- Log in at /dashboard with email and password or magic link (Supabase Auth).
- Overview. Today's earnings, number of jobs, pages printed, printer status (online or offline with last-seen time), and a Pause printing switch.
- Live queue. A table of jobs updating in real time: token, time, file names, color or B&W, pages, copies, amount, status. Failed jobs are highlighted with Reprint and Refund buttons.
- History. Filter by date and status, export CSV.
- Settings. Edit per-page prices, quality multipliers, maximum file size, and order expiry. Rotate the print agent API key.
- QR page. Shows the shop QR code with a Download PNG and Print this QR button.

### 3.3 What happens behind the scenes
The customer's phone talks only to the web app. The web app stores the file, calculates the price, and starts the payment. Razorpay tells our server (webhook) that money arrived. Our server marks the job queued. A small program on the shop computer (the print agent) asks our server every 3 seconds for queued jobs, downloads the file over a short-lived link, prepares it (page range, grayscale), prints it with the system printer commands, and reports back. The phone and the dashboard update through realtime subscriptions.

## 4. System architecture
Stack:
- Web app & API: Next.js (App Router), TypeScript strict, route handlers, zod validation
- UI: Tailwind CSS and shadcn/ui
- Database, storage, auth, realtime: Supabase (Postgres with RLS, private storage bucket, Auth, Realtime)
- Payments: Razorpay Orders, Checkout with UPI, signed webhooks, refunds API
- Print agent: Python 3.11, CUPS lp, qpdf, Ghostscript, SumatraPDF on Windows
- Hosting: Vercel for web app, Supabase cloud for data
- Tests: Vitest, Playwright, pytest

## 5. Database schema (PostgreSQL on Supabase)
Includes tables: `shops`, `printers`, `shop_counters`, `orders`, `order_files`, `print_jobs`, `payment_events`, atomic claim function `claim_next_job`, deletion tracking columns, and RLS policies.

## 6. API design
Zod-validated Next.js route handlers covering customer shop/order/file/checkout endpoints, Razorpay webhook, agent heartbeat/claim/status endpoints, owner dashboard endpoints, and cron sweeper.

## 7. UI and design spec
Mobile-first responsive design, component system, shared PageRangeInput parser, live status updating, honest deletion notification.

## 8. Print agent and printer setup
Python 3.11 agent, CUPS/SumatraPDF integration, dry-run mode, Ghostscript grayscale conversion, qpdf range slicing, crash recovery marker files.

## 9. Agent tasks (A1-A7)
A1 Foundation, A2 Customer UI, A3 Orders & Files API, A4 Payments, A5 Print Agent, A6 Owner Dashboard, A7 QA & Docs.

## 10. Stepwise execution plan
Phase 0 to Phase 8 with strict checkpoints.

## 11. Error checking steps and test plan
Unit, integration, e2e, security, deletion, and physical print verification.

## 12. Debugging guide manual
Chain debugging methodology, symptom-cause-fix table, diagnostic CLI commands.

## 13. Security, privacy, configuration, deployment, and definition of done
Strict environment variables, zero-trust server validation, dual-confirmation deletion, production deployment steps.
