# Architecture

A single React single-page app talks to a single Express REST API backed by one PostgreSQL
database. No microservices, no caches, no sockets. Deployable as two processes (or one,
with Express serving the built client).

```
┌──────────────────────┐   HTTP/JSON (JWT)   ┌─────────────────────────┐   SQL (pg)   ┌────────────┐
│  client/ (React SPA) │ ──────────────────► │  server/ (Express API)  │ ───────────► │ PostgreSQL │
│  Vite + Tailwind     │ ◄────────────────── │  /api/*                 │ ◄─────────── │            │
└──────────────────────┘                     └─────────────────────────┘              └────────────┘
```

## Ownership

| Area                         | Owner              |
| ---------------------------- | ------------------ |
| `server/`, `database/`       | Backend developer  |
| `docs/API.md` (the contract) | Backend developer  |
| `client/`                    | Frontend developer |

The frontend consumes only what `docs/API.md` documents. Contract changes go into `API.md` first.

## Backend (`server/src`)

Requests flow in one direction through these layers:

```
routes → middleware (auth, role, validate) → controllers → services → repositories → db
```

| Folder          | Responsibility                                                                     |
| --------------- | ---------------------------------------------------------------------------------- |
| `app.js`        | Builds the Express app: CORS, JSON body parser, `/api` router, 404 and error handlers |
| `server.js`     | Entry point; starts listening                                                      |
| `config/`       | `env.js` reads every environment variable in one place                             |
| `db/`           | `pool.js`: the shared `pg` pool and a `query()` helper                             |
| `routes/`       | One router per feature, all registered in `routes/index.js` under `/api`           |
| `middleware/`   | Auth (verify JWT), role guard, validation runner, error handler                    |
| `validators/`   | Plain request-body validation functions per feature                                |
| `controllers/`  | Read `req`, call a service, send the response envelope. No SQL here.               |
| `services/`     | Business rules: ownership checks, 90% eligibility, code generation, PDF and QR     |
| `repositories/` | Parameterized SQL only (`$1, $2`). No business logic.                              |
| `utils/`        | Small helpers (response helpers, `HttpError`, random codes)                        |

Conventions:

- ES modules everywhere (`"type": "module"`, explicit `.js` extensions in imports).
- Express 5: async handlers can throw; errors reach `middleware/errorHandler.js` automatically.
  Throw an `Error` with a `status` property (e.g. 403) to control the response code.
- Always use parameterized queries. Never build SQL with string concatenation.
- File names: `<feature>.routes.js`, `<feature>.controller.js`, `<feature>.service.js`, `<feature>.repository.js`, `<feature>.validator.js`.

## Frontend (`client/src`)

| Folder        | Responsibility                                                          |
| ------------- | ----------------------------------------------------------------------- |
| `pages/`      | One component per route (grouped by role: `admin/`, `organizer/`, `participant/`, `public/`) |
| `layouts/`    | Shells with navigation per role (e.g. `DashboardLayout`)                |
| `components/` | Reusable UI (buttons, cards, tables, modals, form fields)               |
| `services/`   | `api.js` fetch wrapper + one file per feature calling the API           |
| `context/`    | `AuthContext` (current user, token, login/logout). React context only, no state library. |
| `hooks/`      | Custom hooks (`useAuth`, `useFetch`, …)                                  |
| `utils/`      | Formatting helpers (dates, percentages)                                 |
| `assets/`     | Images and fonts bundled by Vite                                        |

Routing uses `react-router-dom`. Protected routes check the role from `AuthContext`.
Styling uses Tailwind CSS v4 utility classes only (`@import "tailwindcss"` in `index.css`).

## Key flows

### Authentication

1. `POST /api/auth/login` checks the password with `bcrypt.compare` and returns a JWT with `{ id, role }`.
2. The client stores the token in `localStorage` and sends `Authorization: Bearer <token>`.
3. The auth middleware verifies the token and sets `req.user`; the role middleware checks `req.user.role`.

### Workshop lifecycle

`draft` → `published` (visible and open for registration) → `completed` (certificates can be issued).
Any non-completed workshop can go to `cancelled`.

### Configurable registration

`workshops.registration_fields` (JSONB) holds extra form fields defined by the organizer.
The client renders them dynamically; answers are stored in `registrations.form_responses`.
If `requires_approval` is true, new registrations start as `pending`. Capacity and deadline are
enforced on register.

### QR / code attendance

1. The organizer opens attendance for a session. The server generates a short random
   `attendance_code` (with an optional expiry) and returns it along with a QR image
   (`qrcode` → data URL) that encodes the code.
2. Participants scan the QR or type the code. `POST /api/attendance/mark` checks that the session
   is open, the code matches and has not expired, and the user has an approved registration.
3. The unique `(session_id, user_id)` constraint prevents double marking.

### Attendance percentage and the 90% rule

The `workshop_attendance_summary` view computes, per approved registration:

```
attendance_percentage = attended_sessions / total_sessions × 100
certificate_eligible  = attendance_percentage ≥ workshops.certificate_threshold   (default 90)
```

Nothing is stored, so the percentage is always current.

### Certificates

1. The organizer issues certificates for a completed workshop. Every eligible participant gets a
   `certificates` row with an unguessable `certificate_code`.
2. The PDF is generated on demand with `pdf-lib` (+ `@pdf-lib/fontkit` for custom fonts) and
   includes a QR (`qrcode`) pointing to `PUBLIC_VERIFY_URL/<certificate_code>`.
3. The public verify page calls `GET /api/certificates/verify/:code` and shows name, workshop,
   date and validity (revoked certificates show as invalid).

## Environment

- `server/.env` (copy from `server/.env.example`): port, CORS origin, PostgreSQL connection, JWT, threshold.
- `client/.env` (copy from `client/.env.example`): `VITE_API_BASE_URL`, empty in development.
