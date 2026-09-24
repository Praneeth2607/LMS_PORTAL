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

## Demo data accounts (`database/demo_data.sql`)

All use the password `Password@123`.

| Role        | Email |
| ----------- | ----- |
| Organizer   | `kavitha@aurex26.dev` (Python, Android, Power BI) |
| Organizer   | `suresh@aurex26.dev` (Data Structures, Competitive Programming, Blockchain) |
| Organizer   | `nisha@aurex26.dev` (Git & GitHub, UI/UX, Linux) |
| Participant | 72 students, for example `aarav.kumar@student.aurex26.dev` or `zoya.khan@student.aurex26.dev` (`first.last@student.aurex26.dev`) |

**Analytics demo.** Sign in as the admin and use the filters above the charts.

1. **Year → 2025, then All time:** the activity chart switches from months to the whole history.
2. **Year → this year, Month → March:** the chart shows one point per day.
3. **Workshop → Data Structures & Algorithms Bootcamp:** attendance falls from about 87% to 49% across the 8 sessions, and "The pace of the session was right for me" is its lowest-rated statement.
4. **Download PDF report:** the PDF uses the filters you picked.

## Live session demo (proof of active presence)

1. In `server/.env`, set the `JAAS_*` keys (see `server/.env.example`) and, **for the demo only**, `PRESENCE_DEMO_MODE=true` (5 seconds counts as 15 minutes). Restart the server.
2. As `meera@aurex26.dev` (Organizer tab), open **Cybersecurity Essentials → Sessions**. Edit a session so it runs now, then click **Start & open live room**.
3. As `sneha@aurex26.dev` (Participant tab), click **Join session** on the dashboard and join the call. Watch the tracker:
   - it counts while you stay on the tab;
   - it pauses if you switch tabs;
   - after 15s of no mouse or keyboard activity it asks "Are you still there?";
   - after about 15 seconds of tracked time it shows **Attendance recorded**.
4. In Meera's live room, the participant list shows Sneha as *Watching now* and *Present*.

Each person who joins counts toward the JaaS free plan's monthly active users (25). End the call when you're done, and set
`PRESENCE_DEMO_MODE=false` afterwards.

## Session feedback demo

1. As `priya@aurex26.dev` (Participant tab), the dashboard shows **How did these sessions go?** Click **Give feedback**, answer each statement from *Strongly agree* to *Strongly disagree*, add a comment, and click **Send feedback**.
2. As `meera@aurex26.dev` (Organizer tab), open **Full-Stack Web Development → Feedback**. It shows the average score, agreement %, response rate, a bar for each statement showing how many chose each answer, results session by session, and written feedback without names.
3. On the same page, edit the statements under **Feedback questions**, then click **Save questions**.

## Tamil demo

Click **தமிழ்** in the navbar. Every page switches to Tamil, and the choice is remembered. Click **EN** to switch back.

`server/i18n/ta.json` already covers every page (about 700 entries), so this works without any API key. New text added later (new workshops, new pages) is translated with Google Translate once and saved to the same file. That part needs `GOOGLE_TRANSLATE_API_KEY` in `server/.env`; without it, new text stays in English until it's added to the file.

## Quick demo path

1. **Organizer:** sign in as `arjun@aurex26.dev`. Open the ML workshop, go to **Sessions**, then **Start attendance** to show the QR code.
2. **Participant:** sign in as `sneha@aurex26.dev` on a phone, scan the QR code (or type the 6-character code) to mark present.
3. **Certificates:** sign in as `meera@aurex26.dev`. Open Full-Stack, go to **Attendance & certificates**, then **Generate certificates** (2 issued, 2 not eligible).
4. **Certificate holder:** sign in as `priya@aurex26.dev`. Go to **Certificates**, then download the PDF, and scan its QR code to verify.

New sign-ups are always participants. To become an organizer, use **Sign in → Organizer tab → Request organizer access**. An admin approves the request under **Organizers**.

> These are demo credentials for the hackathon only. Reset or remove them before any real use.
