# API Reference

> **Owner:** backend developer. This file is the contract between backend and frontend.
> The frontend builds only against endpoints documented here. Change an endpoint here
> **before or together with** the code change, never after.

- **Base URL (dev):** `http://localhost:5000/api` (the Vite dev server proxies `/api`, so the client calls `/api/...`)
- **Format:** JSON request and response bodies (`Content-Type: application/json`), except PDF downloads.
- **Dates:** ISO 8601 strings in UTC, e.g. `2026-10-01T09:30:00.000Z`. Date-only fields use `YYYY-MM-DD`.
- **IDs:** integers.

---

## Conventions

### Response envelope

Every JSON response has the same shape.

Success:

```json
{
  "success": true,
  "message": "Optional human-readable message",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "What went wrong",
  "errors": [{ "field": "email", "message": "Email is required" }]
}
```

`errors` is present only on validation failures (`400`).

### List responses

Lists return an array in `data`. Paginated lists also return `meta`:

```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 57 }
}
```

Query params: `?page=1&limit=20`.

### Authentication

- Log in to get a JWT, then send it on every protected request:
  `Authorization: Bearer <token>`
- Tokens expire after `JWT_EXPIRES_IN` (default 1 day). On `401` the client clears the token and redirects to login.
- The JWT payload contains `{ id, role }`.

### Roles

| Role          | Can                                                                       |
| ------------- | ------------------------------------------------------------------------- |
| `admin`       | Everything; manage users and organizers; portal-wide announcements        |
| `organizer`   | Manage **own** workshops, sessions, registrations, attendance, certificates |
| `participant` | Browse, register, mark attendance, download own certificates              |

Endpoint tables below use: **Public** (no token), **Auth** (any logged-in user), or a role list.

### Status codes

| Code  | Meaning                                                          |
| ----- | ---------------------------------------------------------------- |
| `200` | OK                                                               |
| `201` | Created                                                          |
| `400` | Validation error (see `errors`)                                  |
| `401` | Missing, invalid or expired token                                |
| `403` | Logged in but not allowed (wrong role or not the owner)          |
| `404` | Not found                                                        |
| `409` | Conflict (duplicate email, already registered, already marked)   |
| `500` | Server error                                                     |

---

## Implemented endpoints

### `GET /api/health`

**Access:** Public

Response `200`:

```json
{
  "success": true,
  "message": "Aurex26 API is running"
}
```

---

## Planned endpoints

Not implemented yet. Paths and access rules are the agreed plan. The backend developer
adds request/response examples to each section as the endpoint lands, and moves it into
**Implemented endpoints**.

### Auth

| Method | Path                 | Access | Purpose                                  |
| ------ | -------------------- | ------ | ---------------------------------------- |
| POST   | `/api/auth/register` | Public | Participant self sign-up                 |
| POST   | `/api/auth/login`    | Public | Returns `{ token, user }`                |
| GET    | `/api/auth/me`       | Auth   | Current user profile                     |

### Users

| Method | Path                  | Access | Purpose                                |
| ------ | --------------------- | ------ | -------------------------------------- |
| GET    | `/api/users`          | admin  | List users (filter `?role=`)           |
| POST   | `/api/users`          | admin  | Create an organizer or admin           |
| PATCH  | `/api/users/:id`      | admin  | Update role / activate / deactivate    |

### Workshops

| Method | Path                           | Access           | Purpose                                              |
| ------ | ------------------------------ | ---------------- | ---------------------------------------------------- |
| GET    | `/api/workshops`               | Public           | Discover published workshops (`?search=&category=&mode=`) |
| GET    | `/api/workshops/:id`           | Public           | Workshop detail (meeting link only for registered users) |
| GET    | `/api/workshops/mine`          | organizer, admin | Workshops I organize (all statuses)                  |
| POST   | `/api/workshops`               | organizer, admin | Create (status `draft`)                              |
| PUT    | `/api/workshops/:id`           | owner, admin     | Update details, venue, meeting link, registration fields |
| PATCH  | `/api/workshops/:id/status`    | owner, admin     | Publish / complete / cancel                          |
| DELETE | `/api/workshops/:id`           | owner, admin     | Delete a draft                                       |

### Registrations

| Method | Path                                         | Access       | Purpose                                     |
| ------ | -------------------------------------------- | ------------ | ------------------------------------------- |
| POST   | `/api/workshops/:id/register`                | participant  | Register, with `form_responses`             |
| DELETE | `/api/workshops/:id/register`                | participant  | Cancel own registration                     |
| GET    | `/api/registrations/mine`                    | participant  | My registrations + attendance %             |
| GET    | `/api/workshops/:id/registrations`           | owner, admin | Participant list with attendance %          |
| PATCH  | `/api/registrations/:id`                     | owner, admin | Approve / reject                            |

### Sessions

| Method | Path                                   | Access       | Purpose                                     |
| ------ | -------------------------------------- | ------------ | ------------------------------------------- |
| GET    | `/api/workshops/:id/sessions`          | Auth         | Sessions of a workshop                      |
| POST   | `/api/workshops/:id/sessions`          | owner, admin | Add session                                 |
| PUT    | `/api/sessions/:id`                    | owner, admin | Update session                              |
| DELETE | `/api/sessions/:id`                    | owner, admin | Delete session                              |

### Attendance

| Method | Path                                    | Access       | Purpose                                              |
| ------ | --------------------------------------- | ------------ | ---------------------------------------------------- |
| POST   | `/api/sessions/:id/attendance/open`     | owner, admin | Open attendance; returns `{ code, qrDataUrl, expiresAt }` |
| POST   | `/api/sessions/:id/attendance/close`    | owner, admin | Close attendance                                     |
| POST   | `/api/attendance/mark`                  | participant  | Mark self present with `{ code }` (from QR or typed)  |
| POST   | `/api/sessions/:id/attendance/manual`   | owner, admin | Mark a participant present manually                  |
| GET    | `/api/sessions/:id/attendance`          | owner, admin | Who attended this session                            |

### Certificates

| Method | Path                                      | Access       | Purpose                                             |
| ------ | ----------------------------------------- | ------------ | --------------------------------------------------- |
| POST   | `/api/workshops/:id/certificates`         | owner, admin | Issue certificates to everyone at or above the threshold (90%) |
| GET    | `/api/certificates/mine`                  | participant  | My certificates                                     |
| GET    | `/api/certificates/:code/pdf`             | Auth (owner of certificate), admin | Download certificate PDF      |
| GET    | `/api/certificates/verify/:code`          | Public       | Verify authenticity (target of the certificate QR)  |

### Announcements

| Method | Path                                     | Access       | Purpose                               |
| ------ | ---------------------------------------- | ------------ | ------------------------------------- |
| GET    | `/api/announcements`                     | Auth         | Portal-wide + my workshops' announcements |
| GET    | `/api/workshops/:id/announcements`       | Auth         | Announcements for one workshop        |
| POST   | `/api/workshops/:id/announcements`       | owner, admin | Post a workshop announcement          |
| POST   | `/api/announcements`                     | admin        | Post a portal-wide announcement       |
| DELETE | `/api/announcements/:id`                 | author, admin | Delete                               |

### Dashboards

| Method | Path                         | Access      | Purpose                                            |
| ------ | ---------------------------- | ----------- | -------------------------------------------------- |
| GET    | `/api/dashboard/admin`       | admin       | Portal totals (users, workshops, registrations, certificates) |
| GET    | `/api/dashboard/organizer`   | organizer   | My workshops with registration and attendance stats |
| GET    | `/api/dashboard/participant` | participant | Upcoming sessions, attendance %, certificates      |
