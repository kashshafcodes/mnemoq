import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { bnDigits } from '../loop/strings';

// Text for Snap a mistake, in English and Bangla. From Product's spec
// company/product/phase2-snap.md §8, with the privacy line changed per the
// owner's 25 Nov decision (free Gemini tier: say an AI service reads it and
// Mnemoq doesn't keep it; never claim more). Bangla gets Bangla digits.

export const STRINGS = {
  en: {
    'snap.title': 'Snap a mistake',
    'snap.sub': 'Photo it, type it or paste it. Jonaki makes the card.',
    'snap.first': 'Your first card starts with one mistake.',
    'snap.camera': 'Take a photo',
    'snap.gallery': 'Choose a photo',
    'snap.type.label': 'Or type it',
    'snap.type.placeholder': 'Type or paste the question, and the right answer if you have it',
    'snap.type.go': 'Make my card',
    'snap.type.count': '{n}/600',
    'snap.manual': 'Write it yourself',
    'snap.import': 'Import cards',
    'snap.left': '{n} snaps left today',
    'snap.left_one': '1 snap left today',
    'snap.photo.use': 'Use this photo',
    'snap.photo.retake': 'Retake',
    'snap.photo.alt': 'Your photo',
    'snap.reading': 'Reading your photo...',
    'snap.making': 'Making your card...',
    'snap.jonaki.reading': 'One moment. I’m reading it.',
    'snap.slow': 'Still reading. A clear, close photo is faster.',
    'snap.cancel': 'Cancel',
    'snap.close': 'Close',
    'snap.back': 'Back',
    'snap.card.question': 'Question',
    'snap.card.answer': 'Right answer',
    'snap.card.yours': 'You answered',
    'snap.card.hook': 'Memory hook',
    'snap.card.subject': 'Subject',
    'snap.card.due': 'Jonaki brings it back tomorrow.',
    'snap.saved': 'Saved. See you tomorrow.',
    'snap.unsure': 'I’m not fully sure about this one. Check the answer, then keep it.',
    'snap.keep': 'Keep it',
    'snap.edit': 'Edit',
    'snap.editDone': 'Save changes',
    'snap.undo': 'Undo',
    'snap.undone': 'Removed.',
    'snap.tryNow': 'Try it now',
    'snap.another': 'Snap another',
    'snap.privacy': 'An AI service reads your photo or text. Mnemoq doesn’t keep the photo, only the card. Leave out names and faces.',
    'snap.err.unreadable': 'I couldn’t read that. Try closer, in better light, one question at a time.',
    'snap.err.notStudy': 'That doesn’t look like something to study. Try a question or a note.',
    'snap.err.noAnswer': 'I can see the question but not the right answer. Type the answer and I’ll finish the card.',
    'snap.err.many': 'There are a few questions here. I made a card from the one marked wrong.',
    'snap.err.tooLong': 'That’s a lot at once. Paste one question at a time.',
    'snap.err.tooBig': 'That photo is too large. Take a closer one.',
    'snap.err.busy': 'Jonaki is busy right now. Try again in a minute.',
    'snap.err.network': 'Couldn’t reach Mnemoq. What you added is still here. Try again.',
    'snap.err.config': 'Snap isn’t available right now. You can still write a card yourself.',
    'snap.err.failed': 'Jonaki couldn’t make a good card this time. Try again.',
    'snap.err.save': 'Couldn’t save the card. Try again.',
    'snap.err.auth': 'Please sign in again to snap a mistake.',
    'snap.err.free': 'That didn’t use a snap.',
    'snap.err.retry': 'Try again',
    'snap.err.typeInstead': 'Type it instead',
    'snap.offline.photo': 'Photos need a connection to be read. You can still write a card yourself.',
    'snap.offline.save': 'Save as a card without AI',
    'snap.offline.answer': 'Right answer',
    'snap.limit.after': 'That was your last snap for today.',
    'snap.limit.title': 'You’ve used today’s {limit} snaps',
    'snap.limit.body': 'They come back in about {time}. You can write cards yourself, free, any time.',
    'snap.limit.bodyLater': 'They come back within a day. You can write cards yourself, free, any time.',
    'snap.limit.pro': 'See Pro',
    'snap.limit.proLine': 'Pro from ৳{price}: {n} snaps a day.',
    'snap.limit.later': 'Come back tomorrow',
    'snap.limit.laterSoon': 'Come back in {time}',
    'snap.limit.manual': 'Write a card yourself, free',
    'snap.import.title': 'Import cards',
    'snap.import.set': 'Make a set on a topic (uses 1 snap)',
    'snap.import.csv': 'From a file',
    'snap.import.several': 'Write several cards',
    'snap.import.topic': 'Topic',
    'snap.import.subject': 'Subject',
    'snap.import.make': 'Make the set',
    'snap.import.making': 'Writing and double-checking your set...',
    'snap.import.add': 'Add {n} cards',
    'snap.import.added': 'Added {n} cards.',
    'snap.import.csvHint': 'A .csv file with “question” and “answer” columns (optional: wrong, hook, subject, category).',
    'snap.import.skipped': '{n} rows skipped (no question or answer).',
    'snap.import.skipped_one': '1 row skipped (no question or answer).',
    'snap.import.add_one': 'Add 1 card',
    'snap.import.added_one': 'Added 1 card.',
    'time.h': '{h}h',
    'time.hm': '{h}h {m}m',
    'time.m': '{m}m',
  },
  bn: {
    'snap.title': 'ভুলটা তুলে রাখুন',
    'snap.sub': 'ছবি তুলুন, লিখুন বা পেস্ট করুন। কার্ড বানাবে জোনাকি।',
    'snap.first': 'আপনার প্রথম কার্ড শুরু হবে একটা ভুল দিয়ে।',
    'snap.camera': 'ছবি তুলুন',
    'snap.gallery': 'গ্যালারি থেকে নিন',
    'snap.type.label': 'অথবা লিখে দিন',
    'snap.type.placeholder': 'প্রশ্নটা লিখুন বা পেস্ট করুন, সঠিক উত্তর জানা থাকলে সেটাও',
    'snap.type.go': 'কার্ড বানান',
    'snap.type.count': '{n}/600',
    'snap.manual': 'নিজে লিখুন',
    'snap.import': 'কার্ড ইমপোর্ট করুন',
    'snap.left': 'আজ আর {n}টি স্ন্যাপ বাকি',
    'snap.photo.use': 'এই ছবিটা নিন',
    'snap.photo.retake': 'আবার তুলুন',
    'snap.photo.alt': 'আপনার ছবি',
    'snap.reading': 'ছবিটা পড়ছি...',
    'snap.making': 'আপনার কার্ড বানাচ্ছি...',
    'snap.jonaki.reading': 'একটু দাঁড়ান, পড়ে দেখছি।',
    'snap.slow': 'এখনও পড়ছি। কাছ থেকে তোলা পরিষ্কার ছবি হলে দ্রুত হয়।',
    'snap.cancel': 'বাদ দিন',
    'snap.close': 'বন্ধ করুন',
    'snap.back': 'ফিরে যান',
    'snap.card.question': 'প্রশ্ন',
    'snap.card.answer': 'সঠিক উত্তর',
    'snap.card.yours': 'আপনি লিখেছিলেন',
    'snap.card.hook': 'মনে রাখার সূত্র',
    'snap.card.subject': 'বিষয়',
    'snap.card.due': 'জোনাকি এটা কাল ফিরিয়ে আনবে।',
    'snap.saved': 'রাখা হয়েছে। কাল দেখা হবে।',
    'snap.unsure': 'এটা নিয়ে আমি পুরোপুরি নিশ্চিত নই। উত্তরটা মিলিয়ে নিয়ে রাখুন।',
    'snap.keep': 'রাখুন',
    'snap.edit': 'বদলান',
    'snap.editDone': 'বদল রাখুন',
    'snap.undo': 'ফিরিয়ে নিন',
    'snap.undone': 'সরিয়ে দেওয়া হয়েছে।',
    'snap.tryNow': 'এখনই চেষ্টা করুন',
    'snap.another': 'আরেকটা তুলুন',
    'snap.privacy': 'একটা এআই সার্ভিস আপনার ছবি বা লেখা পড়ে। Mnemoq ছবিটা রাখে না, শুধু কার্ডটা রাখে। নাম ও মুখ বাদ রাখুন।',
    'snap.err.unreadable': 'পড়তে পারিনি। আরও কাছ থেকে, ভালো আলোয়, একবারে একটা প্রশ্ন তুলুন।',
    'snap.err.notStudy': 'এটা পড়ার বিষয় মনে হচ্ছে না। একটা প্রশ্ন বা নোট চেষ্টা করুন।',
    'snap.err.noAnswer': 'প্রশ্নটা দেখতে পাচ্ছি, কিন্তু সঠিক উত্তর পাচ্ছি না। উত্তরটা লিখুন, বাকিটা আমি করব।',
    'snap.err.many': 'এখানে কয়েকটি প্রশ্ন আছে। যেটায় ভুল চিহ্ন, সেটা থেকে কার্ড বানিয়েছি।',
    'snap.err.tooLong': 'একসাথে অনেক বেশি। একবারে একটা প্রশ্ন পেস্ট করুন।',
    'snap.err.tooBig': 'ছবিটা অনেক বড়। আরেকটু কাছ থেকে তুলুন।',
    'snap.err.busy': 'জোনাকি এখন একটু ব্যস্ত। এক মিনিট পরে আবার চেষ্টা করুন।',
    'snap.err.network': 'Mnemoq-এ পৌঁছানো যায়নি। আপনার দেওয়া জিনিসটা এখানেই আছে। আবার চেষ্টা করুন।',
    'snap.err.config': 'স্ন্যাপ এখন চালু নেই। তবুও নিজে একটা কার্ড লিখে রাখতে পারেন।',
    'snap.err.failed': 'জোনাকি এবার ভালো কার্ড বানাতে পারেনি। আবার চেষ্টা করুন।',
    'snap.err.save': 'কার্ডটা রাখা যায়নি। আবার চেষ্টা করুন।',
    'snap.err.auth': 'ভুল তুলে রাখতে আবার সাইন ইন করুন।',
    'snap.err.free': 'এতে কোনো স্ন্যাপ খরচ হয়নি।',
    'snap.err.retry': 'আবার চেষ্টা করুন',
    'snap.err.typeInstead': 'লিখে দিন',
    'snap.offline.photo': 'ছবি পড়তে ইন্টারনেট লাগে। তবুও নিজে একটা কার্ড লিখে রাখতে পারেন।',
    'snap.offline.save': 'এআই ছাড়া কার্ড হিসেবে রাখুন',
    'snap.offline.answer': 'সঠিক উত্তর',
    'snap.limit.after': 'আজকের শেষ স্ন্যাপটা হয়ে গেল।',
    'snap.limit.title': 'আজকের {limit}টি স্ন্যাপ শেষ',
    'snap.limit.body': 'প্রায় {time} পরে ফিরে আসবে। নিজে কার্ড লিখে রাখা সবসময় বিনামূল্যে।',
    'snap.limit.bodyLater': 'এক দিনের মধ্যে ফিরে আসবে। নিজে কার্ড লিখে রাখা সবসময় বিনামূল্যে।',
    'snap.limit.pro': 'Pro দেখুন',
    'snap.limit.proLine': 'Pro ৳{price} থেকে: দিনে {n}টি স্ন্যাপ।',
    'snap.limit.later': 'কাল আবার আসব',
    'snap.limit.laterSoon': '{time} পরে আবার আসব',
    'snap.limit.manual': 'নিজে একটা কার্ড লিখুন, বিনামূল্যে',
    'snap.import.title': 'কার্ড ইমপোর্ট',
    'snap.import.set': 'একটা টপিকের কার্ড-সেট বানান (১টি স্ন্যাপ লাগবে)',
    'snap.import.csv': 'ফাইল থেকে',
    'snap.import.several': 'কয়েকটি কার্ড লিখুন',
    'snap.import.topic': 'টপিক',
    'snap.import.subject': 'বিষয়',
    'snap.import.make': 'সেট বানান',
    'snap.import.making': 'সেটটা লিখে মিলিয়ে দেখছি...',
    'snap.import.add': '{n}টি কার্ড যোগ করুন',
    'snap.import.added': '{n}টি কার্ড যোগ হয়েছে।',
    'snap.import.csvHint': '“question” ও “answer” কলামসহ একটা .csv ফাইল (চাইলে wrong, hook, subject, category-ও)।',
    'snap.import.skipped': '{n}টি সারি বাদ পড়েছে (প্রশ্ন বা উত্তর নেই)।',
    'time.h': '{h} ঘণ্টা',
    'time.hm': '{h} ঘণ্টা {m} মিনিট',
    'time.m': '{m} মিনিট',
  },
};

export function snapT(lang) {
  const dict = STRINGS[lang] || STRINGS.en;

  return (key, vars = {}) => {
    const oneKey = `${key}_one`;
    const useOne = vars.n === 1 && lang !== 'bn' && STRINGS.en[oneKey];
    const text = (useOne ? STRINGS.en[oneKey] : null) ?? dict[key] ?? STRINGS.en[key] ?? key;
    const filled = text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] === undefined ? `{${name}}` : String(vars[name])));

    return lang === 'bn' ? bnDigits(filled) : filled;
  };
}

// "about 5h" style wait until `resetsAt`. Up to 6 hours counts as soon
// ("Come back in 5h"); longer reads as "Come back tomorrow".
export function waitText(t, resetsAt, now = Date.now()) {
  const ms = Date.parse(resetsAt) - now;

  if (!Number.isFinite(ms) || ms <= 0) return null;

  const minutes = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const text = h === 0 ? t('time.m', { m }) : m === 0 || h >= 3 ? t('time.h', { h: m >= 30 ? h + 1 : h }) : t('time.hm', { h, m });

  return { soon: minutes <= 6 * 60, text };
}

export function useSnapT() {
  const { lang } = useI18n();

  return useMemo(() => snapT(lang), [lang]);
}
