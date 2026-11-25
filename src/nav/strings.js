import { useMemo } from 'react';
import { useI18n } from '../i18n';

// Text for the five tabs, the Exam views and the small Me additions, in
// English and Bangla (spec company/product/phase2-tabs.md §7). Bangla is a
// best-effort draft until the pre-launch audit.

export const NAV_STRINGS = {
  en: {
    'nav.today': 'Today',
    'nav.exam': 'Exam',
    'nav.snap': 'Snap',
    'nav.snapLong': 'Snap a mistake',
    'nav.progress': 'Progress',
    'nav.library': 'Library',
    'nav.me': 'Me',
    'nav.main': 'Main menu',
    'nav.close': 'Close',
    'nav.examViews': 'Exam views',
    'exam.seg.path': 'Path',
    'exam.seg.mocks': 'Mock tests',
    'exam.seg.practice': 'Practice',
    'me.help.title': 'Help',
    'me.help.1': 'Snap a mistake. It becomes a card.',
    'me.help.2': 'Play today’s round. Cards come back right before you’d forget.',
    'me.help.3': 'Progress shows if you’re ready.',
    'me.pro.title': 'Mnemoq Pro',
    'me.pro.on': '{n} days left',
    'me.pro.on_one': '1 day left',
    'me.pro.off': 'Full tests, more AI and every practice set',
    'me.stats': 'Stats (admins only)',
  },
  bn: {
    'nav.today': 'আজ',
    'nav.exam': 'পরীক্ষা',
    'nav.snap': 'স্ন্যাপ',
    'nav.snapLong': 'একটা ভুল স্ন্যাপ করুন',
    'nav.progress': 'অগ্রগতি',
    'nav.library': 'লাইব্রেরি',
    'nav.me': 'আমি',
    'nav.main': 'মূল মেনু',
    'nav.close': 'বন্ধ করুন',
    'nav.examViews': 'পরীক্ষার অংশ',
    'exam.seg.path': 'পথ',
    'exam.seg.mocks': 'মক টেস্ট',
    'exam.seg.practice': 'প্র্যাকটিস',
    'me.help.title': 'সাহায্য',
    'me.help.1': 'ভুল স্ন্যাপ করুন, সেটা কার্ড হয়ে যাবে।',
    'me.help.2': 'আজকের রাউন্ড খেলুন। ভুলে যাওয়ার ঠিক আগে কার্ড ফিরে আসবে।',
    'me.help.3': 'অগ্রগতিতে দেখুন আপনি তৈরি কি না।',
    'me.pro.title': 'Mnemoq Pro',
    'me.pro.on': 'আর {n} দিন বাকি',
    'me.pro.off': 'পূর্ণ টেস্ট, আরও AI আর সব প্র্যাকটিস সেট',
    'me.stats': 'পরিসংখ্যান (শুধু অ্যাডমিন)',
  },
};

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

export function navT(lang) {
  const dict = NAV_STRINGS[lang] || NAV_STRINGS.en;

  return (key, vars = {}) => {
    const one = vars.n === 1 ? dict[`${key}_one`] : null;
    const text = one ?? dict[key] ?? NAV_STRINGS.en[key] ?? key;
    const filled = text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] === undefined ? `{${name}}` : String(vars[name])));

    return lang === 'bn' ? filled.replace(/\d/g, (d) => BN_DIGITS[d]) : filled;
  };
}

export function useNavT() {
  const { lang } = useI18n();

  return useMemo(() => navT(lang), [lang]);
}
