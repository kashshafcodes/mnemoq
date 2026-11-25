import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { bnDigits } from '../loop/strings';

// The Exam tab's first screen, "pick your exam" (src/components/PathSetup.jsx),
// in English and Bangla. Exam names and taglines come from src/paths.js. All
// Bangla is a draft for the owner's native read (Phase 3 Bangla audit).
export const STRINGS = {
  en: {
    'ex.n': '{n}',
    'ex.kicker.add': 'ADD AN EXAM',
    'ex.kicker': 'YOUR EXAM PATH',
    'ex.title': 'What are you preparing for?',
    'ex.ai': 'AI-built plan',
    'ex.sub': 'Pick your exam and Mnemoq builds your preparation around it: a countdown, a diagnostic of every section, and a score that moves as you practise.',
    'ex.all': 'You already follow every exam Mnemoq offers. More are on the way.',
    'ex.choices': 'Exam path',
    'ex.soon': 'More exams soon',
    'ex.soon.sub': 'BUET, medical and more are on the way.',
    'ex.date.sat': 'Test date',
    'ex.date': 'Exam date',
    'ex.optional': '(optional, you can add it later)',
    'ex.target': 'Target {word}: ',
    'ex.outOf': ' out of {max}',
    'ex.word.score': 'estimated score',
    'ex.word.readiness': 'readiness',
    'ex.hint.sat': 'Your target is the total SAT score you want, from 400 to 1600. Many scholarship programmes look for 1400 or more. You can change it at any time.',
    'ex.hint': 'Readiness is your estimated chance-ready score. Most students aim for about {n}.',
    'ex.replaces': 'Your account can hold one exam at the moment, so this will replace {name}. Your {name} results stay saved.',
    'ex.saving': 'Saving...',
    'ex.add': 'Add this exam',
    'ex.start': 'Start my path',
    'ex.cancel': 'Cancel',
  },
  bn: {
    'ex.kicker.add': 'আরেকটি পরীক্ষা যোগ করুন',
    'ex.kicker': 'আপনার পরীক্ষার পথ',
    'ex.title': 'আপনি কোন পরীক্ষার প্রস্তুতি নিচ্ছেন?',
    'ex.ai': 'AI-তৈরি প্ল্যান',
    'ex.sub': 'পরীক্ষা বেছে নিন, Mnemoq সেটা ঘিরে আপনার প্রস্তুতি সাজাবে: কাউন্টডাউন, প্রতিটি অংশের ডায়াগনস্টিক, আর প্র্যাকটিসের সঙ্গে বাড়তে থাকা স্কোর।',
    'ex.all': 'Mnemoq-এর সব পরীক্ষাই আপনি অনুসরণ করছেন। আরও আসছে।',
    'ex.choices': 'পরীক্ষার পথ',
    'ex.soon': 'আরও পরীক্ষা শিগগিরই',
    'ex.soon.sub': 'BUET, মেডিকেল আর আরও অনেক কিছু আসছে।',
    'ex.date.sat': 'টেস্টের তারিখ',
    'ex.date': 'পরীক্ষার তারিখ',
    'ex.optional': '(ঐচ্ছিক, পরে যোগ করতে পারবেন)',
    'ex.target': 'লক্ষ্য {word}: ',
    'ex.outOf': ' / {max}',
    'ex.word.score': 'আনুমানিক স্কোর',
    'ex.word.readiness': 'প্রস্তুতি',
    'ex.hint.sat': 'আপনার লক্ষ্য হলো মোট SAT স্কোর, ৪০০ থেকে ১৬০০। অনেক স্কলারশিপ ১৪০০ বা তার বেশি চায়। যেকোনো সময় বদলাতে পারবেন।',
    'ex.hint': 'প্রস্তুতি হলো আপনার আনুমানিক তৈরি-থাকার স্কোর। বেশিরভাগ শিক্ষার্থী প্রায় {n} লক্ষ্য রাখে।',
    'ex.replaces': 'আপনার অ্যাকাউন্টে এখন একটিই পরীক্ষা রাখা যায়, তাই এটি {name}-এর জায়গা নেবে। {name}-এর ফলাফল সংরক্ষিত থাকবে।',
    'ex.saving': 'সংরক্ষণ হচ্ছে...',
    'ex.add': 'এই পরীক্ষা যোগ করুন',
    'ex.start': 'আমার পথ শুরু করুন',
    'ex.cancel': 'বাতিল',
  },
};

export function examT(lang) {
  const dict = STRINGS[lang] || STRINGS.en;

  return (key, vars = {}) => {
    const text = dict[key] ?? STRINGS.en[key] ?? key;
    const filled = text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] === undefined ? `{${name}}` : String(vars[name])));

    return lang === 'bn' ? bnDigits(filled) : filled;
  };
}

export function useExamT() {
  const { lang } = useI18n();

  return useMemo(() => examT(lang), [lang]);
}
