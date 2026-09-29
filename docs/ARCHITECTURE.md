# Architecture

The system has three parts: a React single-page app, an Express REST API and one PostgreSQL database (Supabase).
Two outside services are optional: Jitsi as a Service for live video and Google Cloud Translation for new Tamil
text. There are no microservices, caches or sockets; in development it runs as two processes (Vite and Node).

```
                         HTTP/JSON (Bearer JWT)                 SQL (pg)
┌───────────────────────┐ ─────────────────────► ┌──────────────────────┐ ───────────► ┌──────────────────────┐
│ client/  React SPA    │ ◄───────────────────── │ server/  Express API │ ◄─────────── │ PostgreSQL (Supabase)│
│ Vite + Tailwind       │                        │ /api/*               │              └──────────────────────┘
└──────────┬────────────┘                        └──┬────────────┬──────┘
           │ embedded call (JWT)                    │            │ new text only
           ▼                                        ▼            ▼
   Jitsi as a Service (8x8.vc)        server/storage/          Google Cloud Translation
                                      certificates/*.pdf       → server/i18n/ta.json
```

## Contents

1. [Libraries](#libraries)
2. [Backend](#backend-server)
3. [Frontend](#frontend-clientsrc)
4. [Database](#database)
5. Key flows: [Accounts](#accounts-and-sign-in) · [Workshops](#workshops-and-registration) ·
   [Sessions](#session-lifecycle) · [QR attendance](#qr-attendance-in-person) ·
   [Live sessions](#live-sessions-and-proof-of-active-presence) · [Attendance %](#attendance-percentage-and-the-90-rule) ·
   [Certificates](#certificates) · [Feedback](#session-feedback) · [Analytics](#admin-analytics) ·
   [Downloads](#downloads-pdf-report-and-excel) · [Tamil](#tamil-translation)
6. [Environment](#environment)

## Libraries

| Package | Side | What it does | Used by |
| ------- | ---- | ------------ | ------- |
| `react` 19, `react-dom` | client | Components and rendering | every page |
| `react-router-dom` 7 | client | Routes, `RequireAuth` guards, URL search params | navigation, analytics filters (`?workshop=&year=&month=`) |
| `vite` 7, `@vitejs/plugin-react` | client (dev) | Dev server with hot reload, `/api` proxy, production build | development, `npm run build` |
| `tailwindcss` 4, `@tailwindcss/vite` | client (dev) | Utility classes + design tokens in `index.css` | all styling |
| `@daily-co/daily-js` | client | Daily.co call embed (loaded on demand) | live sessions when `VIDEO_PROVIDER=daily` |
| `express` 5 | server | HTTP server, routing; async errors reach the error handler | whole API |
| `cors` | server | Allows `FRONTEND_URL`; exposes `Content-Disposition` for downloads | whole API |
| `pg` | server | Connection pool, parameterised queries, transactions | every repository |
| `bcrypt` | server | Password hashing (`BCRYPT_SALT_ROUNDS`) | sign-up, sign-in, organizer requests |
| `jsonwebtoken` | server | Sign-in tokens (HS256, `JWT_SECRET`); Jitsi room tokens (RS256, JaaS private key) | auth, live sessions |
| `qrcode` | server | QR images (data URL / PNG) | attendance QR, certificate QR |
| `pdf-lib`, `@pdf-lib/fontkit` | server | PDF creation/editing; custom font loading | certificates, analytics PDF report |
| `exceljs` | server | `.xlsx` workbooks | participant / organizer / workshop Excel downloads |
| `concurrently` | root (dev) | Runs client and server with one command | `npm run dev` |

Built in-house instead of a library: the SVG charts (`client/src/components/charts.jsx`), the Tamil DOM translator
(`client/src/i18n/domTranslator.js`), presence tracking (`useActivePresence.js` + `presence.service.js`) and the
request validator (`server/src/validators/validate.js`). Node's built-in `crypto` makes tokens and codes.

External services: Supabase (PostgreSQL), Jitsi as a Service by 8x8 (loaded from `https://8x8.vc/<app>/external_api.js`),
Google Cloud Translation v2 (optional), Google Fonts (Sofia Sans, Noto Sans Tamil).

> `exceljs` depends on `uuid@8`, which has an advisory (GHSA-w5hq-g745-h8pq) for its v3/v5/v6 functions when a buffer
> is passed. exceljs only calls `v4()`, so it does not apply.

## Backend (`server/`)

Each request passes through these layers:

```
routes → middleware (authenticate, authorize) → controllers → services → repositories → db
```

| Path | Responsibility |
| ---- | -------------- |
| `src/app.js` | Builds the app: CORS, JSON parser, `/api` router, 404 and error handlers |
| `src/server.js` | Entry point |
| `src/config/env.js` | Reads every environment variable in one place (with defaults and checks) |
| `src/db/pool.js` | Shared `pg` pool, `query()`, `withTransaction()`; type parsers (DATE → string, COUNT/NUMERIC → number) |
| `src/db/reset.js` | `npm run db:reset`: schema + seed + demo data |
| `src/db/migrate.js` | `npm run db:migrate`: applies `database/migrations/*.sql` in order |
| `src/routes/` | URL → middleware → controller; role checks only |
| `src/middleware/` | `authenticate`, `optionalAuthenticate`, `authorize(...roles)`; error envelope |
| `src/validators/` | Small built-in validator, one file per feature |
| `src/controllers/` | Parse/validate input, call a service, send `{ success, message?, data }` |
| `src/services/` | Business rules (below) |
| `src/repositories/` | Parameterised SQL only; returns camelCase rows |
| `i18n/ta.json` | Tamil dictionary (English text → Tamil) |
| `assets/certificates/`, `assets/fonts/` | Optional certificate template and fonts |
| `storage/certificates/` | Generated certificate PDFs (git-ignored, recreated on demand) |
| `secrets/` | JaaS private key (git-ignored) |

### Services

| Service | Owns |
| ------- | ---- |
| `auth.service` | bcrypt hashing, JWT signing, sign-in (portal check, suspension, pending/rejected organizer request messages), sign-up (always PARTICIPANT) |
| `organizerRequest.service` | Organizer access requests: submit (public), approve (creates the ORGANIZER user with the chosen password hash) or reject |
| `workshop.service` | Workshop CRUD, publish/close rules, default feedback questions for new workshops, and the access helpers every service uses: `canManage`, `getVisibleWorkshop`, `getManageableWorkshop` |
| `registration.service` | Registration with a row lock for capacity, form validation, cancel, "my workshops" |
| `session.service` | Session CRUD, Start, status; hides attendance secrets and video room details |
| `attendance.service` | QR/code start/stop/mark, manual marking, attendance window, **`calculateAttendance()`** (the only place % and eligibility are computed) |
| `video.service` | Video provider: JaaS room names + RS256 room tokens, or the Daily REST client |
| `presence.service` | Live room join rules, heartbeat credit rules, automatic PRESENT at 75%, organizer overview |
| `certificate.service` | Eligibility → ID + token → PDF → row; access checks; public verification |
| `certificatePdf.service` | pdf-lib rendering from template or built-in design, fontkit fonts, QR placement |
| `feedback.service` | Feedback questions (retire-on-edit), eligibility, submission, aggregated statistics |
| `announcement.service` | Workshop announcements |
| `admin.service` | Portal totals, user management (suspend, reactivate, delete + email block) |
| `analytics.service` | Filter scope (workshop / year / month → date range + chart grouping), analytics data, headline numbers |
| `analyticsReport.service` | The analytics PDF report (pdf-lib vector charts) |
| `export.service` | Excel workbooks (exceljs) |
| `translation.service` | Tamil dictionary file, Google Translate for missing text, placeholder checks |

### Conventions

- ES modules everywhere, with explicit `.js` extensions.
- Express 5: handlers may `throw`; use `badRequest()`, `forbidden()`, `notFound()`, `conflict()` from `utils/httpError.js`.
- Always parameterised SQL (`$1`); never concatenate user input into SQL.
- Roles are checked on the route (`authorize`); **ownership** (is this organizer the workshop's creator?) in the service.
- Drafts return `404` (not `403`) to people who cannot manage them, so their existence isn't revealed.
- Times are computed from the database clock and `APP_TIMEZONE`, never from the browser.

## Frontend (`client/src`)

| Folder / file | Responsibility |
| ------------- | -------------- |
| `pages/` | One component per route, grouped by role: `public/`, `participant/`, `organizer/`, `admin/`, plus `SessionLivePage.jsx` |
| `layouts/` | `AppLayout` (navbar, footer, language toggle), `ManageWorkshopLayout` (workshop sections) |
| `components/` | UI kit (`ui.jsx`, `Form.jsx` incl. `PasswordField`, `Modal.jsx`), workshop pieces, `charts.jsx`, `feedback.jsx`, `ActiveSessionTracker.jsx`, `DownloadButton.jsx` |
| `services/` | `api.js` fetch wrapper (JWT header, errors, blob/file downloads) + one file per feature |
| `context/` | `AuthContext` (user, token), `LanguageContext` (EN/Tamil toggle) |
| `hooks/` | `useAsync`, `useActivePresence` (anti-AFK), small utilities |
| `i18n/` | `domTranslator.js` |
| `utils/` | Formatting (dates, times, %), role helpers |

The routes `/attendance/:sessionId` and `/verify/:certificateId` must exist, because QR codes point to them.

## Database

Full schema in `database/schema.sql`; setup, migrations and demo data in `database/README.md`.

```
users ─┬─< workshops (created_by) ─┬─< registration_fields
       │                           ├─< sessions ─┬─< attendance >── users
       │                           │             ├─< session_watch_logs >── users
       │                           │             └─< session_feedback >── users
       │                           │                   └─< feedback_answers >── feedback_questions
       │                           ├─< feedback_questions
       │                           ├─< announcements
       │                           └─< certificates >── users
       ├─< registrations >── workshops
       └── blocked_emails, organizer_requests
```

Integrity is enforced by the database too: `UNIQUE(workshop_id, participant_id)` on registrations and certificates;
`UNIQUE(session_id, participant_id)` on attendance, watch logs and feedback; unique emails, certificate IDs and
verification tokens; `CHECK` constraints on every enum and on date/time ordering.

## Key flows

### Accounts and sign-in

- **Participants** sign up themselves (always PARTICIPANT). **Organizers** request access from the Organizer
  sign-in tab and are approved by an admin (the hash of the password they chose moves into the new user), or are
  created by an admin. **Admins** are created by another admin.
- The sign-in page has **Participant** and **Organizer** tabs. The server enforces them: participants only on the
  Participant tab; organizers and admins only on the Organizer tab.

```
POST /auth/login { email, password, portal }
  → bcrypt.compare → portal check → not suspended
  → JWT { sub: userId, role } signed with JWT_SECRET (JWT_EXPIRES_IN, default 1d)
client stores it → Authorization: Bearer <token> on every request
authenticate verifies the token AND reloads the user, so suspension, deletion and role changes apply at once
```

- Suspended users cannot sign in and their tokens get `401`. Deleting a suspended user puts the email in
  `blocked_emails`, so self sign-up refuses it.

### Workshops and registration

- Status: `DRAFT` (only organizer/admin see it) → `PUBLISHED` (catalogue, registration open) → `CLOSED`
  (registration closed; attendance and certificates still work). Publishing needs a venue for in-person and hybrid
  workshops. The UI shows *Ongoing* while a workshop's dates include today.
- Mode decides attendance: `OFFLINE` → QR/code; `ONLINE` → live room presence; `HYBRID` → both.
- The organizer defines `registration_fields` (text, long text, email, phone, number, date, dropdown, checkbox;
  required; order). The server validates answers, drops unknown keys and stores them in `registrations.form_data`
  (JSONB, keyed by field name).
- Registration locks the workshop row (`SELECT … FOR UPDATE`) so capacity cannot be exceeded.

### Session lifecycle

```
SCHEDULED ──(start time)──► READY ──(organizer presses Start)──► ONGOING ──(end time)──► COMPLETED
```

- Computed in SQL on every read from `session_date` + times in `APP_TIMEZONE` and `sessions.started_at`.
- `POST /sessions/:id/start` is allowed from the start time until the end time. For online and hybrid workshops the
  UI then opens the live room (`/sessions/:id/live`). Rescheduling clears `started_at`.
- Participants' **Join session** button unlocks at the start time by itself (15-second clock).

### QR attendance (in person)

```
Organizer: POST /sessions/:id/attendance/start          (only from start time until 2 h after the end)
  → 32-byte random token + 6-char code (no 0/O/1/I/L) + expiry (default 15 min, never past the window)
  → URL FRONTEND_URL/attendance/:id?token=…  → QR data URL (qrcode)
Participant scans → signs in if needed → confirms
  → POST /sessions/:id/attendance/mark { token } or { code }
  → checks: open → token/code matches (constant-time) → not expired → registered → not already PRESENT
  → attendance row, method QR or CODE
```

- The QR only carries a link; the signed-in POST records attendance. Starting again replaces the token.
- Organizers can mark PRESENT/ABSENT by hand (method `MANUAL`). Starting QR attendance is refused for online workshops.

### Live sessions and proof of active presence

Online and hybrid sessions run inside the portal on **Jitsi as a Service (JaaS, 8x8.vc)** (or Daily.co with
`VIDEO_PROVIDER=daily`). Meet and Zoom cannot be embedded, so presence could not be verified there.

```
Participant opens /sessions/:id/live
  → POST /sessions/:id/video/join
      checks: registered (or manager); live window (organizers 30 min early); not ended
      room name cict-<session>-<random>; JWT RS256 { room, user, moderator, exp = end + 30 min } signed with the JaaS key
  → external_api.js embeds the call; JaaS verifies the token
  → useActivePresence: heartbeat every 60 s only while ALL of
        in the call (videoConferenceJoined) · tab visible/focused · active in the last 2 min ("Are you still there?")
  → POST /sessions/:id/heartbeat — the server measures the gap with its own clock:
        first → start clock · < 0.8×interval → 429 · ≤ 1.5×interval → +60 s · longer → no credit, restart
        capped at the session length; row locked per heartbeat
  → at 75% of the session length: attendance PRESENT, method PRESENCE
```

- `session_watch_logs` holds verified seconds per participant per session. Organizers see minutes, *Watching now*
  and status for everyone, refreshed every 10 s.
- **Demo mode** (`PRESENCE_DEMO_MODE=true`, server-only): heartbeats every 5 s, each worth 15 minutes; idle after 15 s.
- **Limitation:** proves activity, not attention; a mouse jiggler or second device can defeat it.

### Attendance percentage and the 90% rule

```
percentage = PRESENT in completed sessions / completed sessions × 100   (2 decimals)
eligible   = attended × 100 ≥ threshold × completed                    (integer math; threshold 90)
```

Computed on every request in `attendance.service.calculateAttendance()`; nothing cached, nothing taken from the client.
Upcoming sessions don't count, so a participant isn't penalised for sessions that haven't happened.

### Certificates

`POST /workshops/:id/certificates/generate` (only after the last session has ended), for each registered participant:

1. Calculate the percentage and check the 90% rule (below → `notEligible`; already issued → `alreadyIssued`).
2. Insert a `certificates` row: public ID `CICT26-XXXXXXXX` + random `verification_token`.
3. Render with pdf-lib: `assets/certificates/template.pdf` or the built-in design, fonts via fontkit, name, workshop,
   dates, attendance %, organizer, ID, issue date, and a QR (qrcode) for `FRONTEND_URL/verify/<id>?token=<token>`.
4. Save `storage/certificates/<id>.pdf`; if rendering fails, the row is removed so it can be retried.

Downloads re-render the PDF from the row if the file is missing, so `storage/` can be wiped safely. Public
verification returns only what is printed on the certificate; a supplied token must match.

### Session feedback

```
Session COMPLETED → participants marked PRESENT see "Give feedback" (dashboard, workshop page, live room)
  → GET  /sessions/:id/feedback     statements + 5-point scale (5 Strongly agree … 1 Strongly disagree)
  → POST /sessions/:id/feedback     every statement + optional comment; once per session (UNIQUE)
  → GET  /workshops/:id/feedback    organizer/admin: averages, agreement %, distribution, response rate,
                                    per statement and per session; comments without names
```

- New workshops get four default statements; organizers edit up to 10. A statement that already has answers is
  retired (`is_active = false`) instead of changed, so past averages describe what was actually asked.

### Admin analytics

`GET /admin/analytics?workshopId=&year=&month=`, all counting in SQL (`analytics.repository.js`):

| Chart | Form | Answers |
| ----- | ---- | ------- |
| Attendance session by session | line (one workshop at a time), biggest drop called out | Where do participants stop coming? |
| Activity over time | two lines (registrations, check-ins), one count axis | Is the portal getting busier? |
| Feedback satisfaction | dot plot on the true 1–5 scale + lowest-rated statements | What needs attention? |
| Organizer comparison | table with inline meters (different units → no second axis) | How do organizers compare? |

- **Filters** resolve to a scope: default *Last 12 weeks* (weekly points), a year (monthly), a year + month (daily),
  or *All time* (monthly). Sessions count by date, registrations by when they were made, check-ins by when they
  were marked, certificates by when they were issued. A row of headline numbers summarises the scope.
- Filters live in the page URL; choosing a workshop widens the period to *All time*.
- Charts are hand-built SVG (`charts.jsx`) with hover/keyboard tooltips and a *View as table*. Colours `--chart-1`
  (brand orange) and `--chart-2` (blue) pass colour-blind separation (ΔE ≥ 27) and 3:1 contrast.
- Only aggregates leave the database; no participant is identified.

### Downloads (PDF report and Excel)

| Download | Endpoint | Built with | Access |
| -------- | -------- | ---------- | ------ |
| Analytics PDF report | `GET /admin/analytics/report?…filters` | pdf-lib, standard fonts, vector charts, A4, page numbers | Admin |
| All participants (.xlsx) | `GET /admin/users/export?role=PARTICIPANT` | exceljs | Admin |
| All organizers (.xlsx) | `GET /admin/users/export?role=ORGANIZER` | exceljs | Admin |
| A workshop's participants (.xlsx) | `GET /workshops/:id/registrations/export` | exceljs: form answers + attendance grid | That organizer, admins |

- The server names the file (`Content-Disposition`); `DownloadButton.jsx` fetches it with the JWT and saves it.
- Sheets have bold, frozen headers with filters and real dates/numbers. Every value is written as data, so text a
  student typed that starts with `=` never becomes a formula.
- The PDF uses standard fonts, which cover Latin text only: non-Latin titles print as `?`.

### Tamil translation

```
EN | தமிழ் toggle (LanguageContext; saved in localStorage; sets <html lang>)
  → domTranslator walks text nodes + placeholder / aria-label / title / alt
  → looks each text up in the dictionary (GET /i18n/ta, cached in localStorage)
      numbers become placeholders: "3 of 12 responded" → "{0} of {1} responded"
  → a MutationObserver translates anything React renders later
  → missing texts are batched to POST /i18n/ta/translate (60 requests/min per IP)
      → with GOOGLE_TRANSLATE_API_KEY: Google Cloud Translation once → saved to server/i18n/ta.json
      → without a key: stays English
```

- `ta.json` holds ~1,150 hand-written entries covering every page, the seed and demo content, and every month's
  date patterns. A translation that loses a `{n}` placeholder is rejected.
- Only text values and attributes change, never nodes, so React keeps working; EN restores the originals.
- Kept in English: `data-no-translate` (logo, signed-in name, emails, codes, certificate IDs) and email/URL/ID-like tokens.
- Tamil-only CSS (`html[lang="ta"]`): smaller display headings, wrapping buttons, tighter navbar, menu button between
  1,024 and 1,365 px.

## Environment

`server/.env` (from `server/.env.example`; never committed):

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `PORT`, `FRONTEND_URL` | 5000, http://localhost:5173 | API port; allowed origin, and the base of QR links |
| `DATABASE_URL`, `PGSSL` (or `PG*`) | — | Supabase connection string with SSL, or local Postgres values |
| `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS` | —, 1d, 10 | Sign-in tokens and password hashing |
| `APP_TIMEZONE` | Asia/Kolkata | Timezone of session dates and times |
| `VIDEO_PROVIDER`, `JAAS_APP_ID`, `JAAS_KEY_ID`, `JAAS_PRIVATE_KEY_PATH` | jitsi | Live rooms (key file in `server/secrets/`) |
| `DAILY_API_KEY` | — | Only with `VIDEO_PROVIDER=daily` |
| `PRESENCE_THRESHOLD_PERCENT`, `HEARTBEAT_INTERVAL_SECONDS`, `IDLE_TIMEOUT_SECONDS`, `PRESENCE_DEMO_MODE` | 75, 60, 120, false | Anti-AFK rules and the demo speed-up |
| `ATTENDANCE_WINDOW_MINUTES`, `ATTENDANCE_CLOSE_AFTER_END_MINUTES` | 15, 120 | QR validity; attendance window after the end |
| `CERTIFICATE_ATTENDANCE_THRESHOLD` | 90 | Certificate rule |
| `GOOGLE_TRANSLATE_API_KEY` | — | Optional: translate new text to Tamil |

`client/.env` (from `client/.env.example`): `VITE_API_BASE_URL`, empty in development (Vite proxies `/api`).
