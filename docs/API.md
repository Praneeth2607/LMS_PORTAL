# API Reference

> **Owner:** backend developer. This file is the contract between backend and frontend.
> Build the frontend against this document only. Any change to an endpoint is made here first.

- **Base URL (dev):** `/api`. The Vite dev server proxies `/api` to `http://localhost:5000`.
- **Format:** JSON in, JSON out (`Content-Type: application/json`). The only exception is the certificate PDF download.
- **Naming:** JSON keys are `camelCase`. Enum values are `UPPERCASE`.
- **Dates:** date-only fields are `"YYYY-MM-DD"`. Times are `"HH:MM"` (24h). Timestamps (`createdAt`, `markedAt`, …) are ISO 8601 UTC strings.
- **IDs:** integers, except `certificateId`, which is a string such as `"CICT26-KB7F2E3U"`.
- **Demo accounts:** see [database/README.md](../database/README.md). Password for all: `Password@123`.

## Contents

1. [Conventions](#conventions)
2. [Auth](#auth)
3. [Workshops](#workshops)
4. [Registrations](#registrations)
5. [Sessions](#sessions)
6. [Attendance](#attendance)
7. [Certificates](#certificates)
8. [Announcements](#announcements)
9. [Admin](#admin)
10. [Frontend integration notes](#frontend-integration-notes)
11. [Endpoint index](#endpoint-index)

---

## Conventions

### Response envelope

Success:

```json
{ "success": true, "message": "Optional human-readable text", "data": { } }
```

`data` may be an object, an array or `null`. `message` is included only where it is useful as a toast.

Error:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "Email must be a valid email address" }]
}
```

`errors` is present only on validation failures. Show `message` to the user, and map `errors[].field` onto
form inputs. For registration form answers, `field` is the registration field's `fieldName`.

### Authentication

1. `POST /api/auth/login` (or `/register`) returns `data.token`.
2. Send it on every request: `Authorization: Bearer <token>`.
3. Tokens expire after 1 day. **Any `401` means the token is missing, invalid or expired, or the account was suspended**: clear it and redirect to login. Show `message` on the sign-in page, since it explains a suspension.

### Access levels used below

| Label           | Meaning                                                                               |
| --------------- | ------------------------------------------------------------------------------------- |
| **Public**      | No token needed                                                                       |
| **Optional**    | Works without a token; with one, the response is personalised (e.g. `isRegistered`)   |
| **Auth**        | Any logged-in user                                                                    |
| **Manager**     | Role `ORGANIZER` or `ADMIN`. An organizer can manage **only workshops they created**; admins can manage all |
| **Participant** | Role `PARTICIPANT` only                                                               |
| **Admin**       | Role `ADMIN` only                                                                     |

### Status codes

| Code  | When                                                                                     |
| ----- | ---------------------------------------------------------------------------------------- |
| `200` | OK                                                                                       |
| `201` | Created                                                                                  |
| `400` | Validation error, bad ID, malformed JSON, invalid attendance token/code, attendance not open |
| `401` | Missing / invalid / expired token, or wrong login credentials                             |
| `403` | Logged in, but wrong role or not the owner of the workshop                                |
| `404` | Not found. **Draft workshops return 404** to anyone who cannot manage them               |
| `409` | Conflict: duplicate email, already registered, workshop full, registration closed, already marked present |
| `410` | Attendance QR/code has expired                                                            |
| `500` | Server error                                                                              |

### Enums

| Enum                 | Values                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| User role            | `ADMIN`, `ORGANIZER`, `PARTICIPANT`                                    |
| Workshop mode        | `ONLINE`, `OFFLINE`, `HYBRID`                                          |
| Workshop status      | `DRAFT` → `PUBLISHED` → `CLOSED`                                       |
| Registration status  | `REGISTERED`, `CANCELLED`                                              |
| Registration field type | `TEXT`, `TEXTAREA`, `EMAIL`, `PHONE`, `NUMBER`, `DATE`, `SELECT`, `CHECKBOX` |
| Attendance status    | `PRESENT`, `ABSENT`                                                    |
| Attendance method    | `QR`, `CODE`, `MANUAL`                                                 |

Workshop status meanings:

- `DRAFT`: visible only to its organizer and admins.
- `PUBLISHED`: visible to everyone and open for registration.
- `CLOSED`: still visible, but registration is closed. Attendance and certificates keep working.

Enum inputs are case-insensitive (`"hybrid"` is accepted), and responses are always uppercase.

---

## Auth

### POST `/api/auth/register`

Self sign-up. **Always creates a `PARTICIPANT`**; any `role` field in the request is ignored.

Organizers are created by an admin, either directly ([POST /api/admin/users](#post-apiadminusers)) or by approving an
[organizer request](#post-apiauthorganizer-requests).

**Access:** Public

Request:

```json
{ "name": "Vikram Singh", "email": "vikram@example.com", "password": "Password@123" }
```

| Field      | Rules                              |
| ---------- | ---------------------------------- |
| `name`     | required, 2–120 chars              |
| `email`    | required, valid email (stored lowercase) |
| `password` | required, 8–72 chars               |

Response `201`:

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "id": 10, "name": "Vikram Singh", "email": "vikram@example.com", "role": "PARTICIPANT",
      "createdAt": "2026-09-23T06:54:08.819Z", "updatedAt": "2026-09-23T06:54:08.819Z"
    }
  }
}
```

Errors:

- `400` validation.
- `403` `"This email can't be used to create an account. Please contact the CICT admin."`: the email belongs to a suspended account, or to a suspended account that an admin deleted. Only an admin can create an account with it.
- `409` email already registered, or an organizer request for this email is still waiting for approval.

### POST `/api/auth/organizer-requests`

Ask an admin for an organizer account (the "Request organizer access" page).

**Access:** Public

Request:

```json
{
  "name": "Deepa Raman",
  "email": "deepa@college.edu",
  "password": "Organizer@123",
  "designation": "Lab In-charge, CICT",
  "reason": "To run the IoT hands-on workshop series."
}
```

| Field         | Rules                     |
| ------------- | ------------------------- |
| `name`        | required, 2–120 chars     |
| `email`       | required, valid email     |
| `password`    | required, 8–72 chars. Stored only as a bcrypt hash; it becomes the organizer's password on approval |
| `designation` | required, 2–120 chars     |
| `reason`      | required, 10–1000 chars   |

Response `201` (message `"Request sent. You can sign in once an admin approves it."`):

```json
{ "id": 3, "name": "Deepa Raman", "email": "deepa@college.edu", "designation": "Lab In-charge, CICT",
  "reason": "To run the IoT hands-on workshop series.", "status": "PENDING", "createdAt": "2026-09-24T07:25:00.000Z" }
```

Until the request is approved, signing in with these details returns a `403` explaining that it is pending (see [login](#post-apiauthlogin)).

Errors:

- `400` validation.
- `403` the email is blocked (see [DELETE /api/admin/users/:id](#delete-apiadminusersid)).
- `409` the email already has an account, or already has a pending request.

A rejected applicant can send a new request.

### POST `/api/auth/login`

**Access:** Public

Request: `{ "email": "meera@aurex26.dev", "password": "Password@123", "portal": "ORGANIZER" }`

`portal` (optional) says which sign-in tab is being used:

- `"PARTICIPANT"` accepts participant accounts only.
- `"ORGANIZER"` accepts organizer and admin accounts only.
- Omitted: any role is accepted.

The web app always sends it. On a mismatch, no token is issued.

Response `200`: same `data` shape as register (`{ token, user }`), with message `"Login successful"`.

Errors:

- `400` validation.
- `401` `"Invalid email or password"`.
- `403`, only after a correct password:
  - `"Your account has been suspended. Please contact the CICT admin."`
  - `"Your organizer request is waiting for admin approval. You can sign in once it is approved."`
  - `"Your organizer request was not approved. Please contact the CICT admin."`
  - `"This is an organizer account. Please use the Organizer sign-in."` (or `"…an admin account…"`, or `"This is a participant account. Please use the Participant sign-in."`) when `portal` does not match the account.

### GET `/api/auth/me`

Current user. Use it on app load to restore the session from a stored token.

**Access:** Auth

Response `200`: `data` is the `user` object shown above.

Errors: `401`

---

## Workshops

### Workshop object

Returned by list, detail, create, update, publish and close.

```json
{
  "id": 2,
  "title": "Machine Learning Fundamentals with Python",
  "description": "Supervised and unsupervised learning with scikit-learn...",
  "startDate": "2026-09-23",
  "endDate": "2026-09-26",
  "mode": "OFFLINE",
  "venue": "CICT Seminar Hall",
  "meetingLink": null,
  "capacity": 60,
  "status": "PUBLISHED",
  "createdBy": 3,
  "organizerName": "Arjun Rao",
  "registeredCount": 4,
  "sessionCount": 4,
  "isRegistered": true,
  "canManage": false,
  "createdAt": "2026-09-23T06:54:08.819Z",
  "updatedAt": "2026-09-23T06:54:08.819Z"
}
```

- `meetingLink` is `null` unless the viewer manages the workshop or is registered for it. Use this to
  show "Register to get the meeting link".
- `isRegistered`: the viewer has an active registration (always `false` for guests, organizers and admins).
- `canManage`: the viewer may edit it and see its registrations, attendance and certificates. Use it to show organizer controls.
- `capacity`: `null` means unlimited. Seats left = `capacity - registeredCount`.

The **detail** endpoint also includes `registrationFields`:

```json
"registrationFields": [
  { "id": 7, "fieldName": "Roll Number", "fieldType": "TEXT", "required": true, "fieldOrder": 1, "options": null },
  { "id": 6, "fieldName": "Python Experience", "fieldType": "SELECT", "required": true, "fieldOrder": 2,
    "options": ["None", "Beginner", "Intermediate", "Advanced"] },
  { "id": 5, "fieldName": "Bringing own laptop", "fieldType": "CHECKBOX", "required": false, "fieldOrder": 3, "options": null }
]
```

### GET `/api/workshops`

Workshop discovery.

**Access:** Optional

What the viewer sees:

- Guests and participants: `PUBLISHED` and `CLOSED` workshops.
- Organizers: the same, plus their own drafts.
- Admins: everything.

Query parameters (all optional):

| Param    | Example           | Effect                                       |
| -------- | ----------------- | -------------------------------------------- |
| `search` | `?search=python`  | Matches title or description                 |
| `status` | `?status=PUBLISHED` | Filter by status                           |
| `mode`   | `?mode=ONLINE`    | Filter by mode                               |
| `mine`   | `?mine=true`      | Only workshops created by the logged-in user |

Sort order: open workshops first (by start date), then closed ones.

Response `200`: `data` is an array of [workshop objects](#workshop-object) (without `registrationFields`).

Errors: `400` invalid filter value

### GET `/api/workshops/:id`

**Access:** Optional

Response `200`: a [workshop object](#workshop-object) **with** `registrationFields`.

Errors: `400` bad id · `404` not found (or a draft you cannot manage)

### POST `/api/workshops`

Creates a workshop with status `DRAFT`.

**Access:** Manager

Request:

```json
{
  "title": "Git & GitHub Essentials",
  "description": "Version control from zero to pull requests.",
  "startDate": "2026-10-05",
  "endDate": "2026-10-06",
  "mode": "HYBRID",
  "venue": "CICT Lab 3",
  "meetingLink": "https://meet.google.com/abc-defg-hij",
  "capacity": 50,
  "registrationFields": [
    { "fieldName": "Roll Number", "fieldType": "TEXT", "required": true },
    { "fieldName": "Year of Study", "fieldType": "SELECT", "required": true, "options": ["1", "2", "3", "4"] },
    { "fieldName": "Phone", "fieldType": "PHONE", "required": false }
  ]
}
```

| Field                | Rules                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| `title`              | required, max 200                                                     |
| `description`        | optional, max 5000                                                    |
| `startDate`, `endDate` | required, `YYYY-MM-DD`, `endDate >= startDate`                      |
| `mode`               | optional, default `OFFLINE`                                           |
| `venue`              | optional, max 255                                                     |
| `meetingLink`        | optional, http(s) URL                                                 |
| `capacity`           | optional integer ≥ 1; omit or `null` = unlimited                      |
| `registrationFields` | optional array (max 20) of `{ fieldName, fieldType, required, fieldOrder?, options? }` |

Registration field rules:

- `fieldName` is required, at most 100 characters, and must be unique within the workshop (case-insensitive).
- `fieldType` defaults to `TEXT`.
- `required` defaults to `false`.
- `fieldOrder` defaults to the item's position in the array.
- `options` is required for `SELECT` and must be a non-empty array of strings.

Response `201` (message `"Workshop created as draft"`): the [workshop object](#workshop-object) with `registrationFields`.

Errors: `400` validation · `401` · `403` not an organizer/admin

### PUT `/api/workshops/:id`

Partial update: send only the fields you want to change (same rules as create).

- To clear an optional field, send `null`, e.g. `"meetingLink": null`.
- Sending `registrationFields` **replaces the whole list**. Omit it to leave the fields unchanged.
- `status` cannot be changed here; use publish / close.

**Access:** Manager (owner or admin)

Response `200` (message `"Workshop updated"`): workshop object with `registrationFields`.

Errors: `400` · `401` · `403` not the owner · `404`

### DELETE `/api/workshops/:id`

Deleting a workshop also deletes its sessions, registrations, attendance and announcements.

**Access:** Manager (owner or admin)

Response `200`: `{ "success": true, "message": "Workshop deleted", "data": null }`

Errors:

- `409` certificates have already been issued (close the workshop instead).
- `409` an organizer tried to delete a workshop that has registered participants (admins can).
- Also `401`, `403` and `404`.

### PATCH `/api/workshops/:id/publish`

Sets status to `PUBLISHED`, which makes it visible and opens registration. Also re-opens a `CLOSED` workshop.

Before publishing, the workshop must have:

- a `venue`, if the mode is `OFFLINE` or `HYBRID`;
- a `meetingLink`, if the mode is `ONLINE` or `HYBRID`.

**Access:** Manager (owner or admin)

Request body: none.

Response `200` (message `"Workshop published"`): workshop object.

Errors: `400` `"Workshop is not ready to publish"` with `errors: [{ field: "venue" | "meetingLink", ... }]` · `401` · `403` · `404`

### PATCH `/api/workshops/:id/close`

Sets status to `CLOSED`, which stops new registrations. Attendance and certificates keep working.

**Access:** Manager (owner or admin)

Response `200` (message `"Workshop closed"`): workshop object.

Allowed only between `attendanceOpensAt` (session start) and `attendanceClosesAt` (2 hours after the session ends). If fewer minutes than `durationMinutes` remain before the close time, the code expires at the close time and `durationMinutes` in the response is reduced to match.

Errors:

- `409` for any of these messages:
  - `"Attendance can be started from the session start time (14:00 on 2026-09-23)"`
  - `"Attendance for this session closed 2 hours after it ended"`
  - the workshop is still a draft
- Also `401`, `403` and `404`.

---

## Registrations

### POST `/api/workshops/:id/register`

Registers the logged-in participant. Answers are validated against the workshop's `registrationFields`.

**Access:** Participant

Request (keys of `formData` are the `fieldName`s):

```json
{
  "formData": {
    "Roll Number": "21CS045",
    "Python Experience": "Intermediate",
    "Bringing own laptop": true
  }
}
```

How each field type is validated:

| `fieldType` | Accepted value                                                 |
| ----------- | -------------------------------------------------------------- |
| `TEXT`      | string ≤ 500                                                   |
| `TEXTAREA`  | string ≤ 2000                                                  |
| `EMAIL`     | valid email                                                    |
| `PHONE`     | 7–18 digits; may start with `+` and contain spaces or dashes   |
| `NUMBER`    | number or numeric string                                       |
| `DATE`      | `YYYY-MM-DD`                                                   |
| `SELECT`    | one of `options`                                               |
| `CHECKBOX`  | `true` / `false` (a required checkbox must be `true`)          |

Unknown keys are silently dropped. A participant who previously cancelled can register again.

Response `201` (message `"Registered successfully"`):

```json
{
  "id": 11, "workshopId": 2, "participantId": 9,
  "formData": { "Roll Number": "21CS045", "Python Experience": "Intermediate", "Bringing own laptop": true },
  "status": "REGISTERED",
  "registeredAt": "2026-09-23T07:10:00.000Z", "updatedAt": "2026-09-23T07:10:00.000Z"
}
```

Errors:

- `400` validation. `errors[].field` is the `fieldName`.
- `403` the user is not a participant.
- `404` workshop not found.
- `409` for any of these messages:
  - `"You are already registered for this workshop"`
  - `"This workshop is full"`
  - `"Registration is closed for this workshop"`
- Also `401`.

### DELETE `/api/workshops/:id/register`

Cancels the logged-in participant's registration.

**Access:** Participant

Response `200` (message `"Registration cancelled"`): the registration with `"status": "CANCELLED"`.

Errors: `404` not registered · `401` · `403`

### GET `/api/workshops/:id/registrations`

Participant list for the organizer.

**Access:** Manager (owner or admin)

Query: `?status=REGISTERED` or `?status=CANCELLED` (optional; default is all).

Response `200`:

```json
[
  {
    "id": 1,
    "participantId": 4,
    "participantName": "Priya Sharma",
    "participantEmail": "priya@aurex26.dev",
    "formData": { "Roll Number": "21CS045", "Python Experience": "Intermediate", "Bringing own laptop": true },
    "status": "REGISTERED",
    "registeredAt": "2026-09-15T18:30:00.000Z"
  }
]
```

Errors: `401` · `403` · `404`

### GET `/api/my-workshops`

The logged-in user's workshops. **The response shape depends on role.**

**Access:** Auth

**PARTICIPANT** gets their registrations (including cancelled ones). Attendance and eligibility are calculated by the server:

```json
[
  {
    "registrationId": 9,
    "registrationStatus": "REGISTERED",
    "registeredAt": "2026-09-22T18:30:00.000Z",
    "formData": { "Roll Number": "22IT077" },
    "workshop": {
      "id": 3, "title": "Cybersecurity Essentials: Web Application Security", "description": "...",
      "startDate": "2026-10-03", "endDate": "2026-10-04", "mode": "ONLINE", "venue": null,
      "meetingLink": "https://zoom.us/j/9876543210", "status": "PUBLISHED", "organizerName": "Dr. Meera Krishnan"
    },
    "attendance": { "totalSessions": 2, "completedSessions": 0, "attendedSessions": 0, "percentage": 0, "threshold": 90, "eligible": false },
    "certificate": null
  }
]
```

`certificate` is `{ "certificateId": "CICT26-KB7F2E3U", "issuedAt": "..." }` once issued.

**ORGANIZER / ADMIN** get the workshops they created: an array of [workshop objects](#workshop-object), the same as `GET /api/workshops?mine=true`.

---

## Sessions

### Session object

```json
{
  "id": 11,
  "workshopId": 2,
  "title": "Python for Data Science Refresher",
  "sessionDate": "2026-09-23",
  "startTime": "14:00",
  "endTime": "16:00",
  "startsAt": "2026-09-23T08:30:00.000Z",
  "endsAt": "2026-09-23T10:30:00.000Z",
  "startedAt": null,
  "status": "READY",
  "meetingLink": "https://meet.google.com/abc-defg-hij",
  "attendanceOpen": false,
  "attendanceExpiresAt": null,
  "createdAt": "2026-09-23T06:54:08.819Z",
  "updatedAt": "2026-09-23T06:54:08.819Z",
  "myAttendanceStatus": null,
  "attendanceCode": null
}
```

- `status`: where the session is in its lifecycle, calculated by the server:

  | `status`     | Meaning                                                              |
  | ------------ | -------------------------------------------------------------------- |
  | `SCHEDULED`  | Start time not reached yet                                           |
  | `READY`      | Start time reached; the organizer can press Start                    |
  | `ONGOING`    | The organizer started it ([POST /api/sessions/:id/start](#post-apisessionsidstart)) and it hasn't ended |
  | `COMPLETED`  | End time has passed                                                  |

- `startsAt` / `endsAt`: the session's start and end as exact UTC timestamps (`sessionDate` + `startTime`/`endTime` in the institute timezone, `APP_TIMEZONE`, default Asia/Kolkata). Compare these with the current time to switch a button on at the right moment without reloading; `status` is only as fresh as the last request.
- `startedAt`: when the organizer pressed Start, or `null`. Editing the date or times clears it.
- `meetingLink`: the session's own link, falling back to the workshop's. It is `null` unless the viewer is registered or manages the workshop.
- `attendanceOpen`: `true` while the QR/code is accepting scans (started and not expired).
- `myAttendanceStatus`: **participants only**. `"PRESENT"`, `"ABSENT"` or `null` (not marked).
- `attendanceCode`: **managers only**. The 6-character fallback code while attendance is open, otherwise `null`.
- `attendanceOpensAt` / `attendanceClosesAt`: **managers only**. The window in which [start attendance](#post-apisessionsidattendancestart) is allowed: from the session start until 2 hours after it ends (`ATTENDANCE_CLOSE_AFTER_END_MINUTES`).
- The QR token itself is never included; it is only returned by [start](#post-apisessionsidattendancestart).

### GET `/api/workshops/:id/sessions`

**Access:** Optional (same visibility as the workshop)

Response `200`: array of session objects ordered by date and time.

Errors: `404`

### POST `/api/workshops/:id/sessions`

**Access:** Manager (owner or admin)

Request:

```json
{ "title": "Git basics", "sessionDate": "2026-10-05", "startTime": "09:00", "endTime": "10:30", "meetingLink": null }
```

| Field         | Rules                                                     |
| ------------- | --------------------------------------------------------- |
| `title`       | required, max 200                                         |
| `sessionDate` | required, must be within the workshop's start/end dates   |
| `startTime`, `endTime` | required `HH:MM`, `endTime > startTime`          |
| `meetingLink` | optional URL (overrides the workshop link for this session) |

Response `201` (message `"Session created"`): session object.

Errors: `400` · `401` · `403` · `404`

### GET `/api/sessions/:id`

Single session. Useful for the attendance page, to show which session is being marked.

**Access:** Optional

Response `200`: session object. Errors: `404`

### PUT `/api/sessions/:id`

Partial update; the fields and rules are the same as create.

**Access:** Manager (owner or admin)

Response `200` (message `"Session updated"`): session object.

Errors: `400` · `401` · `403` · `404`

### POST `/api/sessions/:id/start`

The organizer starts the session, which makes it `ONGOING`. Allowed from the scheduled start time until the end time, and
checked against the server clock. Pressing it again while `ONGOING` is fine: it returns the session unchanged, which
is useful for reopening the meeting link. For online and hybrid workshops the frontend opens `meetingLink` after a
successful start.

**Access:** Manager (owner or admin)

Request body: none.

Response `200` (message `"Session started"`): the [session object](#session-object) with `"status": "ONGOING"` and `startedAt` set.

Errors:

- `409` for any of these messages:
  - `"This session can be started from 14:00 on 2026-09-23"` (too early)
  - `"This session has already ended"`
  - `"Publish the workshop before starting its sessions"`
- Also `401`, `403` and `404`.

### DELETE `/api/sessions/:id`

Also deletes that session's attendance records, so attendance percentages are recalculated without it.

**Access:** Manager (owner or admin)

Response `200`: `{ "success": true, "message": "Session deleted", "data": null }`

Errors: `401` · `403` · `404`

---

## Attendance

Attendance percentage = sessions attended ÷ sessions **completed so far** × 100, rounded to 2 decimals.

- A session counts as completed once its end time has passed (institute timezone).
- `attendedSessions` counts only completed sessions, so attendance marked during a session counts once it ends.
- Every attendance object also carries `totalSessions` (all scheduled sessions) and `completedSessions`.
- `percentage` is `0` and `eligible` is `false` until at least one session has completed.
It is always calculated by the server and never accepted from the client.

### POST `/api/sessions/:id/attendance/start`

Opens attendance for a session. Each call generates a **new** random token and code, which invalidates any previous QR code.

**Access:** Manager (owner or admin)

Request (optional): `{ "durationMinutes": 15 }`. Must be between 1 and 240; the default is 15.

Response `200` (message `"Attendance started"`):

```json
{
  "sessionId": 11,
  "sessionTitle": "Python for Data Science Refresher",
  "workshopId": 2,
  "attendanceActive": true,
  "attendanceUrl": "http://localhost:5173/attendance/11?token=Xk3...43chars",
  "qrCode": "data:image/png;base64,iVBORw0KGgo...",
  "attendanceCode": "K7M2QX",
  "durationMinutes": 15,
  "expiresAt": "2026-09-23T07:25:00.000Z"
}
```

What to show on the organizer's screen:

- Display `qrCode` directly with `<img src={qrCode} />`.
- Show `attendanceCode` in large text as the manual fallback.
- Show a countdown to `expiresAt`.
- To re-open or extend attendance, call start again.

Errors: `409` workshop is still a draft · `401` · `403` · `404`

### POST `/api/sessions/:id/attendance/mark`

The participant marks themselves present, using either the QR token or the typed code.

**Access:** Participant

Request, either form:

```json
{ "token": "Xk3...from the ?token= query parameter of the scanned URL" }
```

```json
{ "code": "K7M2QX" }
```

`code` is case-insensitive.

The server checks, in order:

1. The session exists.
2. Attendance is open.
3. The token or code is correct.
4. It has not expired.
5. The user is logged in as a participant.
6. The user is registered for the workshop.
7. The user is not already marked present.

Response `200` (message `"Attendance marked"`):

```json
{
  "sessionId": 11,
  "sessionTitle": "Python for Data Science Refresher",
  "workshopId": 2,
  "workshopTitle": "Machine Learning Fundamentals with Python",
  "status": "PRESENT",
  "method": "QR",
  "markedAt": "2026-09-23T07:12:31.000Z"
}
```

Errors:

| Status | `message`                                                        |
| ------ | ---------------------------------------------------------------- |
| `400`  | `"Provide the token from the QR code or the attendance code"`    |
| `400`  | `"Attendance is not open for this session"`                      |
| `400`  | `"Invalid attendance QR code"` / `"Invalid attendance code"`     |
| `401`  | not logged in (redirect to login, then retry)                     |
| `403`  | `"You are not registered for this workshop"` (or not a participant) |
| `404`  | `"Session not found"`                                             |
| `409`  | `"Your attendance is already marked for this session"`           |
| `410`  | `"This attendance QR/code has expired"`                           |

### POST `/api/sessions/:id/attendance/stop`

Closes attendance immediately. The token and code stop working.

**Access:** Manager (owner or admin)

Response `200` (message `"Attendance stopped"`):

```json
{ "sessionId": 11, "attendanceActive": false, "presentCount": 23 }
```

Errors: `401` · `403` · `404`

### POST `/api/sessions/:id/attendance/manual`

Organizer override: marks a registered participant `PRESENT` or `ABSENT`. Works whether or not attendance is open.

**Access:** Manager (owner or admin)

Request: `{ "participantId": 4, "status": "PRESENT" }`

Response `200` (message `"Attendance updated"`):

```json
{ "id": 51, "sessionId": 11, "participantId": 4, "status": "PRESENT", "method": "MANUAL", "markedAt": "2026-09-23T07:20:00.000Z" }
```

Errors: `400` validation or participant not registered · `401` · `403` · `404`

### GET `/api/workshops/:id/attendance`

Attendance grid: every session, and each registered participant's record for each one.

**Access:** Manager (owner or admin)

Response `200`:

```json
{
  "sessions": [
    { "id": 1, "title": "Kickoff & Modern JavaScript", "sessionDate": "2026-09-09", "startTime": "10:00", "endTime": "12:30", "status": "COMPLETED", "attendanceOpen": false }
  ],
  "participants": [
    {
      "participantId": 6,
      "participantName": "Ananya Iyer",
      "participantEmail": "ananya@aurex26.dev",
      "totalSessions": 10,
      "completedSessions": 10,
      "attendedSessions": 7,
      "percentage": 70,
      "threshold": 90,
      "eligible": false,
      "sessions": {
        "1": { "status": "PRESENT", "method": "QR", "markedAt": "2026-09-09T04:38:00.000Z" },
        "2": { "status": "ABSENT", "method": "MANUAL", "markedAt": "2026-09-10T04:38:00.000Z" }
      }
    }
  ]
}
```

`participants[].sessions` is keyed by session id. A missing key means the participant has not been marked for that session, which counts as not attended.

Errors: `401` · `403` · `404`

### GET `/api/workshops/:id/attendance/summary`

Percentage and certificate eligibility per registered participant.

**Access:** Manager (owner or admin)

Response `200`:

```json
{
  "workshopId": 1,
  "threshold": 90,
  "totalSessions": 10,
  "completedSessions": 10,
  "eligibleCount": 2,
  "participants": [
    { "participantId": 5, "participantName": "Rahul Verma", "participantEmail": "rahul@aurex26.dev",
      "totalSessions": 10, "completedSessions": 10, "attendedSessions": 9, "percentage": 90, "threshold": 90, "eligible": true }
  ]
}
```

`eligible` is `attendedSessions / completedSessions >= 90%`, and `false` until a session has completed.
**Do not compute eligibility in the frontend; use this field.**

Errors: `401` · `403` · `404`

---

## Certificates

### Certificate object

Private view, visible to the participant, the workshop organizer and admins:

```json
{
  "certificateId": "CICT26-KB7F2E3U",
  "participantId": 4,
  "participantName": "Priya Sharma",
  "workshopId": 5,
  "workshopTitle": "Git & GitHub Essentials",
  "startDate": "2026-10-05",
  "endDate": "2026-10-06",
  "organizerName": "Dr. Meera Krishnan",
  "attendancePercentage": 100,
  "issuedAt": "2026-10-06T12:00:00.000Z",
  "verificationUrl": "http://localhost:5173/verify/CICT26-KB7F2E3U?token=...",
  "downloadUrl": "/api/certificates/CICT26-KB7F2E3U/download"
}
```

### POST `/api/workshops/:id/certificates/generate`

Issues certificates to every registered participant with ≥ 90% attendance who does not already have one.
Safe to call repeatedly: participants who already have a certificate are listed in `alreadyIssued` and are not issued a second one.

**Access:** Manager (owner or admin)

Request body: none.

Response `200` (message e.g. `"2 certificate(s) generated, 0 already issued, 2 not eligible"`):

```json
{
  "workshopId": 1,
  "threshold": 90,
  "totalSessions": 10,
  "generated": [
    { "participantId": 4, "participantName": "Priya Sharma", "attendedSessions": 10, "attendancePercentage": 100, "certificateId": "CICT26-KB7F2E3U" },
    { "participantId": 5, "participantName": "Rahul Verma", "attendedSessions": 9, "attendancePercentage": 90, "certificateId": "CICT26-9QX2M7PA" }
  ],
  "alreadyIssued": [],
  "notEligible": [
    { "participantId": 6, "participantName": "Ananya Iyer", "attendedSessions": 7, "attendancePercentage": 70 },
    { "participantId": 7, "participantName": "Karthik Nair", "attendedSessions": 5, "attendancePercentage": 50 }
  ]
}
```

Errors:

- `409` for any of these messages:
  - `"Certificates can be generated after the last session ends (2 of 4 sessions completed)"`
  - the workshop is a draft
  - the workshop has no sessions
- Also `401`, `403` and `404`.

Certificates can only be generated once **every** session has ended. Because attendance is based on completed sessions, generating earlier could certify someone who had attended only the first few.

### GET `/api/workshops/:id/certificates`

All certificates issued for a workshop.

**Access:** Manager (owner or admin)

Response `200`: array of [certificate objects](#certificate-object). Errors: `401` · `403` · `404`

### GET `/api/my-certificates`

**Access:** Participant

Response `200`: array of [certificate objects](#certificate-object), newest first.

### GET `/api/certificates/:id`

`:id` is the `certificateId`, e.g. `CICT26-KB7F2E3U`.

**Access:** Auth (the certificate's participant, the workshop's organizer, or an admin)

Response `200`: [certificate object](#certificate-object).

Errors: `401` · `403` someone else's certificate · `404`

### GET `/api/certificates/:id/download`

Returns the PDF file (`Content-Type: application/pdf`), **not JSON**. Add `?inline=true` to open it in the browser instead of downloading.

**Access:** Auth (same as above)

Because the request needs the `Authorization` header, a plain `<a href>` link won't work. Fetch the file as a blob instead:

```js
const res = await fetch(`/api/certificates/${certificateId}/download`, {
  headers: { Authorization: `Bearer ${token}` },
});
const url = URL.createObjectURL(await res.blob());
window.open(url); // or set it as an <a download> href
```

Errors (JSON): `401` · `403` · `404`

### GET `/api/certificates/verify/:certificateId`

Public verification. This is what the page opened by the certificate's QR code calls.

- The QR code encodes `FRONTEND_URL/verify/<certificateId>?token=<verificationToken>`. Pass that `token` through: `GET /api/certificates/verify/CICT26-KB7F2E3U?token=...`
- Without `token` (someone typing in the ID by hand), the ID alone is checked.
- The ID is case-insensitive.

**Access:** Public

**This endpoint always returns `200`.** Check `data.valid`.

Valid:

```json
{
  "success": true,
  "data": {
    "valid": true,
    "certificateId": "CICT26-KB7F2E3U",
    "participantName": "Priya Sharma",
    "workshopTitle": "Git & GitHub Essentials",
    "workshopStartDate": "2026-10-05",
    "workshopEndDate": "2026-10-06",
    "organizerName": "Dr. Meera Krishnan",
    "attendancePercentage": 100,
    "issuedAt": "2026-10-06T12:00:00.000Z",
    "tokenVerified": true
  }
}
```

Invalid:

```json
{ "success": true, "data": { "valid": false, "certificateId": "CICT26-NOTREAL1", "reason": "No certificate exists with this ID" } }
```

`reason` is either `"No certificate exists with this ID"` or `"The verification token does not match this certificate"`.
No email addresses or internal IDs are exposed.

---

## Announcements

### GET `/api/workshops/:id/announcements`

**Access:** Optional (same visibility as the workshop)

Response `200` (newest first):

```json
[
  {
    "id": 1, "workshopId": 1, "title": "Certificates",
    "message": "Certificates will be issued to participants with at least 90% attendance.",
    "createdBy": 2, "createdByName": "Dr. Meera Krishnan", "createdAt": "2026-09-19T06:54:08.819Z"
  }
]
```

Errors: `404`

### POST `/api/workshops/:id/announcements`

**Access:** Manager (owner or admin)

Request: `{ "title": "Slides uploaded", "message": "Find today's slides on the portal." }`. `title` is required (max 200); `message` is required (max 5000).

Response `201` (message `"Announcement posted"`): the announcement object.

Errors: `400` · `401` · `403` · `404`

---

## Admin

All `/api/admin/*` endpoints: **Access: Admin**. Other roles get `403`.

### GET `/api/admin/stats`

Response `200`:

```json
{
  "totals": {
    "users": 9, "admins": 1, "organizers": 2, "participants": 6,
    "workshops": 4, "draftWorkshops": 1, "publishedWorkshops": 2, "closedWorkshops": 1,
    "registrations": 10, "sessions": 16, "attendanceMarked": 31, "certificates": 2,
    "pendingOrganizerRequests": 1
  },
  "workshops": [
    {
      "id": 1, "title": "Full-Stack Web Development with React & Node.js", "status": "CLOSED",
      "startDate": "2026-09-09", "endDate": "2026-09-18", "organizerName": "Dr. Meera Krishnan",
      "registeredCount": 4, "sessionCount": 10, "presentCount": 31, "certificateCount": 2,
      "averageAttendance": 77.5
    }
  ]
}
```

- `registrations` counts active (`REGISTERED`) registrations.
- `attendanceMarked` counts `PRESENT` records.
- `averageAttendance` is `presentCount / (registeredCount × completedSessionCount) × 100`, over completed sessions only; `presentCount` also only counts completed sessions.

### GET `/api/admin/organizer-requests`

Query (optional): `?status=PENDING` | `APPROVED` | `REJECTED`. Without a status, all requests are returned, pending first.

Response `200`:

```json
[
  {
    "id": 3, "name": "Deepa Raman", "email": "deepa@college.edu", "designation": "Lab In-charge, CICT",
    "reason": "To run the IoT hands-on workshop series.", "status": "PENDING",
    "reviewedBy": null, "reviewedByName": null, "reviewedAt": null, "createdAt": "2026-09-24T07:25:00.000Z"
  }
]
```

### POST `/api/admin/organizer-requests/:id/approve`

Creates the `ORGANIZER` account, using the password the applicant chose, and marks the request `APPROVED`. The
password hash is then removed from the request. It also lifts a block on the email, if there is one.

Response `200` (message `"<name> is now an organizer and can sign in."`): `{ "request": { …, "status": "APPROVED" }, "user": { …, "role": "ORGANIZER" } }`

Errors: `404` · `409` already approved or rejected, or the email now has an account

### POST `/api/admin/organizer-requests/:id/reject`

Response `200` (message `"Request rejected"`): the request with `"status": "REJECTED"`.

Errors: `404` · `409` already approved or rejected

### GET `/api/admin/users`

Query (optional): `?role=ORGANIZER`, `?search=meera` (matches name or email).

Response `200`:

```json
[
  {
    "id": 4, "name": "Priya Sharma", "email": "priya@aurex26.dev", "role": "PARTICIPANT",
    "suspendedAt": null,
    "workshopsAttended": 2,
    "certificatesCount": 1,
    "createdAt": "2026-09-23T06:54:08.819Z", "updatedAt": "2026-09-23T06:54:08.819Z"
  }
]
```

- `suspendedAt`: `null` for active accounts, or when the account was suspended.
- `workshopsAttended`: workshops where the user was marked PRESENT in at least one session.
- `certificatesCount`: certificates issued to the user.

### POST `/api/admin/users`

Creates any kind of account. This is how organizers are added.

Request:

```json
{ "name": "New Organizer", "email": "neworg@aurex26.dev", "password": "Password@123", "role": "ORGANIZER" }
```

Response `201` (message `"User created"`): user object.

Admins **can** use an email that is blocked from self sign-up (see [DELETE](#delete-apiadminusersid)). Creating the account lifts the block.

Errors: `400` · `409` email exists (for a suspended account: `"… Reactivate it instead of creating a new one."`)

### PATCH `/api/admin/users/:id/suspend`

Suspends the account.

- The user can no longer sign in (`403`).
- Their current session stops working on the next request (`401` with the suspension message).
- Their email cannot be used to self-register.

No request body.

Response `200` (message `"User suspended"`): user object with `suspendedAt` set.

Errors: `400` your own account · `404`

### PATCH `/api/admin/users/:id/reactivate`

Lifts the suspension. No request body.

Response `200` (message `"User reactivated"`): user object with `"suspendedAt": null`.

Errors: `400` your own account · `404`

### DELETE `/api/admin/users/:id`

Permanently deletes the account, including its registrations, attendance and certificates.

If the user was **suspended**, their email is added to a blocklist. Self sign-up with it then returns `403`, and only an admin can create an account with that email again. Deleting an active user does not block the email.

Response `200`:

```json
{
  "success": true,
  "message": "User deleted. Their email is blocked from signing up again.",
  "data": { "id": 7, "email": "karthik@aurex26.dev", "emailBlocked": true }
}
```

Errors: `400` your own account · `404` · `409` the user still organizes workshops (delete those first, or suspend instead)

---

## Frontend integration notes

### Pages the backend's QR codes point to

The backend builds these URLs from `FRONTEND_URL`, so the frontend **must** implement these routes:

| Frontend route                             | What it must do                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| `/attendance/:sessionId?token=...`         | Opened by scanning the session QR code. If not logged in, send the user to login and then back to this exact URL (keep the token). Then call `POST /api/sessions/:sessionId/attendance/mark` with `{ token }` and show the result or error `message`. Optionally show a code input as a fallback. |
| `/verify/:certificateId?token=...`         | Opened by scanning the certificate QR code (public, no login). Call `GET /api/certificates/verify/:certificateId?token=...` and show valid or invalid. |

### The core flow, endpoint by endpoint

| Step                          | Who         | Call                                                        |
| ----------------------------- | ----------- | ----------------------------------------------------------- |
| Log in                        | anyone      | `POST /auth/login`                                          |
| Create workshop (+ form fields) | organizer | `POST /workshops`                                           |
| Publish                       | organizer   | `PATCH /workshops/:id/publish`                              |
| Browse / view                 | participant | `GET /workshops`, `GET /workshops/:id`                      |
| Register (dynamic form)       | participant | `POST /workshops/:id/register`                              |
| See participants              | organizer   | `GET /workshops/:id/registrations`                          |
| Add sessions                  | organizer   | `POST /workshops/:id/sessions`                              |
| Show QR code                  | organizer   | `POST /sessions/:id/attendance/start`, then `stop`          |
| Scan → mark present           | participant | `/attendance/:sessionId?token=…` page, then `POST /sessions/:id/attendance/mark` |
| Attendance % / eligibility    | organizer   | `GET /workshops/:id/attendance/summary`                     |
| My progress                   | participant | `GET /my-workshops`                                         |
| Issue certificates            | organizer   | `POST /workshops/:id/certificates/generate`                 |
| Download certificate          | participant | `GET /my-certificates`, then `GET /certificates/:id/download` |
| Verify                        | public      | `/verify/:certificateId` page, then `GET /certificates/verify/:certificateId` |

### Testing on phones

Phones can't open `localhost`. Set `FRONTEND_URL` in `server/.env` to the laptop's LAN address
(e.g. `http://192.168.1.20:5173`), run Vite with `--host`, and restart the server. New QR codes will then work from phones.

---

## Endpoint index

| Method | URL                                          | Access      |
| ------ | -------------------------------------------- | ----------- |
| GET    | `/api/health`                                | Public      |
| POST   | `/api/auth/register`                         | Public      |
| POST   | `/api/auth/login`                            | Public      |
| GET    | `/api/auth/me`                               | Auth        |
| POST   | `/api/auth/organizer-requests`               | Public      |
| GET    | `/api/workshops`                             | Optional    |
| POST   | `/api/workshops`                             | Manager     |
| GET    | `/api/workshops/:id`                         | Optional    |
| PUT    | `/api/workshops/:id`                         | Manager     |
| DELETE | `/api/workshops/:id`                         | Manager     |
| PATCH  | `/api/workshops/:id/publish`                 | Manager     |
| PATCH  | `/api/workshops/:id/close`                   | Manager     |
| POST   | `/api/workshops/:id/register`                | Participant |
| DELETE | `/api/workshops/:id/register`                | Participant |
| GET    | `/api/workshops/:id/registrations`           | Manager     |
| GET    | `/api/my-workshops`                          | Auth        |
| GET    | `/api/workshops/:id/sessions`                | Optional    |
| POST   | `/api/workshops/:id/sessions`                | Manager     |
| GET    | `/api/sessions/:id`                          | Optional    |
| PUT    | `/api/sessions/:id`                          | Manager     |
| DELETE | `/api/sessions/:id`                          | Manager     |
| POST   | `/api/sessions/:id/start`                    | Manager     |
| POST   | `/api/sessions/:id/attendance/start`         | Manager     |
| POST   | `/api/sessions/:id/attendance/mark`          | Participant |
| POST   | `/api/sessions/:id/attendance/stop`          | Manager     |
| POST   | `/api/sessions/:id/attendance/manual`        | Manager     |
| GET    | `/api/workshops/:id/attendance`              | Manager     |
| GET    | `/api/workshops/:id/attendance/summary`      | Manager     |
| POST   | `/api/workshops/:id/certificates/generate`   | Manager     |
| GET    | `/api/workshops/:id/certificates`            | Manager     |
| GET    | `/api/my-certificates`                       | Participant |
| GET    | `/api/certificates/:id`                      | Auth        |
| GET    | `/api/certificates/:id/download`             | Auth        |
| GET    | `/api/certificates/verify/:certificateId`    | Public      |
| GET    | `/api/workshops/:id/announcements`           | Optional    |
| POST   | `/api/workshops/:id/announcements`           | Manager     |
| GET    | `/api/admin/stats`                           | Admin       |
| GET    | `/api/admin/users`                           | Admin       |
| POST   | `/api/admin/users`                           | Admin       |
| PATCH  | `/api/admin/users/:id/suspend`               | Admin       |
| PATCH  | `/api/admin/users/:id/reactivate`            | Admin       |
| DELETE | `/api/admin/users/:id`                       | Admin       |
| GET    | `/api/admin/organizer-requests`              | Admin       |
| POST   | `/api/admin/organizer-requests/:id/approve`  | Admin       |
| POST   | `/api/admin/organizer-requests/:id/reject`   | Admin       |
