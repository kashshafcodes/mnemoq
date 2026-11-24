// Reminder text in Jonaki's voice (company/marketing/app-copy-phase1.md, §1).
// English only for now: the server does not know each person's language yet
// (that needs a database change, an owner decision). Not a route: the leading
// underscore keeps Vercel from exposing this file.
//
// Placeholders: {n} cards due, {size} cards in one round.

export const PUSH_COPY = {
  en: {
    due_one: [['1 card is starting to fade', 'Jonaki kept it for you. A quick look now and it stays with you longer.']],
    due: [
      ['{n} cards are starting to fade', 'Jonaki kept them for you. A quick look now and they stay with you longer.'],
      ['Right before you forget', 'That’s where {n} of your cards are now. A few minutes brings them back.'],
      ['A small light for today', '{n} cards are ready. Better they come up here than in the exam hall.'],
      ['Still remember these?', '{n} cards from your own mistakes are back. Try to recall each one before you peek.'],
      ['Jonaki’s lantern is waiting', '{n} cards are due. Recall them now, and the next gap gets longer.'],
      ['A few minutes, then back to your day', '{n} cards are ready. One quick round, and you’re done.'],
    ],
    many: [
      ['{n} cards waiting. Start with {size}.', 'No need to clear them all. One round of {size} is plenty for now.'],
      ['One round at a time', '{n} cards are due. Jonaki lines up {size}. Do those, and the rest can wait.'],
      ['No catching up needed today', '{n} cards are due. Just one round of {size}. The rest will still be here tomorrow.'],
      ['{size} cards, a few minutes', '{n} are due, but a short round is the best place to start.'],
      ['Before the exam asks first', '{n} cards are fading. Bring back {size} now and let the rest wait their turn.'],
    ],
    streak: [
      ['The light is still on', 'One short review tonight keeps your streak going. If today is full, that’s fine too.'],
      ['A small light before bed', 'A few cards tonight keep yesterday’s study fresh.'],
      ['Still time today', 'Your streak runs until midnight. One quick round is enough.'],
      ['Keep the light on', 'You reviewed yesterday. A few minutes today keeps the streak going.'],
      ['One round, then rest', 'Even one card counts for today. Jonaki will be here either way.'],
    ],
    test: [
      ['Reminders are on', 'This is how Jonaki will tap you when cards are about to fade.'],
      ['Hello from Jonaki', 'Reminders work on this device. Change the time or turn them off in Profile.'],
      ['Your small light is connected', 'Mnemoq will nudge you when cards are due, and stay quiet when they aren’t.'],
      ['It works', 'If you can read this, reminders reach this device. Nothing else to do.'],
    ],
  },
};

// Each type starts at a different place in its list, so two types sent on the
// same day do not both open with their first line.
const OFFSET = { due: 0, due_one: 0, many: 1, streak: 2, test: 3 };
const DAY_MS = 24 * 60 * 60 * 1000;
const EPOCH = Date.UTC(2026, 0, 1);

// The variant for today: (days since 2026-01-01 + type offset) % variants.
// No database field needed, and nobody gets the same line two days running.
export function variantIndex(type, count, now = new Date()) {
  const days = Math.floor((now.getTime() - EPOCH) / DAY_MS);

  return (((days + (OFFSET[type] || 0)) % count) + count) % count;
}

export function pushLine(type, vars = {}, now = new Date(), lang = 'en') {
  const list = (PUSH_COPY[lang] || PUSH_COPY.en)[type] || PUSH_COPY.en[type];
  const [title, body] = list[variantIndex(type, list.length, now)];
  const fill = (text) => text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] === undefined ? '' : String(vars[name])));

  return { title: fill(title), body: fill(body) };
}
