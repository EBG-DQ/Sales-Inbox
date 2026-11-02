# Sales Lead Management Frontend

Next.js App Router frontend for the Sales Lead Management Tool. It connects to the Express API and provides a lead inbox, lead details, follow-up tasks, an activity timeline, and lead conversion.

## Requirements

- Node.js 20 or later and npm
- The backend running at `http://localhost:3001` (or a configured API URL)
- PostgreSQL and the Inngest Dev Server running for the complete lead lifecycle flow

## Local setup

Run commands from the `frontend` directory.

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create `.env.local` in this directory:

   ```dotenv
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

   `NEXT_PUBLIC_API_URL` is exposed to the browser, so it must contain only the API base URL and no secrets. Restart Next.js after changing this file.

3. Enable local frontend requests in the backend. The backend should allow `http://localhost:3000` through CORS. In `backend/.env`:

   ```dotenv
   FRONTEND_ORIGIN=http://localhost:3000
   ```

   The Express app must use the `cors` middleware with this origin. Restart the backend after changing its environment.

4. Start the backend and Inngest Dev Server as described in `backend/README.md`.

5. Start the frontend in a separate terminal:

   ```powershell
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

## Available pages and behavior

- `/` — Lead inbox, open-lead count, and create-lead form.
- `/leads/:id` — Lead contact information, salesperson, status, follow-up tasks, activity timeline, activity form, and conversion form.
- Creating a lead sends `lead/created`; assignment and initial task creation happen asynchronously through Inngest.
- Updating status sends `lead/updated`, which records an activity entry asynchronously.
- Converting a lead creates the contact, deal, conversion status, and conversion activity through the backend transaction.

## Manual frontend test cases

Keep the backend, PostgreSQL, and Inngest Dev Server running. Use a fresh test lead for tests that change status or convert, since converted leads are read-only and cannot be converted again.

### 1. Inbox loads existing leads

1. Open `/`.
2. Confirm the lead table loads and shows each lead's name, email, phone, owner, status, and creation date.
3. Confirm the open-lead count excludes leads whose status is `CONVERTED`.

**Expected:** Existing leads appear without an API/CORS error. A lead with no salesperson yet may briefly show `Assigning…` until the Inngest workflow completes; press **Refresh** to reload the list.

### 2. Create a lead from the inbox

1. Enter a name, valid email, and phone number in **Add a lead**.
2. Click **Add lead**.

**Expected:** The form clears and the new row appears. After the Inngest workflow completes, the row shows an assigned salesperson. Inngest creates an initial call task and creation/assignment activity entries.

### 3. Required fields and email validation

1. Try submitting with one or more fields blank.
2. Try entering an invalid email address.

**Expected:** Browser form validation prevents submission; no lead is created.

### 4. Open lead details

1. Click the lead's name in the inbox.

**Expected:** `/leads/:id` opens without a prerender/blocking-route error. The page shows lead information, assigned salesperson, task list, and activity timeline.

### 5. Add a manual activity

1. On an unconverted lead, enter a note in **Log a call or note**.
2. Click **Add activity**.

**Expected:** A success message appears, the form clears, and the new note appears in the timeline with a timestamp.

### 6. Change lead status

1. On an unconverted lead, change status from **New** to **Working**.

**Expected:** The selected status updates. After Inngest processes the event, the activity timeline includes a `Lead updated` entry describing the change.

### 7. Convert an assigned lead

1. Use an assigned lead that is not converted.
2. Enter a deal amount and optional address.
3. Click **Convert lead**.

**Expected:** The status becomes **Converted**, the form is replaced by the conversion summary, and the deal amount/address and conversion activity are shown. The backend creates a contact and deal in the same transaction.

### 8. Converted lead is read-only

1. Open a converted lead.

**Expected:** The status selector is disabled, the activity entry form and conversion form are hidden, and the converted summary is displayed. The backend rejects attempts to update or reconvert the lead.

### 9. Refresh and return navigation

1. Use **Refresh** on the inbox.
2. Use **Back to inbox** on a detail page.

**Expected:** The list reloads from the backend and the back link returns to `/`.

### 10. Backend unavailable

1. Stop the backend temporarily and refresh the inbox, or open a lead page.

**Expected:** The frontend displays an error message instead of silently showing an empty or stale result. Restart the backend and refresh to recover.

## Build and lint checks

Run from `frontend`:

```powershell
npm run lint
npm run build
```

## Automated frontend tests

Run from the `frontend` directory:

```powershell
npm test
```

Vitest and React Testing Library are used for component-level tests. The inbox tests cover loading leads and submitting a lead; the lead detail tests cover posting an activity note and updating status. API calls and SWR data refresh are mocked, so these tests do not require the backend, PostgreSQL, or Inngest to be running.

## Current limitations

- Authentication and authorization are not implemented; run only in a trusted development environment.
- The automated frontend tests cover the primary inbox and lead detail actions; they do not yet automate a full browser-based flow through the production build.
- The API allows local cross-origin requests only when its CORS origin is configured for the frontend URL.

## Phase status

Phase 4 core frontend features are implemented and manually verified. The automated inbox and lead-detail tests are in place; run `npm test`, `npm run lint`, and `npm run build` before submission.
