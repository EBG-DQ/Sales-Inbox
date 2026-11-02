# Sales Lead Management Backend

Express, Prisma 7, PostgreSQL, and Inngest backend for the sales lead management assignment.

## Requirements

- Node.js 20 (tested with Node 20.20.2)
- npm
- PostgreSQL running locally or remotely
- Inngest Dev Server for local workflow execution

## Local setup

Run commands below from the `backend` directory.

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create or update `.env` with a PostgreSQL URL for the database you intend to use:

   ```dotenv
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME?schema=public"
   PORT=3001
   ```

   URL-encode reserved characters in the username or password. For example, encode `@` as `%40`. Ensure the database exists before applying migrations.

3. Generate Prisma Client and apply migrations:

   ```powershell
   npm run db:generate
   npm run db:migrate -- --name init
   ```

   If migrations have already been applied, use `npm run db:migrate` only when changing the schema. Prisma will report that there are no new migrations when everything is current.

4. Seed the sample salespeople:

   ```powershell
   npm run db:seed
   ```

   The seed uses upserts, so it can be run more than once safely.

5. Start the Inngest Dev Server in a separate terminal. With the Inngest CLI installed:

   ```powershell
   npx inngest-cli@latest dev -u http://localhost:3001/api/inngest
   ```

   Keep this terminal running. Open the local Inngest UI shown by the CLI (commonly `http://localhost:8288`) and confirm it detects the app and functions.

6. Start the API in another terminal:

   ```powershell
   npm run dev
   ```

   The default API URL is `http://localhost:3001`. Set `PORT` in `.env` to use another port.

7. Typecheck the backend:

   ```powershell
   npm run typecheck
   ```

## API overview

All request and response bodies use JSON. Send `Content-Type: application/json` for requests with a body.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | API health check |
| GET | `/leads` | List leads; optionally filter with `?salespersonId=...` |
| POST | `/leads` | Create a lead and emit `lead/created` |
| GET | `/leads/:id` | Lead with salesperson, tasks, activity, contact, and deal |
| PATCH | `/leads/:id` | Update an unconverted lead and emit `lead/updated` |
| POST | `/leads/:id/activity` | Add a manual activity note |
| POST | `/leads/:id/convert` | Convert an assigned lead into a contact and deal |
| GET/POST | `/api/inngest` | Inngest serve endpoint |

## Verification by phase

These are manual HTTP checks. In PowerShell, the examples below use `Invoke-RestMethod`; for raw HTTP clients, send the equivalent method, URL, headers, and JSON body.

### Phase 1: database, schema, and seed

1. Generate the client:

   ```powershell
   npm run db:generate
   ```

   Expected: Prisma Client generation completes successfully.

2. Apply migrations:

   ```powershell
   npm run db:migrate -- --name init
   ```

   Expected: migration applies and Prisma reports the database is in sync.

3. Seed salespeople:

   ```powershell
   npm run db:seed
   ```

   Expected: `The seed command has been executed.` Run it again to check the upsert behavior; it should not create duplicate email rows.

### Phase 2: API and Inngest workflows

Keep the API and Inngest Dev Server running in separate terminals for these checks.

1. Health endpoint:

   ```http
   GET http://localhost:3001/health
   ```

   Expected: `200 OK` and `{ "status": "ok" }`.

2. Create a lead:

   ```powershell
   $leadBody = @{
     name = "Morgan Chen"
     email = "morgan.chen@example.com"
     phone = "+1-555-0102"
   } | ConvertTo-Json

   $lead = Invoke-RestMethod -Method Post `
     -Uri http://localhost:3001/leads `
     -ContentType "application/json" `
     -Body $leadBody

   $lead
   ```

   Expected: `201 Created` with a lead `id`. In the Inngest UI, expect a successful `assign-lead-and-create-initial-task` function run for `lead/created`.

3. Check workflow results:

   ```powershell
   Invoke-RestMethod "http://localhost:3001/leads/$($lead.id)"
   ```

   Expected after the Inngest run completes: `salesperson` is assigned; `tasks` includes a pending initial call; `activityLogs` includes lead-created and assigned entries.

4. Update the lead:

   ```powershell
   $updateBody = @{ status = "WORKING" } | ConvertTo-Json

   Invoke-RestMethod -Method Patch `
     -Uri "http://localhost:3001/leads/$($lead.id)" `
     -ContentType "application/json" `
     -Body $updateBody
   ```

   Expected: `200 OK`, status is `WORKING`. In Inngest, expect a successful `log-lead-updates` run for `lead/updated`. Fetch lead details again and expect an update activity entry.

5. List and filter leads:

   ```powershell
   Invoke-RestMethod http://localhost:3001/leads
   Invoke-RestMethod "http://localhost:3001/leads?salespersonId=$($lead.salespersonId)"
   ```

   Expected: `200 OK` arrays; filtered results only include leads assigned to that salesperson.

6. Validation and not-found checks:

   ```powershell
   $invalidBody = @{ name = ""; email = "bad-email"; phone = "" } | ConvertTo-Json
   Invoke-RestMethod -Method Post -Uri http://localhost:3001/leads -ContentType "application/json" -Body $invalidBody
   Invoke-RestMethod http://localhost:3001/leads/not-a-real-id
   ```

   Expected: invalid create returns `400` with `Invalid lead`; missing lead details return `404` with `Lead not found`. PowerShell may display non-2xx responses as exceptions; inspect `Exception.Response.StatusCode` if needed.

7. Add a manual activity:

   ```powershell
   $activityBody = @{
     description = "Called Morgan; requested a follow-up next week."
   } | ConvertTo-Json

   Invoke-RestMethod -Method Post `
     -Uri "http://localhost:3001/leads/$($lead.id)/activity" `
     -ContentType "application/json" `
     -Body $activityBody
   ```

   Expected: `201 Created` with the new activity log. The optional `issuerId` may be supplied if known.

### Phase 3: lead conversion

The conversion endpoint creates a contact and deal, marks the lead as converted, and records a conversion activity in one Prisma transaction. A lead must exist, be assigned to a salesperson, and not already be converted.

1. Convert an assigned, unconverted lead:

   ```powershell
   $convertBody = @{
     amount = 12500
     address = "42 Example Street"
     issuerId = "system"
   } | ConvertTo-Json

   Invoke-RestMethod -Method Post `
     -Uri "http://localhost:3001/leads/$($lead.id)/convert" `
     -ContentType "application/json" `
     -Body $convertBody
   ```

   Expected: `201 Created` with `lead`, `contact`, `deal`, and `activity`. Lead status is `CONVERTED`; contact and deal reference the lead; deal amount is `12500`. The conversion write should use a Prisma transaction.

2. Verify the converted lead:

   ```powershell
   Invoke-RestMethod "http://localhost:3001/leads/$($lead.id)"
   ```

   Expected: converted status, contact, deal, and conversion activity are present.

3. Try converting the same lead a second time.

   Expected: `409 Conflict` with `Lead has already been converted`; no duplicate contact or deal is created.

4. Try a missing lead ID.

   Expected: `404 Not Found` with `Lead not found`.

5. Try an unassigned lead.

   Expected: `409 Conflict` with `Lead must be assigned to a salesperson before conversion`.

6. Try invalid conversion input, for example a negative amount:

   ```powershell
   $badConvertBody = @{ amount = -1 } | ConvertTo-Json
   Invoke-RestMethod -Method Post `
     -Uri "http://localhost:3001/leads/$($lead.id)/convert" `
     -ContentType "application/json" `
     -Body $badConvertBody
   ```

   Expected: `400 Bad Request` with `Invalid conversion data`.

## Current limitations

- Automated route tests are in `tests/leads.test.ts`. They mock Prisma and Inngest, so they verify route behavior without connecting to or changing the configured database.
- Random salesperson selection has isolated unit tests in `tests/assignment.test.ts`.
- The API currently has no authentication or authorization. Keep it on a trusted local development environment.
- The API does not send `lead/updated` for manual activity notes; those notes are written directly to `ActivityLog`.
- Inngest workflow runs are asynchronous. Check the Inngest Dev Server and allow the run to finish before asserting the assignment, task, and activity log results.

## Automated backend tests

Run from the `backend` directory:

```powershell
npm test
npm run typecheck
```

The route suite covers lead listing, invalid lead input, successful lead creation and Inngest event delivery, successful transactional conversion, and conversion rejection for already-converted, unassigned, or invalid-amount cases. The tests use mocked dependencies; the manual verification steps above cover the live PostgreSQL and Inngest path.

The isolated assignment unit tests are in `tests/assignment.test.ts`. They verify deterministic selection of the first and last salesperson and the error raised when the salesperson list is empty. The backend test run passed: 10 tests across 2 files. TypeScript typechecking also passed.

## Phase status

- Phase 1 — Database schema, migration, and salesperson seed: completed.
- Phase 2 — Express/Inngest integration and lead lifecycle workflows: completed and manually verified.
- Phase 3 — Lead API and transactional conversion endpoint: completed and manually verified.
- Phase 4 — Next.js frontend: core MVP implemented and manually verified; frontend automated tests are documented in `../frontend/README.md`.
