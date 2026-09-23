# Architecture

The system has three parts: a React single-page app, an Express REST API and one PostgreSQL database.
There are no microservices, caches or sockets. It runs as two processes (Vite and Node) in development.

```
┌──────────────────────┐   HTTP/JSON (JWT)   ┌─────────────────────────┐   SQL (pg)   ┌────────────┐
│  client/ (React SPA) │ ──────────────────► │  server/ (Express API)  │ ───────────► │ PostgreSQL │
│  Vite + Tailwind     │ ◄────────────────── │  /api/*                 │ ◄─────────── │            │
└──────────────────────┘                     └─────────────────────────┘              └────────────┘
                                                        │
                                                        ▼
                                           server/storage/certificates/*.pdf
```

## Ownership

| Area                         | Owner              |
| ---------------------------- | ------------------ |
| `server/`, `database/`       | Backend developer  |
| `docs/API.md` (the contract) | Backend developer  |
| `client/`                    | Frontend developer |

The frontend uses only what `docs/API.md` documents. Contract changes go into `API.md` first.

## Backend (`server/`)

Each request passes through these layers in order:

```
routes → middleware (authenticate, authorize) → controllers → services → repositories → db
```

| Path                       | Responsibility                                                                    |
| -------------------------- | --------------------------------------------------------------------------------- |
| `src/app.js`               | Builds the Express app: CORS, JSON parser, `/api` router, 404 and error handlers  |
| `src/server.js`            | Entry point; starts listening                                                     |
| `src/config/env.js`        | Reads every environment variable in one place                                     |
| `src/db/pool.js`           | Shared `pg` pool, `query()` and `withTransaction()`; type parsers (DATE → string, NUMERIC/COUNT → number) |
| `src/db/reset.js`          | `npm run db:reset`: creates the DB if missing, applies schema + seed              |
| `src/routes/`              | URL → middleware → controller. No logic                                           |
| `src/middleware/auth.js`   | `authenticate`, `optionalAuthenticate`, `authorize(...roles)`                     |
| `src/middleware/errorHandler.js` | Error envelope; maps `HttpError`, PostgreSQL constraint errors and bad JSON |
| `src/validators/`          | `validate(body, schema)`: a small built-in validator (no library). One file per feature |
| `src/controllers/`         | Parse and validate the request, call a service, send the envelope. No SQL         |
| `src/services/`            | Business rules: ownership, visibility, capacity, attendance checks, 90% rule, certificates |
| `src/repositories/`        | Parameterized SQL only. Returns camelCase rows                                    |
| `src/utils/`               | `HttpError` helpers, response helpers, camelCase mapping, random tokens/codes    |
| `assets/certificates/`     | Optional `template.pdf` (official CICT design)                                    |
| `assets/fonts/`            | Optional `name.ttf` / `body.ttf`                                                  |
| `storage/certificates/`    | Generated PDFs (git-ignored, recreated on demand)                                 |

### Services

| Service                   | Owns                                                                             |
| ------------------------- | -------------------------------------------------------------------------------- |
| `auth.service`            | bcrypt hashing, JWT signing/verification, login (including pending/rejected organizer request messages), sign-up (always PARTICIPANT) |
| `organizerRequest.service` | Organizer access requests: submit (public), approve (creates the ORGANIZER user) or reject (admin) |
| `workshop.service`        | Workshop CRUD, publish/close rules, **access helpers** used by all other services: `canManage`, `getVisibleWorkshop`, `getManageableWorkshop` |
| `registration.service`    | Registration with row lock for capacity, form validation, cancel, "my workshops" |
| `session.service`         | Session CRUD, hides attendance secrets and meeting links from non-authorized viewers |
| `attendance.service`      | QR/code start/stop/mark, manual marking, **`calculateAttendance()`** (the single place percentage and eligibility are computed) |
| `certificate.service`     | Eligibility → ID + token → PDF → metadata; access checks; public verification      |
| `certificatePdf.service`  | pdf-lib rendering from template (or built-in design), fontkit fonts, QR placement |
| `announcement.service`    | Workshop announcements                                                           |
| `admin.service`           | Portal statistics, user management                                               |

### Conventions

- ES modules everywhere, with explicit `.js` extensions in imports.
- Express 5: async handlers can `throw`, and errors reach the error handler automatically. Throw
  `badRequest()`, `forbidden()`, `notFound()` or `conflict()` from `utils/httpError.js`.
- Always use parameterized queries (`$1`). Never build SQL by concatenating user input.
- Roles are checked on the route (`authorize`). **Ownership** (is this organizer the workshop's creator?)
  is checked in the service, because it needs the database.
- Drafts return `404` (not `403`) to people who cannot manage them, so their existence isn't revealed.

## Database

See `database/schema.sql`. Tables:

```
users ─┬─< workshops (created_by)
       ├─< registrations >── workshops
       ├─< attendance >───── sessions >── workshops
       ├─< certificates >─── workshops
       └─< announcements >── workshops
workshops ─< registration_fields
```

Integrity is enforced by the database, not only the code:

- `UNIQUE(workshop_id, participant_id)` on `registrations` and `certificates`.
- `UNIQUE(session_id, participant_id)` on `attendance`.
- `UNIQUE` on `users.email`, `certificates.certificate_id` and `certificates.verification_token`.
- `CHECK` constraints on every enum, and on date and time ordering.

## Key flows

### Authentication

How accounts are created:

- **Participants** sign up themselves.
- **Organizers** either request access from the sign-in page (Organizer tab → Request organizer access) and wait for an admin to approve, or are created directly by an admin.
- **Admins** are only created by another admin.

When an organizer request is approved, the password hash chosen at request time is moved into the new user row.

Suspended accounts (`users.suspended_at`) cannot sign in, and `authenticate` rejects their existing tokens with a
`401`. When an admin deletes a suspended user, their email goes into `blocked_emails`. Self sign-up refuses those
emails; an admin creating the account lifts the block.

1. `POST /api/auth/login`: `bcrypt.compare` checks the password, then a JWT `{ sub: userId, role }` is signed with `JWT_SECRET` (valid for 1 day).
2. The client sends `Authorization: Bearer <token>`.
3. `authenticate` verifies the token **and reloads the user from the database**, so deleted users and role changes take effect immediately.

### Configurable registration

- The organizer defines `registration_fields` (name, type, required, order, and options for SELECT).
- The client renders the form from `GET /api/workshops/:id` → `registrationFields`.
- The server validates the answers against those fields, drops unknown keys, and stores them in
  `registrations.form_data` (JSONB, keyed by `fieldName`).
- The workshop row is locked (`SELECT … FOR UPDATE`) during registration, so capacity cannot be exceeded under concurrent sign-ups.

### Session lifecycle

```
SCHEDULED ──(start time reached)──► READY ──(organizer presses Start)──► ONGOING ──(end time)──► COMPLETED
```

- The status is calculated in SQL on every read, from `session_date` + `start_time`/`end_time` interpreted in
  `APP_TIMEZONE` (default Asia/Kolkata; Supabase itself runs in UTC) and `sessions.started_at`.
- `POST /api/sessions/:id/start` sets `started_at`. It is rejected before the start time and after the end time.
- The UI switches the Start button on by itself at `startsAt`, using a 15-second clock, so no reload is needed.
  For online and hybrid workshops it opens the meeting link; for offline ones it only marks the session Ongoing.
- Rescheduling a session clears `started_at`.

### Live sessions and proof of active presence

Online and hybrid sessions run inside the portal on **Jitsi as a Service (JaaS, 8x8.vc)** (or Daily.co with `VIDEO_PROVIDER=daily`). Meet and Zoom cannot be embedded, so presence
could not be verified there.

```
Participant opens /sessions/:id/live
  → POST /sessions/:id/video/join   (server names/reuses the room, returns a personal signed token)
  → JaaS external_api.js embeds the call (loaded only on this page)
  → useActivePresence: heartbeat every 60s while ALL of:
        in the call (videoConferenceJoined) · page visible/focused · not idle (2 min, then "Are you still there?")
  → POST /sessions/:id/heartbeat    (server measures the gap with its own clock; spam → 429; long gap → no credit)
  → at 75% of the session length: attendance PRESENT (method PRESENCE), recorded automatically
```

- `video.service.js`: the video provider: JaaS JWTs signed with our private key (RS256), or the Daily REST client.
- `presence.service.js`: joining, heartbeat rules and status.
- `session_watch_logs`: verified seconds per participant per session.

Clicking into the call iframe counts as focus. Activity inside the iframe is invisible to the page, so the idle
prompt asks the person to confirm they're there.

**Limitations** (worth stating honestly): this proves activity, not attention. A mouse jiggler or a second device can defeat it.

**Demo mode** (`PRESENCE_DEMO_MODE=true`) is set on the server only: heartbeats every 5s, each counting as 15 minutes.

### QR attendance (in-person)

```
Organizer: POST /sessions/:id/attendance/start
  → 32-byte random token + 6-char code + expiry saved on the session
  → URL  FRONTEND_URL/attendance/:id?token=…  → QR data URL (qrcode)

Participant scans → frontend page (logs in if needed)
  → POST /sessions/:id/attendance/mark { token }   (or { code } typed by hand)
  → server checks: session exists → attendance open → token/code matches (constant-time compare)
                   → not expired (DB clock) → registered → not already PRESENT
  → INSERT … ON CONFLICT upsert into attendance
```

The QR code only contains a link. Opening the link marks nothing: the logged-in participant's POST is what records attendance.
Starting attendance again replaces the token, so a photo of an old QR code stops working. Stopping attendance clears both token and code.

### Attendance percentage and the 90% rule

Attendance is measured against **completed** sessions (end time passed, in `APP_TIMEZONE`), so it reflects
progress so far. Certificates can only be generated once every session has ended.

```
percentage = PRESENT in completed sessions / completed sessions × 100   (2 decimals)
eligible   = attended × 100 ≥ threshold × completed   (integer math; threshold = 90 by default)
```

This is computed on every request in `attendance.service.calculateAttendance()` from the live rows. Nothing
is cached, and nothing is accepted from the client.

### Certificates

`POST /api/workshops/:id/certificates/generate` → for each registered participant:

1. Fetch the workshop's sessions and the participant's attendance.
2. Calculate the percentage.
3. Check the 90% rule. Participants below it are listed under `notEligible`.
4. Skip anyone who already has a certificate (`alreadyIssued`).
5. Insert a `certificates` row with `certificate_id` `CICT26-XXXXXXXX` and a random `verification_token`.
   The unique constraint prevents duplicates.
6. Render the PDF:
   1. Load `template.pdf`, or draw the built-in design.
   2. Embed the fonts.
   3. Write the name, workshop, dates, attendance %, organizer, ID and issue date.
   4. Generate a QR code for `FRONTEND_URL/verify/<certificateId>?token=<token>` and place it on the page.
   5. Save it to `storage/certificates/<certificateId>.pdf`.
7. If the PDF step fails, delete the row, so the participant can be retried.

Downloads regenerate the PDF from the database if the file is missing. That means `storage/` can be wiped safely.

Public verification (`GET /api/certificates/verify/:certificateId`) returns only what is printed on the
certificate. If the QR code's token is supplied, it must match.

## Frontend (`client/src`)

| Folder        | Responsibility                                                          |
| ------------- | ----------------------------------------------------------------------- |
| `pages/`      | One component per route (grouped by role: `admin/`, `organizer/`, `participant/`, `public/`) |
| `layouts/`    | Shells with navigation per role                                         |
| `components/` | Reusable UI                                                             |
| `services/`   | `api.js` fetch wrapper + one file per feature calling the API           |
| `context/`    | `AuthContext` (current user, token, login/logout). React context only   |
| `hooks/`      | Custom hooks                                                            |
| `utils/`      | Formatting helpers                                                      |
| `assets/`     | Images and fonts bundled by Vite                                        |

The routes `/attendance/:sessionId` and `/verify/:certificateId` are required, because the QR codes point to them (see API.md).

## Environment

- Live sessions need `JAAS_APP_ID`, `JAAS_KEY_ID` and `JAAS_PRIVATE_KEY_PATH` (jaas.8x8.vc → API Keys; keep the key in the git-ignored `server/secrets/`), or `VIDEO_PROVIDER=daily` + `DAILY_API_KEY`. Without it, the live room shows "Live video isn't set up yet"; everything else still works.
- Presence settings: `PRESENCE_THRESHOLD_PERCENT` (75), `HEARTBEAT_INTERVAL_SECONDS` (60), `IDLE_TIMEOUT_SECONDS` (120), `PRESENCE_DEMO_MODE` (false).

- `server/.env` (copy from `server/.env.example`) sets:
  - `PORT` and `FRONTEND_URL` (used for CORS and the QR URLs);
  - the database connection: either `DATABASE_URL` (the shared Supabase database, with `PGSSL=true`)
    or the individual `PG*` values for a local Postgres;
  - `JWT_SECRET`;
  - the attendance window;
  - the certificate threshold.
- `client/.env` (copy from `client/.env.example`) sets `VITE_API_BASE_URL`. Leave it empty in development.
