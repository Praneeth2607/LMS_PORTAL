# Database

PostgreSQL 14+. Owned by the backend developer.

| File         | Purpose                                                    |
| ------------ | ---------------------------------------------------------- |
| `schema.sql` | Drops and recreates all tables, constraints and triggers   |
| `seed.sql`   | Demo users, workshops, form fields, registrations, sessions, attendance, announcements |

## Setup

Set the `PG*` values in `server/.env`, then from the repo root:

```bash
npm run db:reset             # creates the database if missing, applies schema.sql + seed.sql
npm run db:reset -- --no-seed  # schema only
```

This **deletes all data** every time it runs. It uses Node, so `psql` does not need to be on your PATH.

> **Shared Supabase database:** when `DATABASE_URL` is set, `db:reset` runs against Supabase and wipes the
> database that everyone is using. Tell the team before running it. For Supabase, `PGSSL` must be `true`.

If you prefer `psql`:

```bash
createdb -U postgres aurex26
psql -U postgres -d aurex26 -f database/schema.sql
psql -U postgres -d aurex26 -f database/seed.sql
```

## Migrations (databases that already hold data)

When the schema changes, a migration is added to `database/migrations/` (and `schema.sql` is updated for fresh setups).
To bring an existing database, such as the shared Supabase one, up to date **without losing data**:

```bash
npm run db:migrate
```

Migrations are additive and idempotent (`ADD COLUMN IF NOT EXISTS` …), so running this again is harmless.

| Migration                       | Adds                                           |
| ------------------------------- | ---------------------------------------------- |
| `001_session_started_at.sql`    | `sessions.started_at`, for the organizer's "Start session" button |
| `002_user_suspension.sql`       | `users.suspended_at`, and the `blocked_emails` table |
| `003_organizer_requests.sql`    | `organizer_requests` table (organizer access requests awaiting admin approval) |
| `004_live_sessions_presence.sql` | `sessions.video_room_*`, `session_watch_logs`, attendance method `PRESENCE` |
| `005_session_feedback.sql`       | `feedback_questions`, `session_feedback`, `feedback_answers` (+ default questions for existing workshops) |

Optional demo data for an existing database: `sample_feedback.sql` adds sample feedback for the seeded Full-Stack workshop. Run it after migration 005. It's safe to run more than once.

## Demo accounts

Password for all: **`Password@123`**

| Email                 | Role        | Demo purpose                                                   |
| --------------------- | ----------- | -------------------------------------------------------------- |
| `admin@aurex26.dev`   | ADMIN       | Stats, user management, can manage every workshop              |
| `meera@aurex26.dev`   | ORGANIZER   | Owns Full-Stack (closed, certificates) and Cybersecurity       |
| `arjun@aurex26.dev`   | ORGANIZER   | Owns ML (live QR demo, session today) and Cloud/DevOps (draft) |
| `priya@aurex26.dev`   | PARTICIPANT | Full-Stack **100%**, eligible                                  |
| `rahul@aurex26.dev`   | PARTICIPANT | Full-Stack **90%** (exactly at the threshold), eligible        |
| `ananya@aurex26.dev`  | PARTICIPANT | Full-Stack **70%**, not eligible                               |
| `karthik@aurex26.dev` | PARTICIPANT | Full-Stack **50%**, not eligible                               |
| `sneha@aurex26.dev`   | PARTICIPANT | Registered for ML and Cybersecurity                            |
| `vikram@aurex26.dev`  | PARTICIPANT | Not registered anywhere, for the live registration demo        |

## Seeded workshops

All dates are relative to the day you run the seed, so the demo always looks current.

| Workshop                                   | Status    | Mode    | Sessions                      | Notes                                   |
| ------------------------------------------ | --------- | ------- | ----------------------------- | --------------------------------------- |
| Full-Stack Web Development with React & Node.js | CLOSED | HYBRID | 10, all in the past, attendance recorded | Generate certificates: 2 eligible, 2 not |
| Machine Learning Fundamentals with Python  | PUBLISHED | OFFLINE | 4; the first is **today**     | Start attendance and scan the QR live   |
| Cybersecurity Essentials                   | PUBLISHED | ONLINE  | 2, upcoming                   | Meeting link hidden until registered    |
| Cloud & DevOps Bootcamp                    | DRAFT     | OFFLINE | none                          | Visible only to Arjun and the admin     |

No certificates are seeded; generate them live during the demo.

## Tables

| Table                 | Holds                                                                    |
| --------------------- | ------------------------------------------------------------------------ |
| `users`               | Everyone. `role` is `ADMIN`, `ORGANIZER` or `PARTICIPANT`; email is unique and lowercase |
| `workshops`           | Details, dates, mode, venue, meeting link, capacity, `status` (`DRAFT`/`PUBLISHED`/`CLOSED`), `created_by` |
| `registration_fields` | Per-workshop form fields (`field_name`, `field_type`, `required`, `field_order`, `options`) |
| `registrations`       | Participant ↔ workshop, answers in `form_data` (JSONB), `UNIQUE(workshop_id, participant_id)` |
| `sessions`            | Date and time, meeting link, and the current `attendance_token` / `attendance_code` / expiry |
| `attendance`          | `PRESENT`/`ABSENT` per session and participant, `method` (`QR`/`CODE`/`MANUAL`), `UNIQUE(session_id, participant_id)` |
| `certificates`        | `certificate_id` (public, unique), `verification_token`, attendance % at issue time |
| `announcements`       | Workshop announcements                                                   |

The attendance percentage is **not stored**. The API calculates it from `sessions` and `attendance` on every request
(`server/src/services/attendance.service.js`).

## Changing the schema

Edit `schema.sql` (and `seed.sql` if needed), then run `npm run db:reset`. If the change affects API
responses, update `docs/API.md` in the same commit. There are no migrations; for a 24-hour build, resetting is simpler.
