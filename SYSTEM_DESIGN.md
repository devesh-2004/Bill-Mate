# BillMate System Design

## 1. Executive Summary
BillMate is a modern SaaS application designed for freelancers and small businesses to manage clients, create invoices, and track revenue. Built with **Next.js 16**, **Supabase**, and **Tailwind CSS**, it leverages a serverless architecture for scalability and performance.

## 2. Architecture Overview

### 2.1 Technology Stack
- **Frontend Framework:** Next.js 16 (React 19)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4, Shadcn/UI, Framer Motion
- **Backend/Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **AI Integration:** Google Gemini API (`@google/generative-ai`)
- **PDF Generation:** jsPDF

### 2.2 Application Structure
The application follows the Next.js App Router architecture:
- **`app/(auth)`**: Public-facing authentication routes (Login/Signup).
- **`app/(dashboard)`**: Protected application routes (Dashboard, Clients, Invoices, Settings).
- **`lib/`**: Shared utilities, including the Supabase server client.
- **`components/`**: Reusable UI components and feature-specific widgets.

## 3. Database Design
The database is hosted on PostgreSQL (via Supabase) and uses Row Level Security (RLS) to ensure data isolation between users/workspaces.

### 3.1 Core Entities (Schema)

#### Users & Profiles
- **`auth.users`**: Managed by Supabase Auth.
- **`profiles`**: Extends user data.
  - `id` (PK, ref `auth.users`)
  - `full_name`

#### Clients
- **`clients`**: Customer details.
  - `id` (UUID, PK)
  - `user_id` (Owner)
  - `name`, `email`, `phone`, `address`

#### Invoices
- **`invoices`**: The core billing entity.
  - `id` (UUID, PK)
  - `user_id` (Owner), `client_id` (Ref)
  - `invoice_number`, `status` ('Paid', 'Pending', 'Overdue')
  - `subtotal`, `tax`, `total`
  - `due_date`, `paid_at`, `reminder_sent_at`
  - `currency`, `tax_rate`

- **`invoice_items`**: Line items for invoices.
  - `id` (UUID, PK)
  - `invoice_id` (Ref)
  - `description`, `quantity`, `price`

#### Invoice Customization
- **`invoice_templates`**: Branding for generated PDFs.
  - `user_id`, `logo_url`, `primary_color`, `font_family`

#### Organization & Audit
- **`workspaces`** (Tier 3): Multi-user collaboration groups.
  - `owner_id`, `name`
- **`workspace_members`**: Users belonging to workspaces.
  - `role` ('admin', 'member')
- **`activity_logs`** (Tier 2): Audit trail for actions.
  - `entity_type` ('invoice', 'client'), `action`, `metadata`

#### AI Features
- **`ai_logs`**: History of AI-generated content (e.g., invoice descriptions).
  - `prompt`, `response`

### 3.2 Security Model (RLS)
- **Data Isolation:** Policies enforce `auth.uid() = user_id` for almost all tables, ensuring users only see their own data.
- **Workspace Access:** For workspace features, policies check membership: `exists query` on `workspace_members`.

## 4. Key Modules

### 4.1 Authentication Module
- Handles Sign Up, Sign In (Email/Password & potentially OAuth).
- Middleware protection to redirect unauthenticated users away from `(dashboard)`.

### 4.2 Dashboard & Analytics
- **Overview**: Real-time stats on Revenue, Pending Invoices, and Active Clients.
- **Backend**: `status-updater.ts` ensures invoice statuses (e.g., "Overdue") are kept current. `revenue-actions.ts` aggregates financial data.

### 4.3 Invoicing Engine
- **CRUD Operations**: Create, Read, Update, Delete invoices.
- **PDF Generation**: Client-side (or server-side) generation of professional PDFs using `jspdf`.
- **Status Workflow**: Draft -> Pending -> Paid/Overdue.

### 4.4 AI Assistant
- Integration with Google Gemini to assist in writing invoice descriptions or generating client communication.
- Usage tracked in `ai_logs`.

## 5. Data Flow & State Management
- **Server Actions**: Used for mutations (creating clients, updating invoices) to ensure type safety and direct database interaction.
- **Server Components**: Fetch data directly from Supabase for initial page loads.
- **Client Components**: Handle interactivity (forms, dynamic UI updates) and sync with server via `useRouter` or optimistically.
