# BillMate — AI-Powered Multi-Tenant Invoicing SaaS

BillMate is a multi-tenant SaaS application for freelancers, agencies, and small businesses to manage clients, create and track invoices, and understand their cash flow. It is built on Next.js 16 with Supabase, and uses Google Gemini for AI-assisted financial insights and a BullMQ/Redis worker for background jobs.

## ✨ Current Features

### Workspaces & Multi-Tenancy
- **Workspace-scoped data** — every client, invoice, and setting belongs to a workspace, routed under `/(dashboard)/[workspaceSlug]`.
- **Workspace switcher** to move between workspaces you belong to, with the active workspace persisted via cookie.
- **Auto-provisioning** — a default workspace is created for new users on first sign-in.
- **Onboarding flow** (`/onboarding`) for setting up a workspace.

### Team & Access Control
- **Role-based access control** — `owner`, `admin`, `accountant`, and `member` roles via `workspace_members`.
- **Team management page** (`settings/team`) with invite dialog and member role actions.
- **Row Level Security (RLS)** at the database level enforces tenant isolation regardless of application logic.

### Clients
- Full **CRUD** for clients (create, view, edit, list) with name, email, phone, and address.
- Validated forms using `react-hook-form` + `zod`.

### Invoicing
- **Dynamic invoice builder** with line items, quantity, price, subtotal, tax rate, and currency.
- **Invoice statuses** — Pending / Paid / Overdue, with an automatic status updater (`status-updater.ts`) that flags overdue invoices.
- **PDF generation** — professional invoice PDFs rendered client-side with `jsPDF` + `jspdf-autotable`.
- **Customizable templates** (`settings/templates`) — logo, primary color, and font for branded invoices.

### Client Portal
- **Public, no-login invoice view** at `/portal/[invoice_id]` so clients can view and download their invoice without an account.

### AI Assistant (Google Gemini — `gemini-2.5-flash`)
- **Invoice summaries** + suggested client-facing messages.
- **Monthly financial insights** — revenue-trend analysis, cash-flow health, and an actionable tip.
- **Auto-generated payment reminders** — polite, professional overdue-payment emails.

### Analytics & Dashboard
- Overview stats: total revenue, pending and overdue amounts/counts, active clients.
- **Revenue chart** and **profit/loss chart** (Recharts).
- **Activity timeline** backed by an `activity_logs` audit trail.

### Background Jobs & Realtime
- **BullMQ + Redis worker** (`worker.ts`) processes scheduled invoice reminders asynchronously.
  > Note: email delivery is currently **simulated** — the worker logs the send, marks `reminder_sent_at`, and writes an activity log. Wire in a provider (Resend/SendGrid) to send real email.
- **Supabase Realtime** provider for live UI updates on data changes.

### Financial Operations (Tier 5)
- **Recurring Invoices** — weekly/monthly/quarterly/yearly schedules; the BullMQ worker auto-generates invoices on an hourly scan, writes an activity log + notification for each, and advances the schedule (respecting end date / max occurrences).
- **Expense Tracking** — expense CRUD with categories and **receipt upload to private Supabase Storage** (`receipts` bucket, workspace-scoped), plus a Revenue vs Expense vs **Net Profit** dashboard.
- **Notification Center** — realtime notification bell (Supabase Realtime), broadcast or per-user notifications, mark-one / mark-all-read.
- **Client Self-Service Portal** — billing-profile fields, invoice disputes, and client⇄workspace messaging (schema + token-based access).
- **Razorpay Payments** — server-created Orders + Checkout modal, signature verification on the client callback **and** a signature-verified webhook with idempotency, automatic invoice → Paid status updates, payment records (reusing `payments`) + activity entries.
- **Financial Forecasting** — Gemini analyses overdue/pending invoices and monthly revenue to produce a cash-flow prediction, **risk score**, and recommendations (persisted to `ai_reports`).
- **Global Full-Text Search** — PostgreSQL `tsvector` + GIN indexes across clients, invoices, members, notifications, and activity logs via a workspace-scoped `search_workspace()` RPC.
- **Automatic Overdue Reminders** — the BullMQ worker scans hourly for invoices past their due date, flips them to **Overdue**, and notifies the customer by **email (SMTP)** and **SMS (Twilio)** "from" the workspace, with an in-app notification + activity log. Falls back to a logged simulation when providers aren't configured.

### Polish
- Responsive UI with a desktop sidebar and **mobile sidebar**, dark/light theming (`next-themes`), Framer Motion page transitions, and Shadcn/UI components.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, Shadcn/UI, Framer Motion |
| Backend | Next.js Server Actions, standalone Node worker |
| Database / Auth | Supabase (PostgreSQL + Auth, RLS) |
| Queue / Cache | BullMQ + Redis (Upstash) via `ioredis` |
| AI | Google Gemini (`@google/generative-ai`) |
| Forms / Validation | React Hook Form + Zod |
| Charts | Recharts |
| PDF | jsPDF + jspdf-autotable |

## 📐 Architecture

1. **Client tier** — React Server/Client Components using `useActionState` / `useTransition` for optimistic UI.
2. **Service tier** — Next.js Server Actions encapsulate business logic and data access, scoped to the active `workspace_id`.
3. **Data tier** — Supabase PostgreSQL with RLS policies enforcing per-workspace isolation.
4. **Worker tier** — a standalone `worker.ts` process consumes BullMQ jobs from Redis for async/scheduled tasks.

## 🚦 Getting Started

### Prerequisites
- Node.js 20+
- A Supabase project
- A Redis instance (e.g. Upstash)
- A Google Gemini API key

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment variables** — create `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   GEMINI_API_KEY=your_gemini_api_key
   # Optional: override the primary Gemini model (falls back to 2.0-flash / 1.5-flash)
   GEMINI_MODEL=gemini-2.5-flash
   REDIS_URL=your_redis_url
   # Razorpay (payments)
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
   # Public base URL (general use)
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   # Overdue email reminders (SMTP — e.g. Gmail with an App Password)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_org@gmail.com
   SMTP_PASS=your_gmail_app_password
   SMTP_FROM=your_org@gmail.com
   # Overdue SMS reminders (Twilio)
   TWILIO_ACCOUNT_SID=ACxxxxxxxx
   TWILIO_AUTH_TOKEN=your_twilio_token
   TWILIO_FROM=+1xxxxxxxxxx
   DEFAULT_SMS_COUNTRY_CODE=+91   # prepended to client phone numbers without a +country code
   ```
   The SMS/email reminders are **optional** — if these vars are unset, the worker logs a simulated send instead of failing.

3. **Database** — run the SQL setup in your Supabase SQL editor:
   - `setup_multitenant_db.sql` (or `schema.sql` + the tier migrations) to provision the multi-tenant base, **then `migration_financial_ops.sql`** to add the Financial Operations tables (recurring invoices, expenses, notifications, disputes/messages, Razorpay, search, API keys), RLS, indexes, storage bucket, and realtime registration.

4. **Razorpay webhook** — in the Razorpay dashboard, add a webhook pointing at `POST /api/razorpay/webhook` subscribed to `payment.captured` (and optionally `order.paid`), and set `RAZORPAY_WEBHOOK_SECRET` to the secret you configure there.

4. **Run the dev server**
   ```bash
   npm run dev
   ```

5. **Run the background worker** (separate terminal)
   ```bash
   npx tsx worker.ts
   ```

## 🛡️ Security

- **Tenant isolation** — all queries and mutations are scoped to the user's active `workspace_id`.
- **Row Level Security** — database-level enforcement guarantees unauthorized data access is blocked even if application logic fails.
- **Queue-driven workflows** — heavy/scheduled tasks run off the request path in the worker, keeping the web server responsive.
