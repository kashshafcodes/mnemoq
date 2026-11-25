import { useI18n } from '../i18n';

// Text for the Sound card on Me, in English and Bangla (spec phase2-sensory
// section 5; the Bangla is best-effort and needs a native read).
export const STRINGS = {
  en: {
    'sound.title': 'Sound',
    'sound.body': 'Soft bells for right answers and finished rounds.',
    'sound.music': 'Music',
    'sound.musicBody': 'A quiet night-river tune while you play.',
  },
  bn: {
    'sound.title': 'শব্দ',
    'sound.body': 'সঠিক উত্তর আর শেষ করা রাউন্ডে নরম ঘণ্টার শব্দ।',
    'sound.music': 'সুর',
    'sound.musicBody': 'খেলার সময় রাতের নদীর শান্ত সুর।',
  },
};

export function useSensoryT() {
  const { lang } = useI18n();
  const dict = STRINGS[lang] || STRINGS.en;

  return (key) => dict[key] ?? STRINGS.en[key] ?? key;
}
