import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { bnDigits } from '../loop/strings';
import { glowT } from '../glow/strings';

// The Memory map, in English and Bangla (spec phase2-glow-memory-map §6 and
// app-copy-phase1 §6). Glow and streak keys come from src/glow/strings.js.
// In-app Bangla uses আপনি and Bangla digits; all Bangla is a draft for the
// owner's native read. Jonaki lines stay at 10 words or fewer.
export const STRINGS = {
  en: {
    'mm.title': 'Memory map',
    'mm.n': '{n}',
    'mm.play': 'Play today’s round',
    'mm.ready.title': 'Am I ready?',
    'mm.ready.estimate': 'An estimate from your check and your reviews, not a promise.',
    'mm.ready.noPath': 'Pick your exam and I’ll show where you stand.',
    'mm.ready.noCheck': 'Take the free check to find out.',
    'mm.ready.pick': 'Pick your exam',
    'mm.ready.check': 'Take the free check',
    'mm.ready.drill': 'Drill {skill}',
    'mm.ready.score': '{score} / target {target}',
    'mm.ready.days': '{n} days left',
    'mm.ready.weakest': 'Weakest: {skill}',
    'mm.band.ready': 'On target',
    'mm.band.close': 'Close to target',
    'mm.band.building': 'Building up',
    'mm.band.early': 'Early days',
    'mm.band.unmeasured': 'Not measured yet',
    'mm.kept.title': 'Kept',
    'mm.kept.of': '{n} of {total} cards',
    'mm.kept.hint': 'Kept means you recalled it after a gap of 4 days or more.',
    'mm.stage.new': 'New',
    'mm.stage.learning': 'Learning',
    'mm.stage.strong': 'Getting strong',
    'mm.stage.mastered': 'Mastered',
    'mm.skills.title': 'Skills',
    'mm.skills.notEnough': 'Not enough yet',
    'mm.details': 'Details',
    'mm.empty.streak': 'Your first lit day starts here.',
    'mm.err.history': 'Couldn’t load your history. Your cards are safe.',
    'mm.retry': 'Try again',
    'empty.progress.title': 'Your progress will glow here.',
    'empty.progress.body': 'Save a few cards or play the Daily, and this starts filling in.',
    'offline.short': 'Offline',
    'feel.map.empty': 'Your first light is waiting.',
    'feel.map.lit': 'Lit today. That one stays.',
    'feel.map.atRisk': 'One card tonight keeps us lit.',
    'feel.map.rest': 'Resting is allowed. The light holds.',
    'feel.map.idle': 'Every card you keep glows here.',
  },
  bn: {
    'mm.title': 'স্মৃতির মানচিত্র',
    'mm.n': '{n}',
    'mm.play': 'আজকের রাউন্ড খেলুন',
    'mm.ready.title': 'আমি কি তৈরি?',
    'mm.ready.estimate': 'আপনার চেক আর রিভিউ থেকে একটা অনুমান, কোনো প্রতিশ্রুতি নয়।',
    'mm.ready.noPath': 'পরীক্ষা বেছে নিন, আমি দেখিয়ে দেব আপনি কোথায় আছেন।',
    'mm.ready.noCheck': 'জানতে বিনামূল্যের চেকটি দিন।',
    'mm.ready.pick': 'পরীক্ষা বেছে নিন',
    'mm.ready.check': 'বিনামূল্যের চেক দিন',
    'mm.ready.drill': '{skill} অনুশীলন করুন',
    'mm.ready.score': '{score} / লক্ষ্য {target}',
    'mm.ready.days': 'আর {n} দিন বাকি',
    'mm.ready.weakest': 'সবচেয়ে দুর্বল: {skill}',
    'mm.band.ready': 'লক্ষ্যে পৌঁছেছেন',
    'mm.band.close': 'লক্ষ্যের কাছাকাছি',
    'mm.band.building': 'এগোচ্ছেন',
    'mm.band.early': 'শুরুর দিকে',
    'mm.band.unmeasured': 'এখনও মাপা হয়নি',
    'mm.kept.title': 'মনে থাকা কার্ড',
    'mm.kept.of': '{total}টির মধ্যে {n}টি',
    'mm.kept.hint': 'মনে থাকা মানে চার দিন বা তার বেশি বিরতির পরেও মনে পড়েছে।',
    'mm.stage.new': 'নতুন',
    'mm.stage.learning': 'শিখছেন',
    'mm.stage.strong': 'পোক্ত হচ্ছে',
    'mm.stage.mastered': 'আয়ত্তে',
    'mm.skills.title': 'দক্ষতা',
    'mm.skills.notEnough': 'এখনও যথেষ্ট তথ্য নেই',
    'mm.details': 'বিস্তারিত',
    'mm.empty.streak': 'আপনার প্রথম আলো-জ্বালা দিনটা এখান থেকেই শুরু।',
    'mm.err.history': 'ইতিহাস লোড হয়নি। আপনার কার্ড নিরাপদ আছে।',
    'mm.retry': 'আবার চেষ্টা করুন',
    'empty.progress.title': 'আপনার অগ্রগতি এখানে আলো হয়ে দেখা দেবে।',
    'empty.progress.body': 'কয়েকটি কার্ড রাখুন বা ডেইলি খেলুন, তাহলেই এখানে ভরতে শুরু করবে।',
    'offline.short': 'অফলাইন',
    'feel.map.empty': 'আপনার প্রথম আলো অপেক্ষা করছে।',
    'feel.map.lit': 'আজ আলো জ্বলেছে। এটা থাকবে।',
    'feel.map.atRisk': 'আজ রাতে একটা কার্ড, আলো জ্বলে থাকবে।',
    'feel.map.rest': 'বিশ্রাম নেওয়া যায়। আলো জ্বলে আছে।',
    'feel.map.idle': 'যে কার্ড মনে থাকে, সেটাই এখানে জ্বলে।',
  },
};

export function mapT(lang) {
  const dict = STRINGS[lang] || STRINGS.en;
  const glow = glowT(lang);

  return (key, vars = {}) => {
    const text = dict[key] ?? STRINGS.en[key];

    if (text === undefined) return glow(key, vars);

    const filled = text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] === undefined ? `{${name}}` : String(vars[name])));

    return lang === 'bn' ? bnDigits(filled) : filled;
  };
}

export function useMapT() {
  const { lang } = useI18n();

  return useMemo(() => mapT(lang), [lang]);
}
