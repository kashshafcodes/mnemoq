import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { bnDigits } from '../loop/strings';

// Glow, the streak and milestones, in English and Bangla (spec §6). In-app
// Bangla uses আপনি and Bangla digits. All Bangla is a draft for the owner's
// native read. Never guilt copy: a rest day is calm, an ended streak leads
// with the next step and the best.

export const STRINGS = {
  en: {
    'glow.label': 'Glow',
    'glow.gain': '+{n} Glow',
    'glow.today': '+{n} Glow today',
    'glow.next': '{n} Glow to {level}',
    'glow.levelUp': 'Jonaki grew brighter: {level}.',
    'glow.capped': 'Jonaki is as bright as it can get today. More tomorrow.',
    'glow.promise': 'Glow is yours. It never fades and it can’t be bought.',
    'glow.level.1': 'Spark',
    'glow.level.2': 'Glimmer',
    'glow.level.3': 'Lantern',
    'glow.level.4': 'Beacon',
    'glow.level.5': 'Starlight',
    'streak.label': 'Days lit',
    'streak.best': 'Best: {n}',
    'streak.how': 'Rest days are free: up to 2 in any 7 days.',
    'streak.rest.line': 'Rest days used: {n} of 2',
    'streak.rest.today': 'Yesterday was a rest day. Your light is still on.',
    'streak.atRisk': 'Both rest days are used. One card today keeps the streak.',
    'streak.ended': 'A new streak starts with your next card. Your best: {n}.',
    'streak.aria': '{n} days lit, best {best}. {rest} rest days used.',
    'streak.m3': 'Three days lit. Jonaki noticed.',
    'streak.m7': 'A whole week lit.',
    'streak.m14': 'Two weeks of light.',
    'streak.m30': 'A month of light. That is real work.',
    'streak.m60': 'Sixty days lit.',
    'streak.m100': 'A hundred days lit.',
  },
  bn: {
    'glow.label': 'আভা',
    'glow.gain': '+{n} আভা',
    'glow.today': 'আজ +{n} আভা',
    'glow.next': '{level}-এ পৌঁছাতে আরও {n} আভা',
    'glow.levelUp': 'জোনাকি আরও উজ্জ্বল হলো: {level}।',
    'glow.capped': 'আজ জোনাকি যতটা উজ্জ্বল হওয়ার, হয়েছে। বাকিটা কাল।',
    'glow.promise': 'আভা আপনারই। এটা কখনো কমে না, আর কেনাও যায় না।',
    'glow.level.1': 'স্ফুলিঙ্গ',
    'glow.level.2': 'ঝিলিক',
    'glow.level.3': 'লণ্ঠন',
    'glow.level.4': 'বাতিঘর',
    'glow.level.5': 'তারার আলো',
    'streak.label': 'আলো জ্বালা দিন',
    'streak.best': 'সেরা: {n}',
    'streak.how': 'বিশ্রামের দিন বিনামূল্যে: যেকোনো ৭ দিনে ২টি পর্যন্ত।',
    'streak.rest.line': 'বিশ্রামের দিন নেওয়া হয়েছে: ২টির মধ্যে {n}টি',
    'streak.rest.today': 'গতকাল বিশ্রামের দিন ছিল। আপনার আলো এখনও জ্বলছে।',
    'streak.atRisk': 'দুটি বিশ্রামের দিনই নেওয়া হয়ে গেছে। আজ একটা কার্ড দেখলেই ধারাটা থাকবে।',
    'streak.ended': 'পরের কার্ডটা থেকেই নতুন ধারা শুরু। আপনার সেরা: {n}।',
    'streak.aria': '{n} দিন আলো জ্বলেছে, সেরা {best}। {rest}টি বিশ্রামের দিন নেওয়া হয়েছে।',
    'streak.m3': 'তিন দিন আলো জ্বলেছে। জোনাকি খেয়াল করেছে।',
    'streak.m7': 'পুরো এক সপ্তাহ আলো জ্বলেছে।',
    'streak.m14': 'দুই সপ্তাহের আলো।',
    'streak.m30': 'এক মাসের আলো। এটা সত্যিকারের পরিশ্রম।',
    'streak.m60': 'ষাট দিন আলো জ্বলেছে।',
    'streak.m100': 'একশো দিন আলো জ্বলেছে।',
  },
};

export function glowT(lang) {
  const dict = STRINGS[lang] || STRINGS.en;

  return (key, vars = {}) => {
    const text = dict[key] ?? STRINGS.en[key] ?? key;
    const filled = text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] === undefined ? `{${name}}` : String(vars[name])));

    return lang === 'bn' ? bnDigits(filled) : filled;
  };
}

export function useGlowT() {
  const { lang } = useI18n();

  return useMemo(() => glowT(lang), [lang]);
}
