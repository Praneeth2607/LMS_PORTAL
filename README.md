# Aurex'26 · Tech Comrades — CICT Workshop Management Portal

**Track 01: LMS / LLL Website · PS-01: Workshop & Learning Management Portal**

One portal to run CICT workshops end to end:

- **Before:** publish workshops with custom registration forms, and register participants.
- **During:** run sessions in person (QR attendance) or live inside the portal, with anti-AFK presence tracking.
- **After:** collect anonymous feedback, and issue QR-verifiable certificates to everyone with at least 90% attendance.
- **Throughout:** admins get analytics with filters, a PDF report and Excel downloads.
- **Languages:** the whole site switches between English and Tamil.

## Features

| Area | What it does |
| ---- | ------------ |
| Accounts | Three roles (Admin, Organizer, Participant); separate Participant/Organizer sign-in; organizer access requests approved by an admin; suspend/reactivate/delete users; show/hide password |
| Workshops | Draft → Published → Closed; In person, Online or Hybrid; capacity; custom registration form (text, dropdown, checkbox, …); announcements |
| Sessions | Scheduled → Ready → Ongoing → Completed, computed from the clock in `APP_TIMEZONE` |
| QR attendance | Organizer shows a QR + 6-character code (start time → 2 h after the end); participant scans and signs in; manual override |
| Live sessions | Online sessions run inside the portal on Jitsi (JaaS). Heartbeats, tab-switch and idle detection prove presence; attendance is recorded automatically at 75% of the session |
| Certificates | 90% rule on completed sessions; PDF with QR code; public verification page |
| Feedback | Organizer-defined statements rated Strongly agree … Strongly disagree + optional comment; organizers see averages and anonymous comments |
| Analytics | Session-by-session attendance, activity over time, feedback satisfaction, organizer comparison; filters by workshop, year and month; PDF report |
| Downloads | Excel: all participants and all organizers (admin), a workshop's participants with form answers and attendance grid (organizer) |
| Tamil | EN / தமிழ் toggle; dictionary in `server/i18n/ta.json`, Google Translate only for new text |

## Tech stack

| Layer | Tech |
| ----- | ---- |
| Frontend | React 19, React Router 7, Vite 7, Tailwind CSS v4 — hand-built SVG charts, no chart library |
| Backend | Node.js 20+, Express 5 (ES modules), `cors` |
| Database | PostgreSQL (Supabase) via `pg`, plain parameterised SQL, migrations |
| Auth | `jsonwebtoken` (JWT), `bcrypt` |
| PDFs | `pdf-lib`, `@pdf-lib/fontkit` (certificates and the analytics report) |
| Excel | `exceljs` |
| QR codes | `qrcode` |
| Live video | Jitsi as a Service (8x8.vc) via its `external_api.js`; `@daily-co/daily-js` as an optional provider |
| Translation | Own DOM translator + JSON dictionary; Google Cloud Translation API (optional) |
| Tooling | npm workspaces, `concurrently` |

What each library does, feature by feature, is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#libraries).

## Project structure

```
aurex26-tech-comrades/
├── client/        React + Vite + Tailwind single-page app
├── server/        Express REST API
│   ├── i18n/      ta.json — the Tamil dictionary
│   └── secrets/   JaaS private key (git-ignored)
├── database/      schema.sql, migrations/, seed.sql, demo_data.sql
├── docs/
│   ├── API.md           API contract (every endpoint)
│   └── ARCHITECTURE.md  How everything works, feature by feature
├── DEMO_ACCOUNTS.md     Logins and demo scripts
└── package.json         npm workspaces + scripts to run both apps
```

## Getting started

Prerequisites: Node.js 20+ and PostgreSQL 14+ (or a Supabase project).

```bash
# 1. Install everything (client + server, via npm workspaces)
npm install

# 2. Configure environment
cp server/.env.example server/.env    # set the database, JWT_SECRET and (for live sessions) the JAAS_* keys
cp client/.env.example client/.env    # optional in development

# 3a. Local database: create it, load schema + seed + demo data (DELETES DATA)
npm run db:reset
# 3b. Existing database (e.g. Supabase): apply new migrations, keeps data
npm run db:migrate

# 4. Run API and client together
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:5000/api/health

Demo logins (password `Password@123`): `admin@aurex26.dev`, `meera@aurex26.dev` (organizer), `priya@aurex26.dev`
(participant), plus the demo-data organizers and 72 students. See [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md) for the full
list and step-by-step demo scripts.

### Scripts (from the repo root)

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | API (auto-restart) + Vite dev server |
| `npm run dev:server` | API only |
| `npm run dev:client` | Client only |
| `npm run build` | Production build of the client |
| `npm start` | Start the API without watch mode |
| `npm run db:reset` | Recreate the database: schema + seed + demo data (**deletes data**; `-- --no-demo` skips the demo data) |
| `npm run db:migrate` | Apply `database/migrations/*` to an existing database (keeps data) |

### Optional services

| Feature | Needs | Without it |
| ------- | ----- | ---------- |
| Live sessions | `JAAS_APP_ID`, `JAAS_KEY_ID`, `JAAS_PRIVATE_KEY_PATH` (jaas.8x8.vc) | The live room says video isn't set up; everything else works |
| Tamil for new text | `GOOGLE_TRANSLATE_API_KEY` | Text already in `ta.json` is translated; new text stays English |

## Team workflow

- Work on feature branches (`feat/…`, `fix/…`) and merge into `main` small and often.
- `docs/API.md` is the contract between frontend and backend: change it with the endpoint.
- Schema changes need both a migration in `database/migrations/` and an update to `schema.sql`.
- Never commit `.env` files or anything in `server/secrets/`. Add new variables to the matching `.env.example`.
