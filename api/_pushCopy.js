// Reminder text in Jonaki's voice (company/marketing/app-copy-phase1.md, §1).
// English and Bangla: the language comes from reminder_settings.lang
// (supabase/reminders-language.sql), English when missing or unknown. Not a
// route: the leading underscore keeps Vercel from exposing this file.
//
// Placeholders: {n} cards due, {size} cards in one round. In Bangla every
// number is written with Bangla digits (৩, not 3).

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
  // Same keys, same order (so the same rotation). Bangla needs no singular form:
  // due_one is the first `due` line.
  bn: {
    due_one: [['{n}টি কার্ড ঝাপসা হয়ে আসছে', 'জোনাকি এগুলো আপনার জন্য রেখে দিয়েছে। এখন একবার দেখলে আরও বেশি দিন মনে থাকবে।']],
    due: [
      ['{n}টি কার্ড ঝাপসা হয়ে আসছে', 'জোনাকি এগুলো আপনার জন্য রেখে দিয়েছে। এখন একবার দেখলে আরও বেশি দিন মনে থাকবে।'],
      ['ভুলে যাওয়ার ঠিক আগের মুহূর্ত', 'আপনার {n}টি কার্ড এখন ঠিক সেখানে। কয়েক মিনিটেই ফিরিয়ে আনা যায়।'],
      ['আজকের ছোট্ট আলো', '{n}টি কার্ড তৈরি। পরীক্ষার হলে নয়, এখানেই আগে দেখা হয়ে যাক।'],
      ['এগুলো এখনও মনে আছে?', 'আপনার নিজের ভুল থেকে বানানো {n}টি কার্ড ফিরে এসেছে। উত্তর দেখার আগে মনে করার চেষ্টা করুন।'],
      ['জোনাকির লণ্ঠন অপেক্ষা করছে', '{n}টি কার্ডের সময় হয়েছে। এখন মনে করতে পারলে পরের বিরতি আরও লম্বা হবে।'],
      ['কয়েক মিনিট, তারপর নিজের কাজে', '{n}টি কার্ড তৈরি। ছোট্ট একটা রাউন্ড, তারপর ছুটি।'],
    ],
    many: [
      ['{n}টি কার্ড জমেছে। {size}টি দিয়ে শুরু করুন।', 'সব একসাথে শেষ করার দরকার নেই। {size}টির একটা রাউন্ডই আপাতত যথেষ্ট।'],
      ['এক রাউন্ড করে এগোই', '{n}টি কার্ড বাকি। জোনাকি {size}টি সাজিয়ে রেখেছে, বাকিগুলো পরে হলেও চলবে।'],
      ['আজ সব পুষিয়ে নেওয়ার দরকার নেই', '{n}টি কার্ড বাকি। শুধু {size}টির একটা রাউন্ড। বাকিগুলো কালও থাকবে।'],
      ['{size}টি কার্ড, কয়েক মিনিট', '{n}টি জমেছে, তবে শুরু করার জন্য ছোট একটা রাউন্ডই সবচেয়ে ভালো।'],
      ['পরীক্ষা জিজ্ঞেস করার আগেই', '{n}টি কার্ড ঝাপসা হচ্ছে। এখন {size}টি ফিরিয়ে আনুন, বাকিরা নিজের পালার অপেক্ষা করুক।'],
    ],
    streak: [
      ['আলোটা এখনও জ্বলছে', 'আজ রাতে ছোট একটা রিভিউ করলেই ধারা চলতে থাকবে। আজ ব্যস্ত থাকলে, তাতেও সমস্যা নেই।'],
      ['ঘুমানোর আগে ছোট্ট একটু আলো', 'আজ রাতে কয়েকটি কার্ড দেখে নিন, গতকালের পড়াটা টাটকা থাকবে।'],
      ['আজকের সময় এখনও আছে', 'রাত ১২টা পর্যন্ত আপনার ধারা চালু আছে। একটা ছোট রাউন্ডই যথেষ্ট।'],
      ['আলোটা জ্বালিয়ে রাখুন', 'গতকাল রিভিউ করেছেন। আজ কয়েক মিনিট দিলেই ধারা চলতে থাকবে।'],
      ['এক রাউন্ড, তারপর বিশ্রাম', 'একটা কার্ড রিভিউ করলেও আজকের দিন গোনা হবে। জোনাকি তো আছেই।'],
    ],
    test: [
      ['রিমাইন্ডার চালু হয়েছে', 'কার্ড ঝাপসা হওয়ার আগে জোনাকি এভাবেই আপনাকে মনে করিয়ে দেবে।'],
      ['জোনাকি বলছে, হ্যালো', 'এই ডিভাইসে রিমাইন্ডার কাজ করছে। সময় বদলাতে বা বন্ধ করতে প্রোফাইলে যান।'],
      ['আপনার ছোট্ট আলো যুক্ত হয়েছে', 'কার্ডের সময় হলে Mnemoq জানাবে, না হলে চুপ থাকবে।'],
      ['কাজ করছে', 'এটা পড়তে পারলে বুঝবেন, রিমাইন্ডার এই ডিভাইসে পৌঁছাচ্ছে। আর কিছু করতে হবে না।'],
    ],
  },
};

// 'bn' only when the row says so; anything else (missing, null, unknown) is English.
export const pushLang = (lang) => (lang === 'bn' ? 'bn' : 'en');

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

export const bnDigits = (value) => String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

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
  const code = pushLang(lang);
  const list = PUSH_COPY[code][type] || PUSH_COPY.en[type];
  const [title, body] = list[variantIndex(type, list.length, now)];
  const show = (value) => (code === 'bn' ? bnDigits(value) : String(value));
  const fill = (text) => text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] === undefined ? '' : show(vars[name])));

  return { title: fill(title), body: fill(body) };
}
