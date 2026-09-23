# Demo accounts

These accounts come from `database/seed.sql`. They are available after running `npm run db:reset`
(or loading `seed.sql` into Supabase).

**Password for every account: `Password@123`**

## Admin

| Name       | Email               |
| ---------- | ------------------- |
| CICT Admin | `admin@aurex26.dev` |

## Organizers

| Name               | Email               | Workshops                                              |
| ------------------ | ------------------- | ------------------------------------------------------ |
| Dr. Meera Krishnan | `meera@aurex26.dev` | Full-Stack Web Development (closed), Cybersecurity Essentials |
| Arjun Rao          | `arjun@aurex26.dev` | Machine Learning Fundamentals (session today), Cloud & DevOps (draft) |

## Participants

| Name         | Email                 | Use it to show                                                |
| ------------ | --------------------- | ------------------------------------------------------------- |
| Priya Sharma | `priya@aurex26.dev`   | 100% attendance on Full-Stack: eligible for a certificate     |
| Rahul Verma  | `rahul@aurex26.dev`   | Exactly 90% on Full-Stack: eligible (at the threshold)        |
| Ananya Iyer  | `ananya@aurex26.dev`  | 70% on Full-Stack: **not** eligible                           |
| Karthik Nair | `karthik@aurex26.dev` | 50% on Full-Stack: **not** eligible                           |
| Sneha Patel  | `sneha@aurex26.dev`   | Registered for ML and Cybersecurity: live QR check-in         |
| Vikram Singh | `vikram@aurex26.dev`  | Not registered anywhere: live registration                    |

## Quick demo path

1. **Organizer:** sign in as `arjun@aurex26.dev`. Open the ML workshop, go to **Sessions**, then **Start attendance** to show the QR code.
2. **Participant:** sign in as `sneha@aurex26.dev` on a phone, scan the QR code (or type the 6-character code) to mark present.
3. **Certificates:** sign in as `meera@aurex26.dev`. Open Full-Stack, go to **Attendance & certificates**, then **Generate certificates** (2 issued, 2 not eligible).
4. **Certificate holder:** sign in as `priya@aurex26.dev`. Go to **Certificates**, then download the PDF, and scan its QR code to verify.

New sign-ups with an `@cict.in` email automatically become organizers.

> These are demo credentials for the hackathon only. Reset or remove them before any real use.
