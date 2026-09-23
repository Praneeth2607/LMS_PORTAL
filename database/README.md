# Database

PostgreSQL 14+. Owned by the backend developer.

| File         | Purpose                                                            |
| ------------ | ------------------------------------------------------------------ |
| `schema.sql` | Drops and recreates all tables, triggers and the attendance view   |
| `seed.sql`   | Demo users, workshops, sessions, registrations, announcements      |

## Setup

```bash
# 1. Create the database (once)
createdb -U postgres aurex26
#    or: psql -U postgres -c "CREATE DATABASE aurex26;"

# 2. Create tables (re-run any time to reset; this DELETES all data)
psql -U postgres -d aurex26 -f database/schema.sql

# 3. Load demo data
psql -U postgres -d aurex26 -f database/seed.sql
```

Then set the `PG*` values in `server/.env` to match.

## Demo accounts

Password for all: `Password@123`

| Email                     | Role        |
| ------------------------- | ----------- |
| `admin@aurex26.dev`       | admin       |
| `organizer@aurex26.dev`   | organizer   |
| `participant@aurex26.dev` | participant |
| `sam@aurex26.dev`         | participant |

## Tables

| Table           | Holds                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| `users`         | Everyone. `role` is `admin`, `organizer` or `participant`                |
| `workshops`     | Workshop details, venue/meeting link, configurable `registration_fields`, status, threshold |
| `registrations` | Participant ↔ workshop, with `status` and `form_responses`               |
| `sessions`      | Sessions of a workshop, plus the current `attendance_code`               |
| `attendance`    | One row per participant per attended session                             |
| `certificates`  | Issued certificates with a public `certificate_code` for QR verification |
| `announcements` | Workshop announcements (`workshop_id` NULL = portal-wide)                |

View `workshop_attendance_summary` gives `attendance_percentage` and `certificate_eligible`
(≥ `workshops.certificate_threshold`, default 90) for each approved registration.

## Changing the schema

Edit `schema.sql` (and `seed.sql` if needed), re-run both, and note any change that affects
API responses in `docs/API.md`. There are no migrations; for a 24-hour build, resetting is simpler.
