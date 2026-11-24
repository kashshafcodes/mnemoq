import { useMemo } from 'react';
import { useI18n } from '../i18n';

// Text for today's loop (the Play button, the end of a round, "Done for today"
// and the empty states), in English and Bangla. From Marketing's
// company/marketing/app-copy-phase1.md, sections 4 to 6. Keys keep the names
// used there. In Bangla every number is written with Bangla digits.

export const STRINGS = {
  en: {
    'play.label': 'Play',
    'play.doneLabel': 'Done',
    'play.due': '{n} cards fading',
    'play.due_one': '1 card fading',
    'play.many': 'Round of {size}',
    'play.daily': 'Tonight’s lanterns',
    'play.done': 'Back tomorrow',
    'play.aria.due': 'Play: review {n} cards',
    'play.aria.due_one': 'Play: review 1 card',
    'play.aria.many': 'Play: a round of {size} cards',
    'play.aria.daily': 'Play today’s Daily puzzle',
    'play.aria.done': 'Done for today. Opens today’s summary',
    'play.title': 'Play today’s round',

    'session.done.eyebrow': 'ROUND DONE',
    'session.done.recalled': 'recalled',
    'session.line.perfect': 'Every one came back. Jonaki saw that.',
    'session.line.strong': 'Strong round. Most of it is sticking.',
    'session.line.solid': 'Solid. The misses will come back soon, a little easier next time.',
    'session.line.tough': 'A tough round. Struggling to recall is part of how it sticks.',
    'session.missed.title': 'THESE WILL COME BACK SOON',
    'session.next.more': 'Next round ({n} left)',
    'session.next.daily': 'Play tonight’s Daily',
    'session.next.done': 'Done for today',
    'session.next.stop': 'Stop here for now',

    'dailyEnd.review.save': 'Save {n} misses and review them now',
    'dailyEnd.review.save_one': 'Save 1 miss and review it now',
    'dailyEnd.perfect.next': 'Nothing to review from tonight. Done for today?',
    'dailyEnd.dueToo': 'You also have {n} cards fading. One round?',
    'dailyEnd.dueToo_one': 'You also have 1 card fading. One round?',
    'dailyEnd.later': 'Later is fine',

    'done.title.1': 'Done for today. Nothing else is due.',
    'done.title.2': 'All lanterns lit. Go enjoy your day.',
    'done.title.3': 'Jonaki is resting its lantern. See you tomorrow.',
    'done.title.4': 'Nothing is fading right now. That’s your doing.',
    'done.title.5': 'A small light, every day. Today’s is done.',
    'done.title.6': 'Rest now. Your cards come back when it’s time.',
    'done.tomorrow.cards': 'Tomorrow: {n} cards, and a new Daily in {time}.',
    'done.tomorrow.cards_one': 'Tomorrow: 1 card, and a new Daily in {time}.',
    'done.tomorrow.daily': 'A new Daily arrives in {time}.',
    'done.extra': 'Still curious? Browse the practice library.',
    'done.reminder': 'Want Jonaki to tap you tomorrow? Turn on reminders.',
    'done.home': 'Back to Home',

    'empty.noCards.title': 'No cards yet. A clean start.',
    'empty.noCards.body': 'Every mistake you save becomes a card that comes back right before you’d forget it.',
    'empty.noCards.daily': 'Play today’s Daily',
    'empty.noCards.add': 'Add a mistake',
    'empty.nothingDue.title': 'Nothing is fading right now.',
    'empty.nothingDue.body': 'Your {n} cards are resting. Each one comes back when it’s due.',
    'empty.nothingDue.subject': '{subject} is all done for now.',
    'empty.nothingDue.otherSubject': 'Other subjects still have cards waiting.',
    'empty.nothingDue.daily': 'Play today’s Daily while you wait',
    'empty.practice': 'Pick a practice set',
  },
  bn: {
    'play.label': 'খেলুন',
    'play.doneLabel': 'শেষ',
    'play.due': '{n}টি কার্ড ঝাপসা',
    'play.many': '{size}টির রাউন্ড',
    'play.daily': 'আজকের লণ্ঠন',
    'play.done': 'কাল আবার',
    'play.aria.due': 'খেলুন: {n}টি কার্ড রিভিউ',
    'play.aria.many': 'খেলুন: {size}টি কার্ডের রাউন্ড',
    'play.aria.daily': 'আজকের ডেইলি ধাঁধা খেলুন',
    'play.aria.done': 'আজকের মতো শেষ। আজকের সারাংশ খুলবে',
    'play.title': 'আজকের রাউন্ড খেলুন',

    'session.done.eyebrow': 'রাউন্ড শেষ',
    'session.done.recalled': 'মনে পড়েছে',
    'session.line.perfect': 'সবগুলোই মনে পড়েছে। জোনাকি দেখেছে।',
    'session.line.strong': 'দারুণ রাউন্ড। বেশিরভাগই মনে বসে যাচ্ছে।',
    'session.line.solid': 'ভালো হয়েছে। ভুলগুলো শিগগিরই ফিরে আসবে, পরের বার একটু সহজ লাগবে।',
    'session.line.tough': 'কঠিন রাউন্ড। মনে করতে কষ্ট হওয়াটাও মনে বসে যাওয়ার অংশ।',
    'session.missed.title': 'এগুলো শিগগিরই ফিরে আসবে',
    'session.next.more': 'পরের রাউন্ড (আরও {n}টি)',
    'session.next.daily': 'আজকের ডেইলি খেলুন',
    'session.next.done': 'আজকের মতো শেষ',
    'session.next.stop': 'আপাতত এখানেই থামি',

    'dailyEnd.review.save': '{n}টি ভুল রেখে এখনই রিভিউ করুন',
    'dailyEnd.perfect.next': 'আজ রাতে রিভিউ করার মতো কিছু নেই। আজকের মতো শেষ?',
    'dailyEnd.dueToo': 'আরও {n}টি কার্ড ঝাপসা হচ্ছে। একটা রাউন্ড হবে?',
    'dailyEnd.later': 'পরে করলেও চলবে',

    'done.title.1': 'আজকের মতো শেষ। আর কিছু বাকি নেই।',
    'done.title.2': 'সব লণ্ঠন জ্বলেছে। এবার নিজের দিনটা উপভোগ করুন।',
    'done.title.3': 'জোনাকি লণ্ঠন নামিয়ে বিশ্রাম নিচ্ছে। কাল দেখা হবে।',
    'done.title.4': 'এই মুহূর্তে কিছুই ঝাপসা হচ্ছে না। এটা আপনারই কৃতিত্ব।',
    'done.title.5': 'প্রতিদিন একটু আলো। আজকেরটা হয়ে গেছে।',
    'done.title.6': 'এখন বিশ্রাম। সময় হলে কার্ডগুলো নিজেই ফিরে আসবে।',
    'done.tomorrow.cards': 'কাল: {n}টি কার্ড, আর নতুন ডেইলি {time} পরে।',
    'done.tomorrow.daily': 'নতুন ডেইলি আসবে {time} পরে।',
    'done.extra': 'আরও পড়তে ইচ্ছে করছে? প্র্যাকটিস লাইব্রেরি দেখুন।',
    'done.reminder': 'কাল জোনাকি মনে করিয়ে দিক? রিমাইন্ডার চালু করুন।',
    'done.home': 'হোমে ফিরুন',

    'empty.noCards.title': 'এখনও কোনো কার্ড নেই। একদম নতুন শুরু।',
    'empty.noCards.body': 'যে ভুলটাই রাখবেন, সেটা কার্ড হয়ে ভুলে যাওয়ার ঠিক আগে ফিরে আসবে।',
    'empty.noCards.daily': 'আজকের ডেইলি খেলুন',
    'empty.noCards.add': 'একটা ভুল যোগ করুন',
    'empty.nothingDue.title': 'এই মুহূর্তে কিছুই ঝাপসা হচ্ছে না।',
    'empty.nothingDue.body': 'আপনার {n}টি কার্ড বিশ্রামে আছে। সময় হলে প্রতিটি ফিরে আসবে।',
    'empty.nothingDue.subject': '{subject}-এর সব কার্ড আপাতত শেষ।',
    'empty.nothingDue.otherSubject': 'অন্য বিষয়ে এখনও কার্ড অপেক্ষা করছে।',
    'empty.nothingDue.daily': 'অপেক্ষার ফাঁকে আজকের ডেইলি খেলুন',
    'empty.practice': 'একটা প্র্যাকটিস সেট বাছুন',
  },
};

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export const bnDigits = (text) => String(text).replace(/\d/g, (d) => BN_DIGITS[d]);

// t('play.due', { n: 3 }) -> "3 cards fading". English uses the `_one` form
// when n is 1; Bangla needs none. Bangla gets Bangla digits throughout.
export function loopT(lang) {
  const dict = STRINGS[lang] || STRINGS.en;

  return (key, vars = {}) => {
    const oneKey = `${key}_one`;
    const useOne = vars.n === 1 && (dict[oneKey] || (lang !== 'bn' && STRINGS.en[oneKey]));
    const text = (useOne ? dict[oneKey] ?? STRINGS.en[oneKey] : null) ?? dict[key] ?? STRINGS.en[key] ?? key;
    const filled = text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] === undefined ? `{${name}}` : String(vars[name])));

    return lang === 'bn' ? bnDigits(filled) : filled;
  };
}

export function useLoopT() {
  const { lang } = useI18n();

  return useMemo(() => loopT(lang), [lang]);
}
