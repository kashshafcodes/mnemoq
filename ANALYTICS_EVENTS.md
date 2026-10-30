# Mnemoq GA4 events

The existing GA4 measurement ID remains `G-ZC0907DDRK` in `index.html`.

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
