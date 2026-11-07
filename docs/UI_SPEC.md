# UI & Design Specification - QR Print Kiosk (QRLY)

## 1. Design Philosophy & Foundations

### 1.1 Core Principles
- **Mobile-First Geometry**: Designed natively for a 360 px viewport width (standard budget smartphone screen) and scaled responsively to tablet and desktop.
- **Single Focal Action**: Each customer screen features exactly one high-contrast primary call-to-action (CTA).
- **Minimum 48 px Touch Targets**: All buttons, steppers, segmented controls, and toggle cards meet WCAG 2.1 AA touch target standards ($\ge 48 \times 48\text{ px}$).
- **Zero Jargon**: Intuitive phrasing ("Black & white", "Color", "Double-sided", "Copies") instead of technical printer terminology ("Simplex", "Duplex-long-edge", "Monochrome raster").
- **Price Transparency**: The exact price is calculated live on the server and continuously visible as options change.
- **System Font Stack**: Uses native platform fonts (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) for lightning-fast first contentful paint (FCP < 1.0s) with no font download penalties.
- **Light Theme with Clear Accent**: Clean high-contrast white/slate surfaces with a primary brand blue accent (`#2563EB` / `blue-600`) and emerald green (`#059669` / `emerald-600`) for success/deletion states.

---

## 2. Customer Flow Screens (`/p/[slug]` & `/o/[orderId]`)

### 2.1 Screen 1: File Ingestion (`/p/[slug]`)
- **Header**:
  - Shop name with icon.
  - `PrinterStatusBadge`: Green dot "Printer online · Ready to print" or Red dot "Printer offline · Check back soon".
  - Queue count badge: "2 jobs in queue".
- **Kiosk Availability Guard**:
  - If printer is offline or shop has paused orders, a prominent warning card appears:
    > "This printer is not accepting jobs right now. Please notify the shop counter."
  - The upload dropzone and "Continue" actions are disabled.
- **Upload Dropzone**:
  - Large dashed container with cloud upload icon.
  - Text: *"Tap to select files"* (and *"or drag & drop here"* on desktop).
  - Subtitle: *"PDF, JPG, PNG (Max 5 files, up to 25 MB each)"*.
  - Hidden native file input accepting `.pdf, image/jpeg, image/png`.
- **Uploaded File List**:
  - Each file displays a `FileCard`:
    - First page thumbnail preview (rendered client-side via `pdfjs-dist` or image blob).
    - File name, file size (MB), detected page count badge ("14 pages").
    - Upload progress bar (0% to 100%) during transfer.
    - Delete button (trash icon).
- **Footer**:
  - Privacy guarantee note: *"🔒 Your files are deleted right after printing."*
  - Primary button: *"Configure Print Options"* (active only when at least 1 file is uploaded and processed).

### 2.2 Screen 2: Print Configuration (`/p/[slug]/options`)
- **Card-Per-File Layout**:
  - If multiple files are uploaded, a tabbed carousel or stacked cards permit individual configuration.
  - Header: File name and thumbnail preview.
- **Option Controls**:
  1. **Color Mode**:
     - Two large toggle cards side by side (`OptionToggleCard`):
       - **Black & White**: *"Rs 2 / page"*
       - **Color**: *"Rs 10 / page"*
  2. **Print Quality**:
     - Segmented pill selector: `[ Draft ]` · `[ Normal ]` · `[ High (1.5x) ]`
  3. **Number of Copies**:
     - Stepper control with minus/plus buttons and large numeric display (1 to 50).
  4. **Pages Selection**:
     - Radio group: `(●) All pages` vs `(○) Select range`.
     - When "Select range" is active, opens `PageRangeInput`:
       - Text input with placeholder `"e.g. 1-3, 5, 8-10"`.
       - Real-time helper text: *"You selected 6 pages"* (green) or *"Invalid page range: page 12 exceeds total 10 pages"* (red error).
  5. **Sides**:
     - Segmented toggle: `[ Single-sided ]` · `[ Double-sided ]`.
- **Live File Subtotal**:
  - Displayed at the bottom of each file card: e.g., *"6 pages × 2 copies × Rs 2.00 = Rs 24.00"*.
- **Bottom Navigation**:
  - Back button (`← Back to files`).
  - Next button (`Review Order →`).

### 2.3 Screen 3: Review & Pay (`/p/[slug]/review`)
- **Order Summary Card**:
  - Itemized rows for each file:
    - File name
    - Selected pages & copies breakdown
    - Calculated price in Rs.
- **Order Total Section**:
  - Subtotal in Rupees (formatted cleanly: `Rs 24.00`).
  - Minimum order guarantee note (if total < Rs 1.00, rounded up to Rs 1.00).
- **Privacy Notice**:
  - Prominent privacy badge: *"Files are automatically deleted from servers immediately upon print completion."*
- **Sticky Pay Bar (`StickyPayBar`)**:
  - Fixed to screen bottom with backdrop blur:
    - Left: Total amount in bold (`Total: Rs 24.00`).
    - Right: Primary CTA: `Pay Rs 24` button with UPI logo.
  - Clicking `Pay Rs 24` initiates Razorpay Standard Checkout in modal.

### 2.4 Screen 4: Live Order Status & Tracking (`/o/[orderId]`)
- **Large Token Banner**:
  - Prominent display card showing Token ID (e.g., `A-042`) in 48 pt bold font with shop name.
- **Status Stepper (`StatusStepper`)**:
  - 4 Progressive Stages:
    1. **Paid**: Payment verified by server webhook.
    2. **In Queue**: Queue position indicator (e.g., *"Position 2 in queue"*).
    3. **Printing**: Agent has claimed job and printer is spooling.
    4. **Done**: Print completed.
- **Done Pickup Alert**:
  - Alert banner: *"🎉 Printing complete! Collect your pages from the printer tray."*
- **Verified Deletion Card**:
  - **State A (Transitioning)**:
    - Subtle slate card with spinner: *"Printing done. Deleting your files from our servers..."*
  - **State B (Cryptographically Verified)**:
    - Emerald green banner with shield icon:
      > **Your files have been deleted from our servers at 12:31 PM.**
      > *We keep only your order number and amount paid.*
- **Error / Failure Banner**:
  - In case of hardware timeout or jam:
    - Red alert card: *"We could not complete your print job. The store counter has been notified."*
    - Displays shop contact info and token reference.

---

## 3. Shop Owner Dashboard Screens (`/dashboard/*`)

### 3.1 Login (`/dashboard/login`)
- Clean authentication card supporting Email & Password or Passwordless Magic Link via Supabase Auth.

### 3.2 Overview (`/dashboard`)
- **Metrics Grid**:
  - Today's Earnings (Rs).
  - Total Jobs Completed Today.
  - Total Pages Printed Today.
- **Hardware Telemetry Card**:
  - Printer Connection Badge (Online / Offline / Error).
  - Last heartbeat timestamp (e.g., "Last seen 4 seconds ago").
  - Emergency Pause Switch: *"Pause Printing (Stop accepting new customer orders)"*.

### 3.3 Live Queue & History (`/dashboard/jobs`)
- Real-time updating table (`JobsTable`):
  - Columns: Token, Time, Files, Options (Color/B&W, copies), Total (Rs), Status badge.
  - Real-time row animations on state transitions.
  - Action buttons on failed jobs: `[ Reprint ]` and `[ Refund ]`.
  - Date picker filter and `Export CSV` button.

### 3.4 Settings (`/dashboard/settings`)
- Form inputs for:
  - B&W Price per page (in Rupees / Paise).
  - Color Price per page.
  - Quality multipliers (Draft, Normal, High).
  - Max file size (MB) and order expiry time (minutes).
- Agent API Key Management:
  - Display masked current key.
  - `[ Rotate Agent Key ]` button with confirmation modal displaying new key once with a copy button.

### 3.5 QR Code Page (`/dashboard/qr`)
- High-resolution SVG rendering of the shop's unique URL (`https://<domain>/p/<shopSlug>`).
- Buttons:
  - `[ Download PNG ]`: Generates 300 DPI high-resolution image for counter standees.
  - `[ Print this QR ]`: Sends formatted print sheet directly to the kiosk printer.

---

## 4. Shared Component Specifications

### 4.1 `PageRangeInput`
- **Validation Engine**:
  - Standard format: comma-separated list of individual numbers or hyphenated spans (e.g., `1-4, 7, 9-12`).
  - Automatically strips all whitespaces.
  - Rejects:
    - Non-numeric characters (except `-` and `,`).
    - Inverted spans (e.g., `5-2`).
    - Out-of-bound indices (e.g., page `15` when total is `10`).
    - Zero or negative values (`0-3`).
- **Live Computation**: Returns array of unique sorted 1-based page numbers.

### 4.2 Responsive Layout Constraints
- Maximum content container width on desktop: `768 px` (for customer flow to maintain vertical phone-like clarity) and `1280 px` for the owner dashboard.
- Mobile viewport test matrix: 360 px (Galaxy A / small Android), 390 px (iPhone 14/15), 412 px (Pixel 7).

---

## 5. Open Questions
1. *In-Browser PDF Page Preview*: Should users be able to click on individual page thumbnails in the browser before picking ranges? (MVP: show first page thumbnail; full interactive multi-page carousel deferred if bundle size exceeds budget).
2. *Audio / Haptic Feedback*: On mobile web, should a success chime or vibration trigger when the status moves to "Done"? (Will test browser vibration API `navigator.vibrate([100, 50, 100])` where supported).
