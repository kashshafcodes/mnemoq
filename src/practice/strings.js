import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { bnDigits } from '../loop/strings';

// Text for the practice library's kept misses and free-half copy, English and
// Bangla. Bangla numbers use Bangla digits, like the rest of the loop.

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
