// Install card, iPhone guide and offline banner, in English and Bangla.
// Copy: company/marketing/app-copy-phase1.md (sections 2 and 6, offline).

export const INSTALL_STRINGS = {
  en: {
    androidTitle: 'Keep Mnemoq on your home screen',
    androidBody: 'Opens in one tap, like an app. No Play Store, no big download.',
    androidBodyOffline: 'Opens in one tap, and today’s Daily works even without internet.',
    install: 'Install',
    notNow: 'Not now',
    done: 'Done. Look for the Mnemoq icon.',
    jonaki: 'I’ll be one tap away.',
    iosTitle: 'Put Mnemoq on your iPhone',
    iosIntro: 'Three taps in Safari.',
    iosStep1: 'Tap **Share**, the square with an arrow, in Safari’s toolbar.',
    iosStep2: 'Scroll down and tap **Add to Home Screen**.',
    iosStep3: 'Open Mnemoq from the new icon, not from Safari.',
    iosWhy: 'On iPhone, reminders only work when Mnemoq is opened from the icon.',
    iosClose: 'Got it',
    offline: 'You’re offline. Today’s Daily still plays. Reviews, saving cards and sign-in need a connection.',
    offlineNoDaily: 'You’re offline. Mnemoq needs a connection for this. Today’s Daily will be saved for offline play next time you’re online.',
    back: 'Back online.',
    close: 'Close',
  },
  bn: {
    androidTitle: 'Mnemoq রাখুন হোম স্ক্রিনে',
    androidBody: 'অ্যাপের মতো এক ট্যাপেই খুলবে। প্লে স্টোর লাগবে না, বড় ডাউনলোডও না।',
    androidBodyOffline: 'এক ট্যাপেই খুলবে, আর আজকের ডেইলি ইন্টারনেট ছাড়াও খেলা যাবে।',
    install: 'ইনস্টল করুন',
    notNow: 'এখন না',
    done: 'হয়ে গেছে। হোম স্ক্রিনে Mnemoq আইকনটি দেখুন।',
    jonaki: 'এক ট্যাপ দূরেই থাকব।',
    iosTitle: 'আইফোনে Mnemoq রাখুন',
    iosIntro: 'Safari-তে তিনটি ট্যাপ।',
    iosStep1: 'Safari-র নিচের বারে **Share** চাপুন (তীরচিহ্নসহ চৌকো ঘরটি)।',
    iosStep2: 'একটু নিচে স্ক্রল করে **Add to Home Screen** চাপুন।',
    iosStep3: 'এরপর Safari থেকে নয়, নতুন আইকন থেকে Mnemoq খুলুন।',
    iosWhy: 'আইফোনে রিমাইন্ডার কাজ করে শুধু আইকন থেকে Mnemoq খুললে।',
    iosClose: 'বুঝেছি',
    offline: 'আপনি অফলাইনে। আজকের ডেইলি খেলা যাবে। রিভিউ, কার্ড সেভ আর সাইন ইনের জন্য ইন্টারনেট লাগবে।',
    offlineNoDaily: 'আপনি অফলাইনে। এর জন্য ইন্টারনেট লাগবে। পরের বার অনলাইনে এলে আজকের ডেইলি অফলাইনে খেলার জন্য রেখে দেওয়া হবে।',
    back: 'আবার অনলাইনে।',
    close: 'বন্ধ করুন',
  },
};

export const installText = (lang) => INSTALL_STRINGS[lang] || INSTALL_STRINGS.en;
