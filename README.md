# Sales Lead Management Tool

A sales lead management MVP built for the Keyloop coding assignment. The application includes a Next.js frontend, an Express API, PostgreSQL storage through Prisma, and Inngest workflows for lead assignment, follow-up tasks, and activity logging.

## Features

- Lead inbox with salesperson filtering, open-lead count, and lead creation.
- Lead details with assignment, follow-up tasks, status, and an activity timeline.
- Manual activity notes and lead status updates.
- Automatic salesperson assignment and initial follow-up task through Inngest.
- Transactional conversion of an assigned lead into a contact and deal.
- Input validation with Zod and a typed Prisma schema with enums.

## Technology

- **Frontend:** Next.js App Router, React, Tailwind CSS, SWR.
- **Backend:** Node.js 20, Express, TypeScript, Zod.
- **Data:** PostgreSQL, Prisma ORM 7 with the PostgreSQL driver adapter.
- **Workflows:** Inngest.
- **Tests:** Vitest, Supertest, and React Testing Library.

## Run locally

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for complete setup, configuration, API details, and manual test cases.

1. Configure `backend/.env` with a PostgreSQL `DATABASE_URL` and `PORT=3001`.
2. From `backend`, install dependencies, generate Prisma Client, apply migrations, and seed the sample salespeople:

   ```powershell
   npm install
   npm run db:generate
   npm run db:migrate -- --name init
   npm run db:seed
   ```

3. Start the Inngest Dev Server in its own terminal:

   ```powershell
   cd F:\Projects\keyloop-assignment\backend
   npx inngest-cli@latest dev -u http://localhost:3001/api/inngest
   ```

4. Start the API in another terminal:

   ```powershell
   cd F:\Projects\keyloop-assignment\backend
   npm run dev
   ```

5. Set `frontend/.env.local` to `NEXT_PUBLIC_API_URL=http://localhost:3001`, then start the frontend:

   ```powershell
   cd F:\Projects\keyloop-assignment\frontend
   npm install
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

## Automated checks

Run each command from its project directory.

```powershell
# backend
npm test
npm run typecheck

# frontend
npm test
npm run lint
npm run build
```

The backend test suite has 10 passing tests across route behavior and random salesperson selection. The frontend test suite covers inbox fetching/creation and lead detail note/status actions. API/database calls are mocked in the automated tests; the live flow was also manually verified with PostgreSQL and the Inngest Dev Server.

## AI Collaboration Narrative

I used Gemini CLI to create the initial implementation plan. I then worked through that plan in small phases: database schema and seed data, Inngest workflows, REST endpoints, and the Next.js user interface. I asked AI for focused implementation guidance and pasteable snippets for each step, then applied the changes in the project and brought back terminal output or screenshots when something failed.

I treated generated code as a proposal to verify. I checked the API contract against the Prisma models, ran the backend typecheck and automated tests, and exercised the application manually from lead creation through assignment, task creation, activity logging, status changes, and conversion. When frontend linting flagged state updates initiated from effects, I reviewed the issue and changed the client data-fetching approach to SWR. When a frontend test failed after that change, I isolated SWR's shared test cache and gave each test a fresh cache before rerunning the suite. The backend suite finished with 10 passing tests, and the frontend test suite passed.

I also kept the documentation aligned with the implementation and recorded remaining checks instead of treating unverified output as a pass. Before submission, run the frontend lint and production build and compare the application against every requirement in the original assignment brief.

## Build for the Future

The MVP uses a relational schema for leads, salespeople, tasks, contacts, deals, and activity history. Prisma relations and enum fields make data relationships and lifecycle states explicit. Lead conversion uses a database transaction so contact creation, deal creation, status change, and conversion logging succeed or roll back together. Inngest moves assignment and follow-up work out of the request path. The lead-created workflow uses deterministic IDs for its initial task and creation/assignment log entries, making those writes safe to repeat. Zod validates incoming request bodies, and the route and component tests provide a base for future changes.

The current implementation is sized for a local assignment demo. To support production scale and stronger operational guarantees, the next steps would be:

- **Scalability and performance:** Add pagination to lead listing and indexes for common filters and sort orders, such as salesperson, status, and creation time. Replace random assignment with a policy such as least-active workload when assignment volume or fairness requirements grow.
- **Reliability:** Use a transactional outbox or equivalent event-delivery pattern for database writes that must reliably publish Inngest events. Add retry and dead-letter procedures, and test workflow replay and partial failure against a real test database.
- **Security:** Add authentication, role-based authorization, rate limiting, and production secret management before exposing the API beyond a trusted local environment.
- **Maintainability:** Split route handlers and validation schemas into focused modules as the API grows. Keep API types shared or generated so frontend and backend contracts do not drift.
- **Observability:** The `ActivityLog` provides a business audit trail, and the Inngest Dev Server exposes local workflow runs. Add structured application logs, request IDs, metrics, tracing, alerting, and separate liveness/readiness checks for production operations.

## Current verification status

- Backend automated tests: 10 passing across 2 files; TypeScript typecheck passed.
- Frontend automated tests: passed, covering inbox and lead detail actions.
- Manual end-to-end flow: verified through lead creation, assignment, activity, status update, and conversion.
- Frontend lint and production build: run before final submission.
