# Leave & Attendance (/lna)

Private staff area at `hexalis.in/lna`. Everyone signs in with their **@hexalis.in Google
account**; there are no passwords. The public website is untouched: /lna runs as a
Cloudflare Pages Function (`functions/lna/[[path]].js`) with a Cloudflare D1 database.

## Where the data lives

- **Live:** a Cloudflare D1 database called `hexalis-lna`, in the same Cloudflare account
  as the website (dashboard → Storage & Databases → D1). Every check-in, leave request,
  approval and setting is written there the moment it happens. Nothing is stored on
  anyone's computer. You can browse the tables in the dashboard, and D1 "Time Travel" can
  restore the database to any minute in the last 30 days. Download a copy any time:
  `npx wrangler d1 export hexalis-lna --remote --output lna-backup.sql`
- **On this Mac:** `hexalis/.wrangler/state/v3/d1/` is a separate practice copy used by
  `npm run dev`. It's never uploaded, and the live database starts clean.
- **Structure:** `lna/migrations/` holds numbered files describing the tables. They're
  applied with `npm run lna:migrate` (this Mac) or `npm run lna:migrate:live` (live), and
  each file only ever runs once per database.

## The team and leave policy

Created by `migrations/0004_google_only_and_team.sql`:

| Person | Role | Reports to |
|---|---|---|
| deepak@hexalis.in | Admin | — |
| divya.gulati@hexalis.in | Manager | Deepak |
| mohit.sharma@hexalis.in | Employee | Deepak |
| govind.jaiswal@hexalis.in | Employee | Divya |

Names are replaced by each person's full Google name the first time they sign in.
Set everyone's **joining date** under People: leave counts from it.

Leave per calendar year, built up from the joining date: **Earned 18** (1 day for every
20 days of service), **Sick 7** and **Casual 7** (1 day for every 51 days each; set by
`migrations/0005_cl_sl_accrual.sql`), plus "Unpaid leave / absence" (no limit) for
recording absence. Unused leave doesn't carry
over. All editable under Settings.

## Sign in with Google: one-time setup

Do this signed in to Google as **deepak@hexalis.in** (a Workspace admin is best).

1. Open https://console.cloud.google.com and create a project, e.g. "HEXALIS Leave & Attendance".
2. Go to **Google Auth Platform** (APIs & Services → OAuth consent screen). Enter an app
   name ("HEXALIS Leave & Attendance") and support email, and choose Audience **Internal**.
   Internal means only hexalis.in accounts can use it, and Google doesn't need to review it.
3. **Clients → Create client → Web application**. Under *Authorised redirect URIs* add:
   - `http://localhost:8788/lna/auth/google/callback`
   - `https://hexalis.in/lna/auth/google/callback`
   - `https://www.hexalis.in/lna/auth/google/callback`
   - `https://hexalis.pages.dev/lna/auth/google/callback`
4. Copy the **Client ID** and **Client secret**.
5. For this Mac: copy `.dev.vars.example` to `.dev.vars` and fill in `GOOGLE_CLIENT_ID`
   and `GOOGLE_CLIENT_SECRET`. For the live site, see Going live, step 6.

Only people with an active account here can get in. A personal Gmail, or a hexalis.in
account that hasn't been added, is turned away.

## Run it on your Mac

From the `hexalis` folder: `npm install` (once), `npm run lna:migrate`, then `npm run dev`
and open http://localhost:8788/lna. Stop with Ctrl+C.

## Adding people

**People → Add a person** (admins), or from the terminal (add `--remote` for the live site):

```bash
npm run lna:people -- add --name "Asha K" --email asha@hexalis.in --role employee --manager deepak@hexalis.in
npm run lna:people -- list
```

They can sign in with Google straight away. Disabling someone signs them out at once and
keeps their records. "Sign out" under People ends their sessions, e.g. for a lost phone.

## Email notifications (optional)

Emails go out for new requests (to the approver), decisions (to the person who asked),
the evening "you haven't checked out" reminder, and new accounts. Everyone can turn them off under Account. Admins see every email and its status under
Settings → Email notifications, with a "Send me a test email" button.

hexalis.in uses Google Workspace, so the simplest way is to send from a Workspace mailbox:

1. Pick the sending mailbox, ideally one made for it, e.g. `noreply@hexalis.in`
   (an extra Workspace user), or use an existing one.
2. Signed in as that mailbox: Google Account → Security → turn on 2-Step Verification,
   then Security → App passwords → create one named "Leave & Attendance". Copy the
   16-letter password. (If App passwords is missing, the Workspace admin must allow it:
   Admin console → Security → Authentication → 2-Step Verification.)
3. Add to `.dev.vars` (and, for the live site, as secrets: see Going live, step 6):

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=noreply@hexalis.in
   SMTP_PASS=the16letterapppassword
   ```

4. Restart `npm run dev`, then Settings → Send me a test email.

Google allows about 2,000 emails a day per mailbox, far more than needed. Any other
provider works the same way with its own SMTP host, port 465 or 587, user and password.

Without these settings nothing is sent: emails wait in the queue and are dropped after
24 hours, and the bell still shows everything. Failed sends are retried 5 times over
about 5 hours. There's no scheduler on Cloudflare Pages, so queued emails and the
evening reminder are sent whenever anyone uses /lna; with a team checking in and out
every day that's within minutes. (If that's ever not enough, a tiny scheduled worker
can be added when going live.)

## Approval rules

- Leave, work from home and corrections: the person they report to (an employee's or a
  manager's own manager), or any admin. A manager with no one above them goes to admins.
- Admin requests: another admin, or themselves while they're the only admin.
- Office check-ins need no approval.

## What's in it

- **Today:** check in (office or work from home), check out, month calendar, missed
  check-out reminders, and **corrections** (forgot to check in/out, wrong time, a whole
  missing day), for the last 15 days. Corrections go through the same approval rules as leave.
- **Shift rules:** late after shift start + grace, left early, and Full day / Half day /
  Short hours from hours worked. Set under Settings → Shift and working week, along with
  the weekly days off and the idle sign-out time.
- **Office location check (optional):** when a radius is set, an office check-in only works
  near the office. Location is read once at check-in; only the distance is kept.
- **Leave:** balances, half days, cancelling, a joining-date check, leave that builds up
  (e.g. 1 day per 20 days), and supporting documents (PDF/JPG/PNG, 1 MB) required above a set number of days.
- **Team** (managers and admins): live dashboard (checked in, office/WFH, on leave, late,
  not checked in or absent, no check-out, left early, requests waiting), refreshed every
  30 seconds; department filter; birthdays; team leave balances.
- **Reports** (managers and admins): summary per person, day-by-day attendance or leave, for
  any range up to a year, by department or person, on screen or as CSV.
- **People, Settings, Activity** (admins): accounts with employee ID, department, designation
  and joining date; leave types and holidays; the full activity log.
- **Account:** contact and emergency details (seen only by the person and admins), email preference.
- **Bell:** in-app notifications for new requests, decisions and reminders.

Leave types, yearly limits and holidays are edited under **Settings**.

## Going live

Run everything from the `hexalis` folder. Steps 1–5 are one-time.

1. **Google keys:** do "Sign in with Google: one-time setup" above.
2. **Log in to Cloudflare:** `npx wrangler login` opens the browser. Log in to the
   Cloudflare account that hosts hexalis.in (Deepak@hexalis.in) and allow access.
3. **Check the project:** `npx wrangler pages project list` should list `hexalis`.
4. **Create the live database:** `npx wrangler d1 create hexalis-lna`. It prints a
   `database_id`: put it in `wrangler.toml` in place of the zeros.
5. **Create the tables and the team:** `npm run lna:migrate:live`
6. **Add the secrets** (each command asks you to paste the value):
   `npx wrangler pages secret put GOOGLE_CLIENT_ID --project-name hexalis` and the same for
   `GOOGLE_CLIENT_SECRET`. For email, also `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` and `SMTP_PASS`.
7. **Publish:** `npm run deploy`
8. **Check:** open https://hexalis.in (the site as before), then https://hexalis.in/lna and
   sign in as Deepak. In Settings, check the shift times and holidays. In People, set
   joining dates.

### After going live

- **Always publish with `npm run deploy`.** Uploading the zip by hand would publish the
  site without /lna.
- If a change adds a new file to `lna/migrations/`, run `npm run lna:migrate:live` before
  `npm run deploy`.
- Commit and push to GitHub as usual. `.dev.vars` (the secrets) is never committed.
