# Review reminders: setup (one time, about 10 minutes)

Mnemoq sends:
- a daily push at the time each person chooses, in their own time zone ("7 cards are ready to review");
- "cards are due now" alerts during the day when enough cards have become due (default 5 or more), at most 3 a day and 3 hours apart, never in their quiet hours (default 10 pm to 7 am), and not while they are already reviewing;
- an optional 8 pm nudge to keep a streak alive.

Nothing is sent when no cards are due.

## Why reminders were not arriving (fixed 2026-11-15)
1. The GitHub job failed on every run since 7 Nov with curl exit code 3: the `APP_URL` secret was empty, so it called an invalid address.
2. GitHub ran the "every 15 minutes" schedule only every 4 to 8 hours, so even a working job would miss most reminder times.
3. The SQL that creates the reminder tables was never in the repository (the docs pointed to `stage4.sql`, which is about exam paths).

Now Supabase calls the job every 10 minutes (part 2 of `supabase/reminders.sql`), GitHub is only a backup, and the Stats page (`#/admin`) shows when the job last ran.

## Lost the CRON_SECRET?
Vercel never shows a secret again after you save it, so you cannot copy it back out. Make a new one and use it everywhere:
1. Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and copy the output.
2. Vercel > Settings > Environment Variables > `CRON_SECRET` > Edit > paste > Save, then redeploy.
3. Paste the same value into `EDIT ME (2)` in `supabase/reminders.sql` and run part 2 again (do not save the secret in the file you commit).
4. If you use the GitHub backup, update its `CRON_SECRET` secret too.

## 1. Keys
Run `node scripts/make-vapid-keys.mjs` and keep the output. Also make a long random string (at least 16 characters) for `CRON_SECRET`.

## 2. Vercel > Settings > Environment Variables
| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | public key from step 1 |
| `VITE_VAPID_PUBLIC_KEY` | the same public key (the browser needs it) |
| `VAPID_PRIVATE_KEY` | private key from step 1 (secret) |
| `VAPID_SUBJECT` | `mailto:` plus your email |
| `CRON_SECRET` | your long random string |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API > `service_role` (secret, never in the browser) |

Redeploy after adding them (the `VITE_` one is baked in at build time).
If you change the VAPID keys later, everyone has to turn reminders on again (the app now does this by itself on the next "Turn on").

## 3. Database and scheduler
Open `supabase/reminders.sql`, replace the two `EDIT ME` values (your site address and the same `CRON_SECRET`), then run the whole file in Supabase > SQL Editor.

After 10 to 20 minutes, check:
```sql
select status_code, content, created from net._http_response order by created desc limit 5;
```
- `200` and `{"ok":true,...}`: working.
- `401`: the secret in Supabase does not match Vercel's `CRON_SECRET`.
- `503`: a Vercel variable from step 2 is missing, or you have not redeployed.

## 4. GitHub backup (optional)
Repository > Settings > Secrets and variables > Actions:
- `CRON_SECRET` = the same string as in Vercel
- `APP_URL` = your site (optional, defaults to `https://mnemoq-two.vercel.app`)

Actions > "Send review reminders" > Run workflow tests it by hand; the log now says exactly what is wrong.

## 5. Try it
Profile > Reminders > Turn on reminders > Send a test.
On iPhone: Share > Add to Home Screen, then open Mnemoq from the Home Screen first (Apple only allows push for installed web apps).
