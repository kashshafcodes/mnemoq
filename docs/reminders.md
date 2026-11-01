# Review reminders: setup (one time, about 10 minutes)

Mnemoq sends:
- a daily push at the time each person chooses, in their own time zone ("7 cards are ready to review");
- "cards are due now" alerts during the day when enough cards have become due (default 5 or more), at most 3 a day and 3 hours apart, never in their quiet hours (default 10 pm to 7 am), and not while they are already reviewing;
- an optional 8 pm nudge to keep a streak alive.

Nothing is sent when no cards are due. If you already ran `stage4.sql`, run it again: it only adds the new columns.

## 1. Database
Supabase > SQL Editor > run `supabase/stage4.sql`.

## 2. Keys
Run `node scripts/make-vapid-keys.mjs` and keep the output. Also make a long random string for `CRON_SECRET` (for example from a password manager).

## 3. Vercel > Settings > Environment Variables
| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | public key from step 2 |
| `VITE_VAPID_PUBLIC_KEY` | the same public key (the browser needs it) |
| `VAPID_PRIVATE_KEY` | private key from step 2 (secret) |
| `VAPID_SUBJECT` | `mailto:` plus your email |
| `CRON_SECRET` | your long random string |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API > `service_role` (secret, never in the browser) |

Redeploy after adding them (the `VITE_` one is baked in at build time).

## 4. GitHub (the scheduler)
Repository > Settings > Secrets and variables > Actions > New repository secret:
- `APP_URL` = your site, for example `https://mnemoq-two.vercel.app`
- `CRON_SECRET` = the same string as in Vercel

The workflow `.github/workflows/reminders.yml` then runs about every 15 minutes. Use Actions > "Send review reminders" > Run workflow to try it by hand.

## 5. Try it
Profile > Reminders > Turn on reminders > Send a test.
On iPhone: Share > Add to Home Screen, then open Mnemoq from the Home Screen first (Apple only allows push for installed web apps).
