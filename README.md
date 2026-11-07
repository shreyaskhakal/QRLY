# QRLY - Autonomous QR Print Kiosk

> **Scan. Upload. Pay by UPI. Collect Prints.** Zero wait, zero staff intervention, and privacy by default.

QRLY transforms any standard office or print shop printer into an autonomous self-service print kiosk. Customers scan a QR code on the printer, upload documents on mobile web, configure options, and pay via UPI (Razorpay). The shop's local print agent claims the job over outbound HTTPS and prints it automatically.

---

## ⚡ Quickstart (Under 15 Minutes)

### 1. Prerequisites
- **Node.js**: v20+ or v24+
- **Python**: 3.11+ (for the local print agent)
- **Supabase**: Local Docker instance or managed Supabase cloud project

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/shreyaskhakal/QRLY.git
cd QRLY

# Install Node dependencies
npm install
```

### 3. Environment Configuration
```bash
# Copy example environment configuration
cp .env.example .env.local
```
Fill in the placeholders in `.env.local` with your Supabase and Razorpay credentials.

### 4. Database Setup
Apply the PostgreSQL migration:
```bash
# Using Supabase CLI:
supabase db reset
# Or execute supabase/migrations/0001_init.sql and supabase/seed.sql in your Supabase SQL Editor
```

### 5. Run Web Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the homepage, or [http://localhost:3000/p/quickprint](http://localhost:3000/p/quickprint) for the customer kiosk interface.

### 6. Run Test Suite
```bash
# Run unit and integration tests (Vitest)
npm run test

# Run TypeScript type check
npm run typecheck

# Run ESLint
npm run lint

# Run production build
npm run build
```

---

## 🏗️ Project Architecture

```
QRLY/
├── docs/                        # Complete technical specifications & planning
│   ├── PRD.md                   # Product requirements & business rules
│   ├── ARCHITECTURE.md          # 7-component system topology & Mermaid diagrams
│   ├── SCHEMA.sql               # PostgreSQL DDL & RLS policies
│   ├── API.md                   # Next.js route handlers & Zod schemas
│   ├── UI_SPEC.md               # Mobile-first design specification
│   ├── AGENT_TASKS.md           # Subagent task breakdowns (A1 - A7)
│   ├── EXECUTION_PLAN.md        # Stepwise phased roadmap
│   ├── TEST_PLAN.md             # Comprehensive test matrix & quality gates
│   ├── DEBUGGING.md             # 8-step order tracing pipeline & fixes
│   ├── SECURITY.md              # Zero-trust security & verified deletion
│   ├── PRINTER_SETUP.md         # CUPS (Linux) & SumatraPDF (Windows) setup
│   └── DECISIONS.md             # Architecture Decision Records (ADRs)
├── src/
│   ├── app/                     # Next.js App Router (pages & API routes)
│   ├── components/              # Shared UI components (customer & dashboard)
│   └── lib/
│       ├── errors/              # Uniform error handling
│       ├── parser/              # Pure page range parser & validator
│       ├── pricing/             # Pure integer paise pricing calculation engine
│       ├── supabase/            # Client, server, and admin Supabase instances
│       └── types/               # TypeScript domain models and interfaces
├── supabase/
│   ├── migrations/              # Database migrations (0001_init.sql)
│   └── seed.sql                 # Demo shop and printer seed data
└── print-agent/                 # Python 3.11 print agent daemon (CUPS / SumatraPDF)
```

---

## 🔒 Privacy & Deletion Guarantee

QRLY enforces **Privacy by Default**:
- Uploaded customer files are permanently purged from private storage and local print agent disks immediately upon printing completion or after a 30-minute unpaid expiry.
- The customer status page displays a cryptographically verified deletion timestamp:
  > *"Your files have been deleted from our servers at 12:31 PM."*
- Deletion is verified across both cloud storage and local disks before this confirmation is rendered.

---

## 🚀 Production Deployment & Go-Live

For complete production deployment instructions across Vercel, Supabase, Razorpay, and local hardware agents:
- Refer to [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for step-by-step setup, environment variable checklists, and pre-flight criteria.

---

## 🧪 Automated Testing & Verification Suite

- **TypeScript / Web App**: 62 unit and integration tests covering pricing, page parsing, magic bytes inspection, Razorpay signatures, RLS policies, rate limiting, owner dashboard controls, 20-order concurrent ingestion, and full E2E customer-to-print lifecycle.
- **Python Hardware Agent**: 12 unit tests verifying Ghostscript grayscale conversion, qpdf slicing, SumatraPDF/CUPS dispatch, and dry-run output generation.

```bash
# Run complete test matrix
npm run test
cd print-agent && python -m unittest discover tests
```

---

## 📜 License
MIT

