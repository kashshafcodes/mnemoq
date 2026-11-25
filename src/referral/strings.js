// Invite card and owner-review text, EN and BN (perks spec §3). In-app text
// uses "আপনি"; the message sent to a friend uses "তুমি".
// Bangla is a draft for the owner's native read.

import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { bnDigits } from '../daily/strings';

export const STRINGS = {
  en: {
    'ref.invite.title': 'Give a friend 7 days of Pro',
    'ref.invite.body': 'When your friend plays on 2 different days, you both get 7 days of Pro. Up to 3 friends a month, 10 in total.',
    'ref.invite.fine': 'Pro days are a thank-you, not a purchase. Nothing is sold here.',
    'ref.invite.share': 'Share my link',
    'ref.invite.copy': 'Copy link',
    'ref.invite.copied': 'Link copied.',
    'ref.invite.copyFail': "Couldn't copy. Hold the link to copy it.",
    'ref.invite.loading': 'Getting your link…',
    'ref.invite.error': "Your link didn't load. Check your connection and try again.",
    'ref.invite.retry': 'Try again',
    'ref.invite.count': 'Friends who brought you Pro: {n} of 10',
    'ref.progress.one': 'Your friend has played 1 of 2 days.',
    'ref.progress.named': '{name}: {n} of 2 days',
    'ref.progress.anon': 'A friend: {n} of 2 days',
    'ref.earned.referrer': 'Your friend played on 2 days. You both get 7 days of Pro.',
    'ref.cap.month': "This month's friend limit is reached. Your link still works, and your friend can still play.",
    'ref.cap.total': "You've reached the 10-friend limit. Thank you for sharing Mnemoq.",
    'ref.held': "We're checking this one. You'll hear within a few days.",
    'ref.message.friend': 'I use Mnemoq for a short daily round that turns my mistakes into cards. Play on 2 days and we both get 7 days of Pro: {link}',
  },
  bn: {
    'ref.invite.title': 'বন্ধুকে ৭ দিনের Pro দিন',
    'ref.invite.body': 'আপনার বন্ধু ২টি আলাদা দিনে খেললে দুজনেই ৭ দিনের Pro পাবেন। মাসে সর্বোচ্চ ৩ জন, মোট ১০ জন।',
    'ref.invite.fine': 'Pro দিন ধন্যবাদের উপহার, কেনাকাটা নয়।',
    'ref.invite.share': 'আমার লিংক শেয়ার করুন',
    'ref.invite.copy': 'লিংক কপি করুন',
    'ref.invite.copied': 'লিংক কপি হয়েছে।',
    'ref.invite.copyFail': 'কপি হয়নি। লিংকটি চেপে ধরে কপি করুন।',
    'ref.invite.loading': 'আপনার লিংক আনা হচ্ছে…',
    'ref.invite.error': 'লিংক লোড হয়নি। সংযোগ দেখে আবার চেষ্টা করুন।',
    'ref.invite.retry': 'আবার চেষ্টা করুন',
    'ref.invite.count': 'যে বন্ধুদের জন্য Pro পেয়েছেন: ১০ জনের মধ্যে {n} জন',
    'ref.progress.one': 'আপনার বন্ধু ২ দিনের মধ্যে ১ দিন খেলেছে।',
    'ref.progress.named': '{name}: ২ দিনের মধ্যে {n} দিন',
    'ref.progress.anon': 'একজন বন্ধু: ২ দিনের মধ্যে {n} দিন',
    'ref.earned.referrer': 'আপনার বন্ধু ২ দিন খেলেছে। দুজনেই ৭ দিনের Pro পেলেন।',
    'ref.cap.month': 'এই মাসের বন্ধুর সীমা শেষ। আপনার লিংক ঠিকই কাজ করবে, বন্ধু খেলতেও পারবে।',
    'ref.cap.total': '১০ বন্ধুর সীমায় পৌঁছেছেন। Mnemoq ছড়িয়ে দেওয়ার জন্য ধন্যবাদ।',
    'ref.held': 'এটি আমরা দেখছি। কয়েক দিনের মধ্যে জানতে পারবেন।',
    'ref.message.friend': 'আমি Mnemoq-এ ছোট একটা দৈনিক রাউন্ড খেলি, যেখানে ভুলগুলো কার্ড হয়ে যায়। তুমি ২ দিন খেললে আমরা দুজনেই ৭ দিনের Pro পাব: {link}',
  },
};

export function refT(lang) {
  const dict = STRINGS[lang] || STRINGS.en;

  return (key, vars = {}) => {
    const text = dict[key] ?? STRINGS.en[key] ?? key;
    // The link stays in Latin digits; numbers in Bangla text become Bangla.
    const filled = text.replace(/\{(\w+)\}/g, (_, name) => {
      if (vars[name] === undefined) return `{${name}}`;
      if (name === 'link' || name === 'name') return `\u0000${name}\u0000`;
      return lang === 'bn' ? bnDigits(String(vars[name])) : String(vars[name]);
    });

    return filled.replace(/\u0000(\w+)\u0000/g, (_, name) => String(vars[name]));
  };
}

export function useRefT() {
  const { lang } = useI18n();

  return useMemo(() => refT(lang), [lang]);
}

// The invite link with the account's stored code (fallback codes start with x).
export const inviteLink = (site, refcode) =>
  `${site}/sample?${new URLSearchParams({ utm_source: 'friend', utm_medium: 'invite', utm_campaign: 'invite', utm_content: refcode })}`;
