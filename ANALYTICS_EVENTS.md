# Mnemoq analytics events

Every event goes to two places:
- **Mnemoq's own Stats page** (`#/admin`, data in Supabase `site_events`, set up with `supabase/analytics.sql`). This is the easy one: visitors, where they came from, the sign-up funnel, live activity and every user.
- **GA4** (`G-ZC0907DDRK`, loaded by `public/ga.js`). Until 2026-11-15 the GA script was missing from `index.html`, so GA has no data before that date.

Track a social post by giving it its own link: the Stats page has a link builder (`?utm_source=facebook&utm_campaign=...`).

Added 2026-11-15: `landing_view`, `cta_click` (`where`), `page_view` (`page`), `pilot_done`, `pro_redeemed` (`days`), `reminders_on`.

| Event | Fires when | Parameters |
|---|---|---|
| `sign_up` | Supabase accepts a new email signup | `method: email` |
| `login` | Supabase email/password login succeeds | `method: email` |
| `mistake_saved` | A new card is saved successfully | `method: library_form` or `quick_add` |
| `first_mistake_saved` | The user's first card is saved successfully | same method parameter |
| `review_completed` | A card's review rating is saved successfully | `review_mode`, `rating`, `recalled` |
| `ai_generation` | An AI request succeeds | `feature: card_suggestions` or `starter_set` |

No email addresses, names, question text, answers, or other user-entered content are sent to GA4.

## Verify after deployment

1. Deploy the updated project to the same Vercel project.
2. Open GA4 → Reports → Realtime (or Admin → DebugView while testing with debug mode).
3. Create a genuinely new test account to test `sign_up`; use a separate existing account to test `login`.
4. Save a card, rate a review card, and successfully request an AI generation to test the other events.
5. Events should appear in Realtime shortly after they fire. Standard event reports can take longer to populate.

The signup event is sent when Supabase accepts account creation, including when email confirmation is required and `session` is null. Failed requests do not send events.
