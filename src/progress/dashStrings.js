import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { bnDigits } from '../loop/strings';

// The old dashboard panels, now inside the Memory map's "Details"
// (src/components/Dashboard.jsx), in English and Bangla. Stage names and badge
// names are keyed by their id in src/analytics.js; the English there is the
// fallback. Plurals: a key ending in .one / .many is picked by n (Bangla has
// one form, so both are the same). All Bangla is a draft for the owner's
// native read (Phase 3 Bangla audit).
export const STRINGS = {
  en: {
    'd.n': '{n}',
    'd.card.one': '{n} card',
    'd.card.many': '{n} cards',
    'd.review.one': '{n} review',
    'd.review.many': '{n} reviews',
    'd.day.one': '{n} day',
    'd.day.many': '{n} days',
    'd.unit.day.one': ' day',
    'd.unit.day.many': ' days',
    'd.weeks': '{n} weeks',
    'd.months': '{n} months',
    'd.gap.min': '{n} min',
    'd.gap.hr': '{n} hr',
    'd.gap.wk': '{n} wk',
    'd.gap.mo': '{n} mo',
    'd.today': 'Today',
    'd.thisWeek': 'This week',
    'd.mastered': 'mastered',
    'd.ring.aria': '{pct} of cards mastered',
    'd.stage.caption': 'Cards by stage',
    'd.stage.head.stage': 'Stage',
    'd.stage.head.cards': 'Cards',
    'd.stage.new': 'New',
    'd.stage.new.hint': 'Not reviewed yet',
    'd.stage.learning': 'Learning',
    'd.stage.learning.hint': 'Short gaps, still settling',
    'd.stage.strong': 'Getting strong',
    'd.stage.strong.hint': 'Gaps of 4+ days',
    'd.stage.mastered': 'Mastered',
    'd.stage.mastered.hint': 'Recalled again and again',
    'd.bars.aria': 'Reviews per day, last 14 days',
    'd.bars.none': 'no reviews',
    'd.bars.tip': '{recalled} recalled, {missed} missed',
    'd.bars.caption': 'Reviews per day',
    'd.head.day': 'Day',
    'd.head.week': 'Week ending',
    'd.head.reviews': 'Reviews',
    'd.head.recalled': 'Recalled',
    'd.head.missed': 'Missed',
    'd.head.due': 'Cards due',
    'd.trend.range': '{from} to {to}',
    'd.trend.tip': '{when}: {pct} recalled ({n} of {total})',
    'd.trend.aria.days': 'Recall rate by day',
    'd.trend.aria.weeks': 'Recall rate by week',
    'd.trend.range.aria': 'Chart range',
    'd.trend.days': 'Days',
    'd.trend.weeks': 'Weeks',
    'd.subj.count': '{n} of {cards} mastered',
    'd.subj.aria': '{name}: {n} of {total} mastered',
    'd.subj.rate': '{pct} recalled',
    'd.subj.none': 'Not enough reviews yet',
    'd.subj.due': ' · {n} due',
    'd.up.aria': 'Cards coming due, next 7 days',
    'd.up.tip': '{when}: {cards} due',
    'd.up.caption': 'Cards due, next 7 days',
    'd.journey.after': 'after {gap}',
    'd.journey.first': 'first try',
    'd.journey.hit': 'Recalled',
    'd.journey.miss': 'Missed',
    'd.m.best': 'YOUR STRONGEST MEMORY',
    'd.m.best.body': 'You recalled this correctly {n} times in a row, and the gap grew to {gap}. That is spaced repetition working.',
    'd.m.long': 'LONGEST MEMORY',
    'd.m.long.body': '“{q}” now only needs a review every {span}.',
    'd.m.comeback': 'COMEBACKS',
    'd.m.comeback.body': 'started as a miss and are now answered correctly. That is the whole point.',
    'd.m.turned': 'MISTAKES TURNED INTO KNOWLEDGE',
    'd.m.turned.one': 'card was saved because you got it wrong. You now recall it reliably.',
    'd.m.turned.many': 'cards were saved because you got them wrong. You now recall them reliably.',
    'd.m.tough': 'HARDEST WIN',
    'd.m.tough.title': 'Took {n} tries',
    'd.m.tough.body': '“{q}” fought back, and you mastered it anyway.',
    'd.m.day': 'BIGGEST DAY',
    'd.m.day.body': 'on {date}.',
    'd.m.empty': 'Your proud moments show up here: cards you recall again and again, with the gaps getting longer. Finish a few review sessions to see the first one.',
    'd.badges.count': '{n} of {total} earned',
    'd.badges.earned': 'Earned',
    'd.kpis': 'Your numbers',
    'd.k.reviews': 'Reviews done',
    'd.k.reviews.yes': 'Each one strengthens memory',
    'd.k.reviews.no': 'Your first is a short session',
    'd.k.rate': 'Recall rate',
    'd.k.rate.no': 'Shows after a few reviews',
    'd.k.rate.yes': '{n} of {total} answers right',
    'd.k.span': 'Memory span',
    'd.k.span.yes': 'Longest gap. Average {avg}',
    'd.k.span.no': 'Grows with every recall',
    'd.k.for': 'Learning for',
    'd.k.saved': '{cards} saved',
    'd.note': 'Daily activity and recall trends start building from your next review.',
    'd.p.stand': 'Where your cards stand',
    'd.p.stand.note': 'Cards move right as your gaps grow.',
    'd.p.14': 'Last 14 days',
    'd.p.14.note': '{reviews} in two weeks',
    'd.p.14.empty': 'Review a few cards and each day shows up here, split into recalled and missed.',
    'd.p.rate.note.days': 'Share of answers you got right, last 30 days.',
    'd.p.rate.note.weeks': 'Share of answers you got right, week by week.',
    'd.p.rate.empty.days': 'Your daily recall rate appears after your first review session.',
    'd.p.rate.empty.weeks': 'Your weekly recall rate appears after your first review session.',
    'd.p.subj': 'By subject',
    'd.p.subj.note': 'Mastered cards out of everything you saved.',
    'd.p.up': 'Coming up',
    'd.p.up.note': 'Cards due over the next week.',
    'd.p.proud': 'Proud moments',
    'd.p.proud.note': 'Proof that it is sticking.',
    'd.p.milestones': 'Milestones',
    'badge.first-card': 'First card',
    'badge.first-card.desc': 'Add your first card',
    'badge.ten-cards': 'Collector',
    'badge.ten-cards.desc': 'Save 10 cards',
    'badge.first-review': 'First recall',
    'badge.first-review.desc': 'Review a card',
    'badge.reviews-50': 'Getting serious',
    'badge.reviews-50.desc': 'Complete 50 reviews',
    'badge.first-mastered': 'Locked in',
    'badge.first-mastered.desc': 'Master your first card',
    'badge.five-mastered': 'High five',
    'badge.five-mastered.desc': 'Master 5 cards',
    'badge.long-memory': 'Long memory',
    'badge.long-memory.desc': 'Hold a card for 14+ days between reviews',
    'badge.comeback': 'Comeback',
    'badge.comeback.desc': 'Turn a missed card into a correct one',
  },
  bn: {
    'd.card.one': '{n}টি কার্ড',
    'd.card.many': '{n}টি কার্ড',
    'd.review.one': '{n}টি রিভিউ',
    'd.review.many': '{n}টি রিভিউ',
    'd.day.one': '{n} দিন',
    'd.day.many': '{n} দিন',
    'd.unit.day.one': ' দিন',
    'd.unit.day.many': ' দিন',
    'd.weeks': '{n} সপ্তাহ',
    'd.months': '{n} মাস',
    'd.gap.min': '{n} মিনিট',
    'd.gap.hr': '{n} ঘণ্টা',
    'd.gap.wk': '{n} সপ্তাহ',
    'd.gap.mo': '{n} মাস',
    'd.today': 'আজ',
    'd.thisWeek': 'এই সপ্তাহ',
    'd.mastered': 'আয়ত্তে',
    'd.ring.aria': '{pct} কার্ড আয়ত্তে',
    'd.stage.caption': 'ধাপ অনুযায়ী কার্ড',
    'd.stage.head.stage': 'ধাপ',
    'd.stage.head.cards': 'কার্ড',
    'd.stage.new': 'নতুন',
    'd.stage.new.hint': 'এখনও রিভিউ হয়নি',
    'd.stage.learning': 'শিখছেন',
    'd.stage.learning.hint': 'ছোট বিরতি, এখনও বসছে',
    'd.stage.strong': 'মজবুত হচ্ছে',
    'd.stage.strong.hint': '৪+ দিনের বিরতি',
    'd.stage.mastered': 'আয়ত্তে',
    'd.stage.mastered.hint': 'বারবার মনে পড়েছে',
    'd.bars.aria': 'প্রতিদিনের রিভিউ, গত ১৪ দিন',
    'd.bars.none': 'কোনো রিভিউ নেই',
    'd.bars.tip': '{recalled}টি মনে পড়েছে, {missed}টি ভুল',
    'd.bars.caption': 'প্রতিদিনের রিভিউ',
    'd.head.day': 'দিন',
    'd.head.week': 'সপ্তাহ শেষ',
    'd.head.reviews': 'রিভিউ',
    'd.head.recalled': 'মনে পড়েছে',
    'd.head.missed': 'ভুল',
    'd.head.due': 'বাকি কার্ড',
    'd.trend.range': '{from} থেকে {to}',
    'd.trend.tip': '{when}: {pct} মনে পড়েছে ({total}টির মধ্যে {n}টি)',
    'd.trend.aria.days': 'দিন অনুযায়ী মনে রাখার হার',
    'd.trend.aria.weeks': 'সপ্তাহ অনুযায়ী মনে রাখার হার',
    'd.trend.range.aria': 'চার্টের সময়সীমা',
    'd.trend.days': 'দিন',
    'd.trend.weeks': 'সপ্তাহ',
    'd.subj.count': '{cards}-এর মধ্যে {n}টি আয়ত্তে',
    'd.subj.aria': '{name}: {total}টির মধ্যে {n}টি আয়ত্তে',
    'd.subj.rate': '{pct} মনে পড়েছে',
    'd.subj.none': 'এখনও যথেষ্ট রিভিউ হয়নি',
    'd.subj.due': ' · {n}টি বাকি',
    'd.up.aria': 'সামনের ৭ দিনে যে কার্ড আসবে',
    'd.up.tip': '{when}: {cards} বাকি',
    'd.up.caption': 'সামনের ৭ দিনে বাকি কার্ড',
    'd.journey.after': '{gap} পরে',
    'd.journey.first': 'প্রথমবার',
    'd.journey.hit': 'মনে পড়েছে',
    'd.journey.miss': 'ভুল',
    'd.m.best': 'আপনার সবচেয়ে মজবুত স্মৃতি',
    'd.m.best.body': 'এটা আপনি টানা {n} বার ঠিক মনে করেছেন, আর বিরতি বেড়ে {gap} হয়েছে। এটাই স্পেসড রিপিটিশনের কাজ।',
    'd.m.long': 'সবচেয়ে দীর্ঘ স্মৃতি',
    'd.m.long.body': '“{q}” এখন শুধু প্রতি {span} পরপর রিভিউ লাগে।',
    'd.m.comeback': 'ফিরে আসা',
    'd.m.comeback.body': 'প্রথমে ভুল হয়েছিল, এখন ঠিক উত্তর হয়। পুরো ব্যাপারটাই এটা।',
    'd.m.turned': 'ভুল থেকে জ্ঞান',
    'd.m.turned.one': 'টি কার্ড ভুল হওয়ার কারণে রাখা হয়েছিল। এখন আপনি নিয়মিত মনে করতে পারেন।',
    'd.m.turned.many': 'টি কার্ড ভুল হওয়ার কারণে রাখা হয়েছিল। এখন আপনি নিয়মিত মনে করতে পারেন।',
    'd.m.tough': 'কঠিনতম জয়',
    'd.m.tough.title': '{n} বার চেষ্টা লেগেছে',
    'd.m.tough.body': '“{q}” সহজে ধরা দেয়নি, তবু আপনি আয়ত্ত করেছেন।',
    'd.m.day': 'সবচেয়ে বড় দিন',
    'd.m.day.body': '{date} তারিখে।',
    'd.m.empty': 'গর্বের মুহূর্তগুলো এখানে দেখা যাবে: যে কার্ড বারবার মনে পড়ে, আর বিরতি লম্বা হতে থাকে। প্রথমটা দেখতে কয়েকটা রিভিউ সেশন শেষ করুন।',
    'd.badges.count': '{total}টির মধ্যে {n}টি অর্জিত',
    'd.badges.earned': 'অর্জিত',
    'd.kpis': 'আপনার সংখ্যা',
    'd.k.reviews': 'রিভিউ হয়েছে',
    'd.k.reviews.yes': 'প্রতিটি স্মৃতিকে মজবুত করে',
    'd.k.reviews.no': 'প্রথমটা ছোট একটা সেশন',
    'd.k.rate': 'মনে রাখার হার',
    'd.k.rate.no': 'কয়েকটা রিভিউর পরে দেখা যাবে',
    'd.k.rate.yes': '{total}টির মধ্যে {n}টি উত্তর ঠিক',
    'd.k.span': 'স্মৃতির দৈর্ঘ্য',
    'd.k.span.yes': 'দীর্ঘতম বিরতি। গড় {avg}',
    'd.k.span.no': 'প্রতিবার মনে পড়লে বাড়ে',
    'd.k.for': 'শিখছেন',
    'd.k.saved': '{cards} রাখা হয়েছে',
    'd.note': 'পরের রিভিউ থেকে প্রতিদিনের কাজ আর মনে রাখার হার জমতে শুরু করবে।',
    'd.p.stand': 'আপনার কার্ড কোথায় আছে',
    'd.p.stand.note': 'বিরতি বাড়লে কার্ড ডানে সরে।',
    'd.p.14': 'গত ১৪ দিন',
    'd.p.14.note': 'দুই সপ্তাহে {reviews}',
    'd.p.14.empty': 'কয়েকটা কার্ড রিভিউ করুন, প্রতিটি দিন এখানে মনে পড়া আর ভুলে ভাগ হয়ে দেখা যাবে।',
    'd.p.rate.note.days': 'ঠিক উত্তরের ভাগ, গত ৩০ দিন।',
    'd.p.rate.note.weeks': 'ঠিক উত্তরের ভাগ, সপ্তাহ ধরে।',
    'd.p.rate.empty.days': 'প্রথম রিভিউ সেশনের পরে প্রতিদিনের হার দেখা যাবে।',
    'd.p.rate.empty.weeks': 'প্রথম রিভিউ সেশনের পরে সাপ্তাহিক হার দেখা যাবে।',
    'd.p.subj': 'বিষয় অনুযায়ী',
    'd.p.subj.note': 'যা রেখেছেন তার মধ্যে আয়ত্তে আসা কার্ড।',
    'd.p.up': 'সামনে আসছে',
    'd.p.up.note': 'সামনের সপ্তাহে যে কার্ড রিভিউ বাকি।',
    'd.p.proud': 'গর্বের মুহূর্ত',
    'd.p.proud.note': 'প্রমাণ যে মনে থাকছে।',
    'd.p.milestones': 'মাইলফলক',
    'badge.first-card': 'প্রথম কার্ড',
    'badge.first-card.desc': 'প্রথম কার্ডটি যোগ করুন',
    'badge.ten-cards': 'সংগ্রাহক',
    'badge.ten-cards.desc': '১০টি কার্ড রাখুন',
    'badge.first-review': 'প্রথম মনে পড়া',
    'badge.first-review.desc': 'একটি কার্ড রিভিউ করুন',
    'badge.reviews-50': 'সিরিয়াস হচ্ছেন',
    'badge.reviews-50.desc': '৫০টি রিভিউ শেষ করুন',
    'badge.first-mastered': 'গেঁথে গেছে',
    'badge.first-mastered.desc': 'প্রথম কার্ড আয়ত্ত করুন',
    'badge.five-mastered': 'হাই ফাইভ',
    'badge.five-mastered.desc': '৫টি কার্ড আয়ত্ত করুন',
    'badge.long-memory': 'দীর্ঘ স্মৃতি',
    'badge.long-memory.desc': 'দুই রিভিউর মাঝে ১৪+ দিন একটি কার্ড মনে রাখুন',
    'badge.comeback': 'ফিরে আসা',
    'badge.comeback.desc': 'একটি ভুল কার্ডকে ঠিক উত্তরে নিন',
  },
};

const DAY = 864e5;

export function dashT(lang) {
  const dict = STRINGS[lang] || STRINGS.en;
  const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] === undefined ? `{${name}}` : String(vars[name])));

  const t = (key, vars = {}, fallback) => {
    const text = dict[key] ?? STRINGS.en[key] ?? fallback ?? key;
    const filled = fill(text, vars);

    return lang === 'bn' ? bnDigits(filled) : filled;
  };

  // "3 cards", "1 card": key.one / key.many picked by n.
  t.n = (key, n, vars = {}) => t(`${key}.${n === 1 ? 'one' : 'many'}`, { n, ...vars });

  // The same steps as formatDays / formatGap in src/analytics.js.
  t.days = (days) => {
    const n = Math.round(days);

    if (n < 14) return t.n('d.day', n);
    if (n < 60) return t('d.weeks', { n: Math.round(n / 7) });

    return t('d.months', { n: Math.round(n / 30) });
  };

  t.gap = (ms) => {
    const minutes = ms / 60000;

    if (minutes < 90) return t('d.gap.min', { n: Math.max(1, Math.round(minutes)) });

    const hours = ms / 3600000;
    if (hours < 20) return t('d.gap.hr', { n: Math.round(hours) });

    const days = ms / DAY;
    if (days < 14) return t.n('d.day', Math.round(days));
    if (days < 60) return t('d.gap.wk', { n: Math.round(days / 7) });

    return t('d.gap.mo', { n: Math.round(days / 30) });
  };

  const locale = lang === 'bn' ? 'bn-BD' : undefined;

  t.date = (date, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => date.toLocaleDateString(locale, opts);
  t.lang = lang;

  return t;
}

export function useDashT() {
  const { lang } = useI18n();

  return useMemo(() => dashT(lang), [lang]);
}
