import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { bnDigits } from '../loop/strings';

// The kept-misses box (src/practice/KeptMisses.jsx) and the practice library's own labels (src/components/Practice.jsx), in English
// and Bangla. Collection titles and blurbs come from library/catalog.json and
// stay as written there. In-app Bangla uses আপনি and Bangla digits; all
// Bangla is a draft for the owner's native read (Phase 3 Bangla audit).
export const STRINGS = {
  en: {
    'kept.saving': 'Keeping your misses…',
    'kept.n': '{n} will come back',
    'kept.n_one': '1 will come back',
    'kept.body': 'Your misses are review cards now, due today. Mnemoq brings each one back right before you forget it.',
    'kept.capped': 'The first {n} are kept, so your cards stay manageable.',
    'kept.undo': 'Don’t keep these',
    'kept.undoing': 'Removing…',
    'kept.undone': 'Removed. None of these misses will come back.',
    'kept.already': 'These misses are already in your cards.',
    'kept.review': 'Review them now →',
    'kept.error': 'Your misses could not be kept: {error}',
    'pr.title': 'Practice library',
    'pr.intro':
      '{total} questions in {n} collections, from vocabulary to physics. The first half of every collection is free ({free} questions), and every mistake comes back as a review card.',
    'pr.all': 'All',
    'pr.subjects': 'Subjects',
    'pr.back': '← All collections',
    'pr.meta.card': '{q} questions · {sets} sets',
    'pr.meta.done': ' · {n} done',
    'pr.meta.full': '{q} questions · {sets} sets of {size}',
    'pr.meta.worked': ' · worked solutions',
    'pr.meta.free': ' · {free} free · {done} done',
    'pr.set': 'Set {n}',
    'pr.n': '{n}',
    'pr.free': 'Free',
    'pr.start': 'Start',
    'pr.credit': 'Questions from',
    'pr.run.where': '{title} · Set {n} · {i} of {total}',
    'pr.run.score': '{n} correct',
    'pr.run.leave': 'Leave',
    'pr.run.answers': 'Answers',
    'pr.run.correct': 'Correct.',
    'pr.run.wrong': 'Not quite. The answer is {letter}.',
    'pr.run.back': 'Back',
    'pr.run.next': 'Next',
    'pr.run.finish': 'See my score',
    'pr.sum.where': '{title} · Set {n}',
    'pr.sum.score': 'of {total} correct',
    'pr.sum.perfect': 'A perfect set. Try the next one.',
    'pr.sum.next': 'Next set',
    'pr.sum.all': 'All sets',
    'pr.lock':
      'Sets 1 to {free} of {title} are free. Pro opens the other {rest}, {more} more questions across every subject, plus your plan and readiness report.',
    'pr.error': 'This set could not be loaded. Check your connection.',
  },
  bn: {
    'kept.saving': 'আপনার ভুলগুলো রাখা হচ্ছে…',
    'kept.n': '{n}টি আবার ফিরে আসবে',
    'kept.body': 'আপনার ভুলগুলো এখন রিভিউ কার্ড, আজই রিভিউ করা যাবে। ভুলে যাওয়ার ঠিক আগে Mnemoq প্রতিটি আবার সামনে আনবে।',
    'kept.capped': 'প্রথম {n}টি রাখা হয়েছে, যাতে কার্ড সামলানো সহজ থাকে।',
    'kept.undo': 'এগুলো রাখবেন না',
    'kept.undoing': 'সরানো হচ্ছে…',
    'kept.undone': 'সরানো হয়েছে। এই ভুলগুলো আর ফিরে আসবে না।',
    'kept.already': 'এই ভুলগুলো আগে থেকেই আপনার কার্ডে আছে।',
    'kept.review': 'এখনই রিভিউ করুন →',
    'kept.error': 'ভুলগুলো রাখা যায়নি: {error}',
    'pr.title': 'প্র্যাকটিস লাইব্রেরি',
    'pr.intro':
      'শব্দভান্ডার থেকে পদার্থবিজ্ঞান, {n}টি সংগ্রহে {total}টি প্রশ্ন। প্রতিটি সংগ্রহের প্রথম অর্ধেক ফ্রি ({free}টি প্রশ্ন), আর প্রতিটি ভুল রিভিউ কার্ড হয়ে ফিরে আসে।',
    'pr.all': 'সব',
    'pr.subjects': 'বিষয়',
    'pr.back': '← সব সংগ্রহ',
    'pr.meta.card': '{q}টি প্রশ্ন · {sets}টি সেট',
    'pr.meta.done': ' · {n}টি শেষ',
    'pr.meta.full': '{q}টি প্রশ্ন · {size}টি করে {sets}টি সেট',
    'pr.meta.worked': ' · সমাধানসহ',
    'pr.meta.free': ' · {free}টি ফ্রি · {done}টি শেষ',
    'pr.set': 'সেট {n}',
    'pr.free': 'ফ্রি',
    'pr.start': 'শুরু',
    'pr.credit': 'প্রশ্নের উৎস:',
    'pr.run.where': '{title} · সেট {n} · {total}টির মধ্যে {i}',
    'pr.run.score': '{n}টি সঠিক',
    'pr.run.leave': 'বের হোন',
    'pr.run.answers': 'উত্তর',
    'pr.run.correct': 'সঠিক।',
    'pr.run.wrong': 'হয়নি। সঠিক উত্তর {letter}।',
    'pr.run.back': 'পেছনে',
    'pr.run.next': 'পরের প্রশ্ন',
    'pr.run.finish': 'আমার স্কোর দেখুন',
    'pr.sum.where': '{title} · সেট {n}',
    'pr.sum.score': '{total}টির মধ্যে সঠিক',
    'pr.sum.perfect': 'পুরো সেট সঠিক! পরেরটা চেষ্টা করুন।',
    'pr.sum.next': 'পরের সেট',
    'pr.sum.all': 'সব সেট',
    'pr.lock':
      '{title}-এর ১ থেকে {free} নম্বর সেট ফ্রি। Pro খুলে দেয় বাকি {rest}টি সেট, সব বিষয়ে আরও {more}টি প্রশ্ন, সঙ্গে আপনার প্ল্যান ও প্রস্তুতি রিপোর্ট।',
    'pr.error': 'সেটটি লোড হয়নি। সংযোগ দেখে আবার চেষ্টা করুন।',
  },
};

export function practiceT(lang) {
  const dict = STRINGS[lang] || STRINGS.en;

  return (key, vars = {}) => {
    const one = vars.n === 1 && lang !== 'bn' ? dict[`${key}_one`] : null;
    const text = one ?? dict[key] ?? STRINGS.en[key] ?? key;
    const filled = text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] === undefined ? `{${name}}` : String(vars[name])));

    return lang === 'bn' ? bnDigits(filled) : filled;
  };
}

export function usePracticeT() {
  const { lang } = useI18n();

  return useMemo(() => practiceT(lang), [lang]);
}
