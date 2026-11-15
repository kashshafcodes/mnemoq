# Security and scale: what can go wrong with many users

Reviewed 2026-11-15 before the marketing push. "Done" items are in the code; the
checklist at the end needs a few clicks in dashboards only you can reach.

## Threats and what protects against them

| Threat | Risk with many users | Protection |
|---|---|---|
| **AI bill run-up**: a script makes hundreds of free accounts and uses each one's daily AI allowance | Gemini/Groq costs grow with every fake account | Per-account daily limits (already there) **plus a site-wide daily AI budget** (`api/_guard.js`, `AI_GLOBAL_DAILY_LIMIT`, default 3000 calls/24 h). Done. |
| **Resetting your own AI limit** by deleting your usage rows | Unlimited AI for one account | `supabase/security.sql` part 2: usage rows can be read and added, never edited or deleted. Run it. |
| **Bot sign-ups** | Junk accounts, fake stats, AI abuse, email bounces | Turn on CAPTCHA and email confirmation in Supabase (checklist). |
| **Reading other people's data** | Any table without row level security is open to anyone with the public key, which every browser has | `supabase/security.sql` part 1 lists every table and whether RLS is on. Check it. |
| **Server-side request forgery** via push "devices": the server sent pushes to any URL a user saved | Your server could be used to poke other sites | Server only sends to real browser push services (`isPushEndpoint` in `api/_push.js`), plus a database check. Done. |
| **Reminder job collapses at scale**: all user ids in one URL and one person at a time | Over ~1,000 users the URL is too long; over a few hundred the 60 s limit runs out, so nobody gets reminders | Batches of 150, 12 people in parallel, settings paged. Covered by `tests/remind.test.js`. Done. |
| **Database filled by one account** | Slow app for everyone, higher Supabase bill | Caps of 20,000 cards and 10 devices per account (`security.sql` part 3). |
| **Analytics spam**: anyone can add tracking events | Fake visitor numbers, table growth | Size limits on every field, at most 120 events a minute per visitor, timestamps set by the server, and nobody can read events except admins (`analytics.sql`). |
| **Clickjacking, script injection, sniffing** | Your site framed by a scam page, or injected scripts | Security headers in `vercel.json`: strict Content-Security-Policy (no inline scripts), `X-Frame-Options: DENY`, HSTS, `nosniff`, Referrer and Permissions policies. Done. |
| **Weak passwords / account takeover** | Students reuse passwords | Sign-up now asks for at least 8 characters; turn on leaked-password protection (checklist). |
| **Leaked secrets** | Service role key = full database access | It is only read on the server (`api/`), never shipped to the browser (`VITE_` variables are public by design; only the publishable key and VAPID public key use that prefix). Keep it that way. |
| **Admin page exposure** | Stats show every user's email | The page is only a screen; the data comes from functions that check `site_admins` in the database, so hiding or showing the menu item changes nothing for an attacker. |

## Checklist (about 15 minutes)

**Supabase > Authentication**
- [ ] *Sign In / Providers > Email*: **Confirm email** on; minimum password length **8**; **leaked password protection** on (if your plan has it).
- [ ] *Attack Protection*: turn on **CAPTCHA** (Cloudflare Turnstile is free). Then tell me the site key and I will add the widget to the sign-up form; without the widget, sign-ups fail once CAPTCHA is on, so do both together.
- [ ] *Rate Limits*: keep the defaults (they limit sign-ups and emails per hour per IP).
- [ ] *URL Configuration*: Site URL = your real address, so confirmation links go to the right place.

**Supabase > SQL Editor**, run in this order:
- [ ] `supabase/security.sql` (look at the audit results; tell me about any table with `rls_on = false`)
- [ ] `supabase/analytics.sql`, then add yourself to `site_admins`
- [ ] `supabase/reminders.sql` (after editing its two EDIT ME lines)

**Vercel**
- [ ] *Settings > Environment Variables*: optionally set `AI_GLOBAL_DAILY_LIMIT` (default 3000).
- [ ] *Settings > Billing > Spend Management*: set a monthly cap with an alert.
- [ ] Redeploy after changing variables.

**AI providers (Google AI Studio / Groq)**
- [ ] Set a monthly budget or quota alert on each key.

**Habits**
- [ ] Supabase backups: the free plan has none you can restore yourself; export the database weekly (Database > Backups, or `pg_dump`) until you are on a paid plan.
- [ ] If a secret is ever pasted somewhere public, rotate it (Supabase > API > roll keys; Vercel variables; redeploy).
