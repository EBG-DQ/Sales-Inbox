# Proposal: Sales Lead Management Tool (Scenario C)

## Project Status

The core MVP is implemented across the backend and frontend. The API, Inngest workflows, lead inbox, lead detail view, activity logging, and transactional lead conversion have been manually verified. Automated backend and frontend tests have been added; see the READMEs for commands and coverage. Run the backend test suite and production frontend build/lint checks before final submission.

## Part 1: System Design Document

### 1. Architecture Overview
The system is built as a decoupled architecture with a Node.js backend and a Next.js frontend. Lead assignment, follow-up task creation, and update activity logging are handled by an event-driven workflow system.

#### Component Roles:
- **Web App (Frontend - Next.js):** Provides a Lead Inbox, Lead Details View (with chronological logs), and simple interfaces for activity logging/conversion.
- **API Server (Backend - Node.js/Express):** Handles RESTful requests, business logic for conversions, and serves as the entry point for data.
- **Workflow Engine (Inngest):** Orchestrates asynchronous logic:
    - **Lead Assignment:** Randomly assigns a salesperson to new leads.
    - **Task Automation:** Generates initial follow-up tasks.
    - **Activity Logging:** Captures all changes (status edits, conversions) into the `ActivityLog` table.
- **Database (PostgreSQL):** Relational storage for Leads, Contacts, Deals, Salespeople, Tasks, and Activity Logs.

### 2. Data Flow
1.  **Lead Creation:** A new Lead enters the system (via API).
2.  **Workflow Trigger:** Inngest detects `lead.created`.
    - **Assignment:** Executes random assignment to a Salesperson.
    - **Task Creation:** Creates an "Initial Call" task.
    - **Log:** Records "Lead Created" and "Assigned to [Name]" in the Activity Log.
3.  **Salesperson Action:** Salesperson views the Lead Inbox (assigned to them). They log a call or edit the lead.
4.  **Activity Tracking:** Every edit triggers a `lead.updated` event, which Inngest persists to the Activity Log.
5.  **Conversion:** Salesperson marks Lead as "Converted".
    - **Transaction:** A new `Contact` (Customer Info) and `Deal` (Financial record) are created.
    - **State Change:** Lead status becomes `converted` and becomes read-only in the UI.
    - **Linking:** The Lead record is updated with `contact_id` and `deal_id`.

### 3. Technology Stack
- **Backend:** Node.js, Express.js.
- **Database:** PostgreSQL with Prisma ORM.
- **Workflows:** Inngest (local dev server).
- **Frontend:** Next.js (Tailwind CSS for styling).
- **Observability:** Custom `ActivityLog` table (Audit Trail) capturing timestamps, issuers, and change descriptions.

### 4. Database Schema
- `Lead`: id, name, email, phone, status (new, working, converted), salesperson_id, contact_id, deal_id.
- `Salesperson`: id, name, email.
- `Contact`: id, name, email, phone, address (created upon conversion).
- `Deal`: id, amount, status, salesperson_id, lead_id (created upon conversion).
- `Task`: id, type (call, meeting), description, due_date, lead_id, salesperson_id, status (pending, completed).
- `ActivityLog`: id, entity_type (Lead/Deal/Task), entity_id, action (created, updated, converted), description, issuer_id, timestamp.

---

## Part 2: Implementation Plan (Backend Focus)

### Objective
Implement a robust backend for the Sales Lead Management Tool with automated workflows for assignment, task creation, and activity logging. Provide a functional Next.js UI to demonstrate the "Lead Details" and "Activity Log" features.

### Phase 1: Foundation & Schema — Complete
- [x] Initialize the Node.js backend and install dependencies (Express, Prisma, Inngest, Zod).
- [x] Define the Prisma schema based on the system design.
- [x] Run migrations and seed the database with initial Salespeople.

### Phase 2: Workflow Engine (Inngest) — Complete
- [x] Set up the Inngest client and Express endpoint.
- [x] Implement `lead/created` workflow (assignment, initial task creation, and activity entries).
- [x] Implement `lead/updated` workflow to capture lead changes in `ActivityLog`.

### Phase 3: API Implementation — Complete
- [x] **Lead Inbox Endpoint:** GET `/leads` (filterable by assigned salesperson).
- [x] **Lead Details Endpoint:** GET `/leads/:id` (including related tasks, activity logs, contact, and deal).
- [x] **Logging Activity:** POST `/leads/:id/activity` (manual logs).
- [x] **Conversion Logic:** POST `/leads/:id/convert` (transaction creates Contact and Deal, marks the lead converted, and records activity).

### Phase 4: Frontend — Core MVP Complete
- [x] Create the Next.js App Router app.
- [x] **Inbox Page:** Lead list, open-lead count, and create-lead form.
- [x] **Details Page:** Lead header, tasks, chronological activity timeline, status control, and conversion form.
- [x] **Activity Form:** Form to log calls and notes.
- [x] Use SWR to fetch and refresh API-owned data; keep transient UI state in React state.

### Verification & Testing
- [x] **Unit Tests:** Random salesperson selection has deterministic tests for first/last selection and the empty-salesperson error.
- [x] **Backend Tests:** Route tests cover listing, creation/event delivery, and conversion success/error cases. `npm test` passed (10 tests across 2 files); `npm run typecheck` passed.
- [x] **Frontend Tests:** Inbox and detail action tests cover fetching, lead creation, note logging, and status updates; the frontend test suite was reported passing.
- [x] **Manual Verification:** End-to-end flow from lead creation and assignment through activity logging, status update, and conversion.

