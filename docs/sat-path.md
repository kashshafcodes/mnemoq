# The Digital SAT path

How the SAT path works, what it estimates and why, how the free and Pro plans are enforced, and how to run it.

## What it is for

Mnemoq does not replace the official Bluebook practice tests. It is the layer around them:

1. **Find weak skills.** A 25-minute diagnostic (or a score you already have) gives a first estimate and a map of the 27 SAT skills.
2. **Drill them.** Short sets on one skill, with an explanation for every answer.
3. **Keep every mistake alive.** Missed questions become review cards, and spaced repetition brings them back.
4. **Practise under the clock.** Timed modules, and full two-stage adaptive tests.
5. **Track the score.** Logged Bluebook scores and Mnemoq results feed one 400-1600 estimate with a range, set against the student's target and test date.

## Where things live

| Part | File |
|---|---|
| Sections, timing, domains, skills | `src/sat/blueprint.js` |
| Marking answers, misses to cards | `src/sat/answers.js` |
| Building sets, adaptive routing | `src/sat/assemble.js` |
| Score estimate and history | `src/sat/score.js` |
| Skill map | `src/sat/skills.js` |
| Missions, next step, study plan, achievements | `src/sat/coach.js` |
| Free-plan limits | `src/sat/access.js` |
| Rule and formula decks | `src/sat/essentials.js` |
| Screens | `src/components/sat/` |
| Question sources | `content/sat/` |
| Pro plan (client) | `src/plan.js`, `src/proConfig.js`, `src/components/Pro.jsx` |
| Pro plan (server) | `api/_plan.js`, `api/sat-bank.js`, `supabase/stage5.sql` |

Everything in `src/sat/` except the bank loader is pure functions, covered by `tests/sat.test.js`.

## The test format

Structure, timing, domains and skills come from College Board's public pages (links and the date checked are in `src/sat/blueprint.js`): Reading and Writing is 54 questions in two 32-minute modules, Math is 44 questions in two 35-minute modules, with a 10-minute break. About a quarter of Math questions are typed answers.

College Board gives domain sizes as ranges. The exact split inside one module (for example 8 Craft and Structure questions out of 27) is Mnemoq's own choice within those ranges.

## The question bank

Every question is original.

- **Math** is written by `scripts/gen-sat-math.py`. Each "family" produces one kind of question at one of three levels, and every answer key is computed from the numbers in the question. Wrong options are common mistakes (a sign error, a forgotten step) where possible.
- **Reading and Writing** is hand-written in `content/sat/rwReading.js` and `rwWriting.js`, tagged by skill and level, each with its own passage and explanation.

`node scripts/build-sat-bank.mjs` checks every question (shape, four distinct options, valid skill, table rows) and writes two files:

- `src/sat/bank/free.js`: the free questions, shipped in the app.
- `api/_satBank.js`: the Pro questions, read only by the server.

Known limits: no figures or graphs yet (geometry is described in words, data questions use small tables), and the Reading and Writing bank holds enough for about two full tests before questions repeat.

## Building a set

`assemble.js` picks questions from the bank with a seeded random generator, so the same inputs always give the same set.

- A set is spread over the skills of each domain and aims at a level mix: 30/45/25 (easier/medium/harder) for a first module, 10/35/55 for a harder second module, 55/35/10 for an easier one.
- Questions the student has not seen are preferred. Seen questions are used only when a domain runs out.
- Reading and Writing keeps the real test's domain order. Math runs from easier to harder.

**Adaptive routing.** After module 1 of a section, 60% or more correct opens the harder module 2; otherwise the easier one. College Board's real rule is not public; 60% is Mnemoq's.

## The score estimate

College Board does not publish how answers become scores, and the real test weighs questions individually. So Mnemoq shows an **estimate with a range**, and says so on screen.

1. Each scored event gives a section score (200-800):
   - a logged official score is used as typed;
   - a Mnemoq result is converted from the share of correct answers by one of three curves in `score.js` (harder route: up to 800; first module or diagnostic: up to 780; easier route: capped at 600). The curves approximate public score tables.
2. Events are averaged, weighted by trust and recency:

   | Event | Trust |
   |---|---|
   | Logged official score (Bluebook or test day) | 3 |
   | Mnemoq full adaptive test | 2 |
   | Mnemoq timed module | 1 |
   | Diagnostic | 0.7 |
   | Drills from the last 21 days, taken together | up to 0.5 |

   An event loses half its weight every 45 days.
3. The range is `90 / sqrt(0.6 + total weight)`, rounded to 10 and kept between 30 and 100 points per section. A diagnostic alone gives about ±80; one official score about ±50; several recent ones ±30.

There is no total until both sections have been measured.

## Free and Pro

| | Free | Pro |
|---|---|---|
| Diagnostic, estimate, skill map, score log, essentials decks | Yes | Yes |
| Drills | One a day, from the free questions | Unlimited, whole bank |
| Timed modules | One per section | Unlimited |
| Explanations and misses to cards | First 3 per report | All |
| Full adaptive tests, AI coach, study plan | No | Yes |

The limits are set in `src/sat/access.js`.

**Enforcement.** The screens apply the limits, but the parts that matter are guarded on the server:

- Pro questions are not in the app bundle. `api/sat-bank.js` sends them only after reading the caller's own `user_plans` row with their token (row level security lets a person read only their own row, and nobody can write to it).
- The SAT AI coach checks the plan in `api/coach.js` and answers 403 otherwise.

A free user who edits the page can remove a daily limit on the free questions, and nothing more.

## Running Pro (for the site owner)

1. Run `supabase/stage4.sql` (several exams per account) and `supabase/stage5.sql` (plans and codes) once in the Supabase SQL editor.
2. Put your prices and payment details in `src/proConfig.js`.
3. When a student pays, create a code in the SQL editor and send it to them:

   ```sql
   select * from create_pro_codes(1, 30, 'Rahim, bKash, 15 Nov');
   ```

   The numbers are how many codes and how many days each gives. The student redeems it on the Pro page. Redeeming again adds days.
4. To give or end Pro directly: `select grant_pro('student@example.com', 365);` (use `0` days to end it).
5. Optional: set `PRO_EMAILS` (comma-separated) in the Vercel environment for your own and testers' accounts.

See who has redeemed what: `select code, days, note, redeemed_at from pro_codes order by created_at desc;`

## Development

```bash
npm run dev          # the app
npm test             # logic tests
npm run sat:bank     # regenerate Math and rebuild both bank files
```

`/dev/sat-preview.html` (development server only) shows the SAT path without logging in. Add `?demo=1` for sample results, `?pro=1` to preview Pro, `?page=pro` for the Pro page. A plain Vite server has no `/api` functions, so in development a Pro plan reads the Pro questions straight from `api/_satBank.js`; that branch is removed from real builds.
