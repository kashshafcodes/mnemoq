import { withShuffledOptions } from '../daily/puzzle';

// The three sample-round questions, played before sign-up. They are not in the
// Daily pool (ids start "smp-"), so nothing a player meets later is spoiled.
// The arc: an easy win, a confident trap, then a fact worth telling a friend.
// Spec and sources: company/product/sample-round.md section 1 (checked 24 Nov
// 2026: Bangladesh Bank, Merriam-Webster, Britannica, CIA World Factbook).
// As in the Daily pool, the right answer is listed first; the options are then
// shown in the Daily's fixed seeded order.

const q = (id, category, level, en, bn) => ({ id, category, level, en, bn });

const RAW = [
  q('smp-taka', 'bangladesh', 1,
    { q: 'What is the currency of Bangladesh?', options: ['Taka (৳)', 'Rupee', 'Ringgit', 'Dinar'], why: 'The taka replaced the Pakistani rupee in 1972. One taka is 100 poisha, and a lakh is ৳1,00,000.' },
    { q: 'বাংলাদেশের মুদ্রার নাম কী?', options: ['টাকা (৳)', 'রুপি', 'রিঙ্গিত', 'দিনার'], why: '১৯৭২ সালে টাকা পাকিস্তানি রুপির জায়গা নেয়। এক টাকায় ১০০ পয়সা, আর এক লাখ মানে ৳১,০০,০০০।' }),

  q('smp-enervate', 'words', 2,
    { q: 'What does the word "enervate" mean?', options: ['To weaken', 'To energize', 'To irritate', 'To praise'], why: 'It looks like "energy" but means the opposite. It comes from Latin for "to remove the sinews". Example: the long, enervating heat left everyone drained.' },
    { q: '"Enervate" শব্দের অর্থ কী?', options: ['দুর্বল করে দেওয়া', 'চাঙ্গা করে তোলা', 'বিরক্ত করা', 'প্রশংসা করা'], why: 'দেখতে energy-র মতো, কিন্তু মানে উল্টো। ল্যাটিন শব্দটির আক্ষরিক অর্থ প্রায় "পেশির বাঁধন কেটে দেওয়া"। যেমন: The long, enervating heat left everyone drained।' }),

  q('smp-nepal-flag', 'world', 2,
    { q: 'Every national flag is a rectangle or a square, except one. Whose?', options: ['Nepal', 'Switzerland', 'Bhutan', 'Sri Lanka'], why: 'Nepal’s flag is two pennants stacked one above the other. Its shape and exact construction are written into Nepal’s 2015 constitution.' },
    { q: 'সব দেশের জাতীয় পতাকা আয়তাকার বা বর্গাকার, শুধু একটি ছাড়া। সেটি কোন দেশের?', options: ['নেপাল', 'সুইজারল্যান্ড', 'ভুটান', 'শ্রীলঙ্কা'], why: 'নেপালের পতাকা একটার ওপর আরেকটা বসানো দুটি ত্রিভুজাকার নিশান। এর আকার আর মাপ নেপালের ২০১৫ সালের সংবিধানেই লেখা আছে।' }),
];

// As listed (right answer first), for tests.
export const SAMPLE_RAW = RAW;

// Ready to play: options shuffled, `answer` is the right option's index.
export const SAMPLE_QUESTIONS = RAW.map(withShuffledOptions);
