// Share card and share sheet text, EN and BN (spec phase2-share-card §2, §3,
// §5; perks spec §3). Card lines and messages go to a friend, so the Bangla
// uses "তুমি"; the sheet itself is in-app text and uses "আপনি".
// Bangla is a draft for the owner's native read.

import { bnDigits } from '../daily/strings';

export const STRINGS = {
  en: {
    'card.daily.kicker': 'MNEMOQ DAILY · #{num}',
    'card.daily.line': 'Five lanterns. Can you light more?',
    'card.diag.kicker.sat': 'MY DIGITAL SAT ESTIMATE',
    'card.diag.kicker.other': 'MY {short} READINESS',
    'card.diag.strong': 'Can you beat me?',
    'card.diag.start': 'This is where I start. Where do you?',
    'card.diag.fine.sat': 'Estimate from a Mnemoq practice diagnostic, not an official score.',
    'card.diag.fine.other': 'Estimate from a Mnemoq practice check, not an official result.',
    'card.recap.kicker': 'MY WEEK ON MNEMOQ · {range}',
    'card.recap.daysLit': 'days lit',
    'card.recap.line': 'My week, one small light at a time. Try a round.',
    'card.recap.recalled': 'Cards recalled',
    'card.recap.reviewed': 'Cards reviewed',
    'card.recap.kept': 'Cards kept',
    'card.recap.glow': 'Glow earned',
    'card.recap.of': '{n} of {total}',
    'card.recap.best': 'Best day: {day}',

    'share.daily': 'Mnemoq Daily #{num}: {score}/15. Can you beat it? {link}',
    'share.diag.sat': 'My SAT estimate on Mnemoq: {score}. Free 25-minute check: {link}',
    'share.diag.other': 'My {short} readiness on Mnemoq: {score}/100. Free 20-minute check: {link}',
    'share.recap': '{n} days lit on Mnemoq this week. Try a round, about a minute, no sign-up: {link}',

    'share.title.daily': "Share tonight's lanterns",
    'share.title.diag': 'Challenge your friends',
    'share.title.recap': 'Share my week',
    'share.button.share': 'Share',
    'share.button.save': 'Save image',
    'share.button.copy': 'Copy link',
    'share.button.whatsapp': 'WhatsApp',
    'share.button.close': 'Close',
    'share.lang': 'Card language',
    'share.saved': 'Image saved. Post it to your story and add your link sticker.',
    'share.copied': 'Link copied.',
    'share.drawing': 'Drawing your card…',
    'share.recap.locked': 'Your week appears after 3 days lit. {n} so far.',
    'share.err.image': "Couldn't draw the card. You can still send the link.",
    'share.err.share': "Sharing didn't work here. Save the image or copy the link.",
    'share.offline': 'Your result is saved on this device. Sharing needs a connection.',
    'share.ref': 'Give a friend 7 days of Pro →',
    'share.alt': 'Share card: {summary}',
    'share.diag.body': 'Post your result to your story or send it to your batch. Your friends take the same free check, with no sign-up needed to start.',
    'share.diag.open': 'Share my result',

    'perk.share.earned': '+3 Glow. Thanks for passing the light on.',
    'perk.share.capped': "You've had today's share Glow. Sharing still works.",
  },
  bn: {
    'card.daily.kicker': 'MNEMOQ ডেইলি · #{num}',
    'card.daily.line': 'পাঁচটি লণ্ঠন। তুমি কি আরও বেশি জ্বালাতে পারবে?',
    'card.diag.kicker.sat': 'আমার ডিজিটাল SAT অনুমান',
    'card.diag.kicker.other': 'আমার {short} প্রস্তুতি',
    'card.diag.strong': 'আমাকে হারাতে পারবে?',
    'card.diag.start': 'এখান থেকে আমার শুরু। তুমি কোথা থেকে শুরু করবে?',
    'card.diag.fine.sat': 'Mnemoq-এর প্র্যাকটিস ডায়াগনস্টিক থেকে অনুমান, সরকারি স্কোর নয়।',
    'card.diag.fine.other': 'Mnemoq-এর প্র্যাকটিস চেক থেকে অনুমান, সরকারি ফল নয়।',
    'card.recap.kicker': 'Mnemoq-এ আমার সপ্তাহ · {range}',
    'card.recap.daysLit': 'দিন আলো জ্বলেছে',
    'card.recap.line': 'আমার সপ্তাহ, একটু একটু আলোয়। তুমিও একটা রাউন্ড খেলে দেখো।',
    'card.recap.recalled': 'মনে পড়া কার্ড',
    'card.recap.reviewed': 'রিভিউ করা কার্ড',
    'card.recap.kept': 'মনে থাকা কার্ড',
    'card.recap.glow': 'অর্জিত আভা',
    'card.recap.of': '{total}টির মধ্যে {n}টি',
    'card.recap.best': 'সেরা দিন: {day}',

    'share.daily': 'Mnemoq Daily #{num}: {score}/১৫। তুমি কি এর চেয়ে ভালো করতে পারবে? {link}',
    'share.diag.sat': 'Mnemoq-এ আমার SAT অনুমান: {score}। বিনামূল্যের ২৫ মিনিটের চেক: {link}',
    'share.diag.other': 'Mnemoq-এ আমার {short} প্রস্তুতি: {score}/১০০। বিনামূল্যের ২০ মিনিটের চেক: {link}',
    'share.recap': 'এই সপ্তাহে Mnemoq-এ {n} দিন আলো জ্বলেছে। একটা রাউন্ড খেলে দেখো, প্রায় এক মিনিট, সাইন আপ লাগবে না: {link}',

    'share.title.daily': 'আজকের লণ্ঠন শেয়ার করুন',
    'share.title.diag': 'বন্ধুদের চ্যালেঞ্জ করুন',
    'share.title.recap': 'আমার সপ্তাহ শেয়ার করুন',
    'share.button.share': 'শেয়ার করুন',
    'share.button.save': 'ছবি সেভ করুন',
    'share.button.copy': 'লিংক কপি করুন',
    'share.button.whatsapp': 'WhatsApp',
    'share.button.close': 'বন্ধ করুন',
    'share.lang': 'কার্ডের ভাষা',
    'share.saved': 'ছবি সেভ হয়েছে। স্টোরিতে পোস্ট করে লিংক স্টিকার যোগ করুন।',
    'share.copied': 'লিংক কপি হয়েছে।',
    'share.drawing': 'আপনার কার্ড আঁকা হচ্ছে…',
    'share.recap.locked': '৩ দিন আলো জ্বললেই আপনার সপ্তাহ দেখা যাবে। এখন পর্যন্ত {n}।',
    'share.err.image': 'কার্ডটি আঁকা যায়নি। তবে লিংকটা পাঠাতে পারবেন।',
    'share.err.share': 'এখানে শেয়ার হয়নি। ছবি সেভ করুন বা লিংক কপি করুন।',
    'share.offline': 'আপনার ফল এই ডিভাইসে সেভ আছে। শেয়ার করতে ইন্টারনেট লাগবে।',
    'share.ref': 'বন্ধুকে ৭ দিনের Pro দিন →',
    'share.alt': 'শেয়ার কার্ড: {summary}',
    'share.diag.body': 'আপনার ফল স্টোরিতে দিন বা ব্যাচে পাঠান। বন্ধুরা একই বিনামূল্যের চেক দেবে, শুরু করতে সাইন আপ লাগবে না।',
    'share.diag.open': 'আমার ফল শেয়ার করুন',

    'perk.share.earned': '+৩ আভা। আলোটা ছড়িয়ে দেওয়ার জন্য ধন্যবাদ।',
    'perk.share.capped': 'আজকের শেয়ারের আভা পেয়ে গেছেন। শেয়ার করা আগের মতোই চলবে।',
  },
};

export const num = (lang, value) => (lang === 'bn' ? bnDigits(value) : String(value));

// t(key, vars). Numbers in vars become Bangla digits in Bangla; {link} is left alone.
export function shareT(lang) {
  const dict = STRINGS[lang] || STRINGS.en;

  return (key, vars = {}) =>
    (dict[key] ?? STRINGS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => {
      const value = vars[name];

      if (value === undefined || value === null) return '';
      return name !== 'link' && typeof value === 'number' ? num(lang, value) : String(value);
    });
}
