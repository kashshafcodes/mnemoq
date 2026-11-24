// The sample round (landing page and /sample), in English and Bangla.
// Copy: company/product/sample-round.md section 2, with Growth's final changes
// in company/growth/sample-round-review.md (owner approved 24 Nov 2026).
// "About a minute", never "60 seconds", until sample_finish.ms shows a median
// of about 75 s or less.

export const SAMPLE = {
  en: {
    open: 'Try a sample round',
    openSub: 'Three lanterns, no sign-up',
    s1Jonaki: 'Hi, I’m Jonaki. Let’s light three lanterns.',
    s1Sub: 'Three quick questions, about a minute. No sign-up needed.',
    s1Start: 'Light the first lantern',
    s1HaveAccount: 'I already have an account',
    s2Jonaki: 'Pick an answer. Then show me how sure.',
    s2Right: 'Lit. Jonaki saw that.',
    s2Guess: 'Lit, on a guess. Now you know it.',
    s2Wrong: 'Not this time. I’ll bring it back.',
    s2Bright: 'You were certain, and it was wrong. Once you’ve seen the right answer, it often sticks better.',
    next: 'Next lantern',
    finish: 'See how it went',
    s3Miss: 'That miss? I’ll bring it back for review.',
    s3MissMany: 'Those misses? I’ll bring them back for review.',
    s3Perfect: 'Three for three. Your lantern is glowing.',
    s3What: 'That’s Mnemoq: your mistakes become cards that come back for review before they slip away.',
    saveTitle: 'Keep this light',
    saveTitleNone: 'Today’s misses are tomorrow’s cards',
    saveBody: 'A free account keeps this round, your misses as review cards, and your streak.',
    saveBodyPerfect: 'A free account keeps this round and starts your streak.',
    saveButton: 'Save my progress, free',
    later: 'Later',
    laterNote: 'Without an account, your misses stay on this device for 14 days.',
    laterNotePerfect: 'Without an account, this round stays on this device only.',
    share: 'Send this round to a friend',
    shareText: 'I lit {n} of 3 lanterns on Mnemoq. Can you beat that? About a minute, no sign-up.',
    shareCopied: 'Link copied. Paste it to a friend.',
    close: 'Close',
    lantern: 'Lantern {n} of {total}',
  },
  bn: {
    open: 'একটা নমুনা রাউন্ড খেলে দেখুন',
    openSub: 'তিনটি লণ্ঠন, সাইন আপ ছাড়াই',
    s1Jonaki: 'আমি জোনাকি। চলুন, তিনটি লণ্ঠন জ্বালাই।',
    s1Sub: 'তিনটি ছোট প্রশ্ন, প্রায় এক মিনিট। সাইন আপ লাগবে না।',
    s1Start: 'প্রথম লণ্ঠন জ্বালান',
    s1HaveAccount: 'আমার অ্যাকাউন্ট আছে',
    s2Jonaki: 'উত্তর বাছুন। তারপর দেখান কতটা নিশ্চিত।',
    s2Right: 'জ্বলেছে। জোনাকি দেখেছে।',
    s2Guess: 'জ্বলেছে, আন্দাজেই। এবার জেনে গেলেন।',
    s2Wrong: 'এবার হলো না। এটা আমি আবার ফিরিয়ে আনব।',
    s2Bright: 'নিশ্চিত ছিলেন, তবু ভুল। সঠিক উত্তরটা দেখে নিলে সেটা প্রায়ই বেশি মনে থাকে।',
    next: 'পরের লণ্ঠন',
    finish: 'ফলাফল দেখুন',
    s3Miss: 'ওই ভুলটা? রিভিউয়ের জন্য আমি আবার ফিরিয়ে আনব।',
    s3MissMany: 'ওই ভুলগুলো? রিভিউয়ের জন্য আমি আবার ফিরিয়ে আনব।',
    s3Perfect: 'তিনে তিন। আপনার লণ্ঠন জ্বলজ্বল করছে।',
    s3What: 'এটাই Mnemoq: আপনার ভুলগুলো কার্ড হয়ে যায়, আর হারিয়ে যাওয়ার আগেই রিভিউয়ের জন্য ফিরে আসে।',
    saveTitle: 'আলোটা রেখে দিন',
    saveTitleNone: 'আজকের ভুল, কালকের কার্ড',
    // "ধারা" is the app's word for streak (daily/strings.js), as Growth asked.
    saveBody: 'একটা বিনামূল্যের অ্যাকাউন্টে এই রাউন্ড, ভুলগুলোর রিভিউ কার্ড আর আপনার ধারা জমা থাকবে।',
    saveBodyPerfect: 'একটা বিনামূল্যের অ্যাকাউন্টে এই রাউন্ড আর আপনার ধারা জমা থাকবে।',
    saveButton: 'বিনামূল্যে সেভ করুন',
    later: 'পরে করব',
    laterNote: 'অ্যাকাউন্ট ছাড়া আপনার ভুলগুলো এই ডিভাইসে ১৪ দিন থাকবে।',
    laterNotePerfect: 'অ্যাকাউন্ট ছাড়া এই রাউন্ড শুধু এই ডিভাইসেই থাকবে।',
    share: 'বন্ধুকে পাঠান',
    shareText: 'Mnemoq-এ আমি তিনটির মধ্যে {n}টি লণ্ঠন জ্বালিয়েছি। তুমি পারবে? প্রায় এক মিনিট, সাইন আপ লাগবে না।',
    shareCopied: 'লিংক কপি হয়েছে। বন্ধুকে পেস্ট করে পাঠান।',
    close: 'বন্ধ করুন',
    lantern: 'লণ্ঠন {n} / {total}',
  },
};

// The save prompt and Jonaki's line on screen 3 depend on how many were right.
export function resultKeys(right, total) {
  const misses = total - right;

  return {
    line: misses === 0 ? 's3Perfect' : misses === 1 ? 's3Miss' : 's3MissMany',
    title: right === 0 ? 'saveTitleNone' : 'saveTitle',
    body: misses === 0 ? 'saveBodyPerfect' : 'saveBody',
    note: misses === 0 ? 'laterNotePerfect' : 'laterNote',
  };
}

// The link a friend opens: straight to screen 1, credited to the share.
export function shareUrl(origin) {
  return `${origin}/sample?utm_source=friend&utm_medium=sample_result&utm_campaign=sample_share`;
}

// Opened through the /sample deep link (vercel.json rewrite, main.jsx route).
export function isSampleLink() {
  return typeof window !== 'undefined' && /^\/sample\/?$/i.test(window.location.pathname);
}
