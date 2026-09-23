# Aurex'26 · Tech Comrades — CICT Workshop Management Portal

**Track 01: LMS / LLL Website · PS-01: Workshop & Learning Management Portal**

One portal to run CICT workshops end to end: create and publish workshops, register
participants, run sessions, take attendance by QR or code, and issue certificates
(verifiable by QR) to everyone with at least 90% attendance.

## Roles

- **Admin**: manages users, organizers, all workshops and portal-wide announcements
- **Organizer**: creates workshops and sessions, manages registrations, takes attendance, issues certificates
- **Participant**: discovers workshops, registers, marks attendance, downloads certificates

## Tech stack

| Layer    | Tech                                        |
| -------- | ------------------------------------------- |
| Frontend | React 19, Vite, JavaScript, Tailwind CSS v4, React Router |
| Backend  | Node.js 20+, Express 5 (ES modules)         |
| Database | PostgreSQL (`pg`)                           |
| Auth     | JWT (`jsonwebtoken`), `bcrypt`              |
| PDFs     | `pdf-lib`, `@pdf-lib/fontkit`               |
| QR       | `qrcode`                                    |

## Project structure

```
aurex26-tech-comrades/
├── client/      React + Vite + Tailwind SPA        (frontend developer)
├── server/      Express REST API                   (backend developer)
├── database/    schema.sql, seed.sql               (backend developer)
├── docs/
│   ├── API.md           API contract: the frontend builds against this
│   └── ARCHITECTURE.md  Layers, folders, key flows
└── package.json npm workspaces + scripts to run both apps
```

## Getting started

Prerequisites: Node.js 20+ and PostgreSQL 14+.

```bash
# 1. Install everything (client + server, via npm workspaces)
npm install

# 2. Configure environment
cp server/.env.example server/.env    # then edit the PG* values and JWT_SECRET
cp client/.env.example client/.env    # optional in development

# 3. Create and seed the database (see database/README.md)
createdb -U postgres aurex26
psql -U postgres -d aurex26 -f database/schema.sql
psql -U postgres -d aurex26 -f database/seed.sql

# 4. Run API and client together
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:5000/api/health

The home page shows a green badge when it can reach the API.

### Scripts (from the repo root)

| Command              | What it does                          |
| -------------------- | ------------------------------------- |
| `npm run dev`        | API (auto-restart) + Vite dev server  |
| `npm run dev:server` | API only                              |
| `npm run dev:client` | Client only                           |
| `npm run build`      | Production build of the client        |
| `npm start`          | Start the API without watch mode      |

## Team workflow

- The base structure is committed on `main` before any feature work. Don't restructure folders
  without agreeing on it first.
- The backend developer owns `server/`, `database/` and **`docs/API.md`**.
- The frontend developer owns `client/` and builds only against `docs/API.md`.
- Work on feature branches (`feat/auth`, `feat/workshops`, …) and merge small and often.
- Never commit `.env` files. Add new variables to the matching `.env.example`.
