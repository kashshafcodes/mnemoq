// Tiny translation layer. English is the default; Bangla is an option.
// The choice is remembered on this device.
//
// Use:  const { t, lang, setLang, locale } = useI18n();   t('key', { n: 3 })
// Anything without a Bangla entry falls back to English, so screens that
// are not translated yet keep working.

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const LANG_KEY = 'mnemoq-lang';

const en = {
  // shared
  'lang.english': 'English',
  'lang.bangla': 'বাংলা',
  'lang.label': 'Language',

  // sign in
  'auth.signupTitle': 'Create your account',
  'auth.loginTitle': 'Welcome back',
  'auth.tagline': 'Build stronger recall, one mistake at a time.',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.wait': 'Please wait...',
  'auth.createBtn': 'Create account',
  'auth.loginBtn': 'Log in',
  'auth.haveAccount': 'Already have an account? Log in',
  'auth.noAccount': "Don't have an account? Sign up",

  // sidebar + top bar
  'nav.workspace': 'WORKSPACE',
  'nav.profile': 'Profile',
  'nav.home': 'Home',
  'nav.add': 'Add cards',
  'nav.dashboard': 'Dashboard',
  'nav.library': 'My library',
  'nav.review': 'Review cards',
  'nav.how': 'How it works',
  'nav.debrief': 'Exam Debrief',
  'nav.logout': 'Log out',
  'side.line1': 'Small improvements.',
  'side.line2': 'Lasting knowledge.',
  'top.eyebrow': 'YOUR LEARNING SPACE',
  'top.title': 'Good to see you.',
  'top.subtitle': "Turn today's mistakes into tomorrow's strengths.",

  // pilot: common
  'pilot.skip': "Skip, I'll explore myself",
  'pilot.back': 'Back',
  'pilot.next': 'Continue',
  'pilot.step': 'Step {n} of {total}',

  // pilot: story
  'pilot.story.eyebrow': 'WELCOME TO MNEMOQ',
  'pilot.story.title': 'Just got an exam back? Make sure you never lose those marks again.',
  'pilot.story.sub': 'In about 3 minutes you will turn your own mistakes into a plan that makes them stick. Why are you here?',
  'pilot.story.exam': 'I just got an exam back',
  'pilot.story.examHint': 'Turn my wrong answers into a recovery plan',
  'pilot.story.upcoming': 'I have an exam coming',
  'pilot.story.upcomingHint': 'Tell us the topic and AI writes your practice questions',
  'pilot.story.learn': 'I want to remember what I learn',
  'pilot.story.learnHint': 'Add cards your own way',

  // pilot: curve
  'pilot.curve.title': 'Why we forget, and how to stop it',
  'pilot.curve.sub': 'Watch what happens to a memory over two weeks. Then try it yourself.',
  'pilot.curve.day': 'Day {n}',
  'pilot.curve.slider': 'Move through time',
  'pilot.curve.review': 'Review now',
  'pilot.curve.reset': 'Start over',
  'pilot.curve.noReview': 'Never reviewed',
  'pilot.curve.withReview': 'With your reviews',
  'pilot.curve.axisY': 'Remembered',
  'pilot.curve.axisX': 'Days',
  'pilot.curve.reviews': 'Reviews so far: {n}',
  'pilot.curve.note': 'A simple picture of the idea, not your real data.',
  'pilot.curve.demo': 'Demo',
  'pilot.curve.s1': 'You learn something new. Memory: 100%.',
  'pilot.curve.s2': 'Without a review, memory fades fast. The grey line shows it.',
  'pilot.curve.s3': 'Review just before you forget: memory jumps back up, and the next fade is slower.',
  'pilot.curve.s4': 'Each review lets you wait longer before the next one. This is spaced repetition.',
  'pilot.curve.s5': 'Day 14: {with}% remembered with reviews, only {without}% without. Mnemoq schedules these reviews for you.',
  'pilot.curve.skip': 'Skip the demo',
  'pilot.curve.replay': 'Watch again',
  'pilot.curve.tryIt': 'Try it yourself',
  'pilot.curve.play1': 'Your turn! Time is moving. Tap Review whenever you like and watch the green line.',
  'pilot.curve.playNudge': 'Memory is fading. Good moment to review!',
  'pilot.curve.paused': 'Paused. Press Resume to continue.',
  'pilot.curve.pause': 'Pause',
  'pilot.curve.resume': 'Resume',
  'pilot.curve.endedNone': 'Day 14 with no reviews: only {without}% left. Press Start over and tap Review a few times.',
  'pilot.curve.endedSome': 'Day 14: {with}% remembered with {n} reviews, against {without}% with none.',
  'pilot.curve.endedOne': 'Day 14: {with}% remembered with 1 review, against {without}% with none.',
  'pilot.curve.introWho': 'In 1885, a scientist named Hermann Ebbinghaus tested his own memory. He found that we forget new things fast at first, then more slowly. This is called the Ebbinghaus forgetting curve.',
  'pilot.curve.introFix': 'The fix is simple: review just before you forget. Each review makes the memory last longer, so you can wait longer before the next one. This is called spaced repetition, and it is how you remember better with less effort.',
  'pilot.curve.introGo': 'Show me, it takes about 40 seconds',
  'pilot.curve.d1': 'Say you learn something new today. Your memory of it starts at 100%.',
  'pilot.curve.d2': 'Now time passes, and we start to forget. Fast.',
  'pilot.curve.d3': 'After just 1 day, about half is already gone. This is the forgetting curve.',
  'pilot.curve.d4': 'So we review it just before it fades away. Memory jumps back up.',
  'pilot.curve.d5': 'This time it fades more slowly.',
  'pilot.curve.d6': 'Review again, just in time. It fades even slower now, so we can wait longer.',
  'pilot.curve.d7': 'The gaps keep growing.',
  'pilot.curve.d8': 'Third review, 4 days later. Gaps of 1, 2 and 4 days: this is spaced repetition.',
  'pilot.curve.d9': 'Now watch two weeks go by.',
  'pilot.curve.cta': 'Got it, let me add my mistakes',

  // pilot: log
  'pilot.log.title': 'Log 3 to 5 questions you got wrong',
  'pilot.log.sub': 'Pick the subject once. Then just type each mistake. Only the question and the correct answer are needed.',
  'pilot.log.counter': '{n} of 5 added',
  'pilot.log.subject': 'Subject',
  'pilot.log.category': 'Category',
  'pilot.log.question': 'Question',
  'pilot.log.questionPh': 'What did the exam ask?',
  'pilot.log.correct': 'Correct answer',
  'pilot.log.correctPh': 'What is the right answer?',
  'pilot.log.wrong': 'What you answered (optional)',
  'pilot.log.wrongPh': 'Your wrong answer',
  'pilot.log.hook': 'Memory hook (optional)',
  'pilot.log.hookPh': 'A trick, picture or short reason that helps it stick',
  'pilot.log.add': 'Add this mistake',
  'pilot.log.saving': 'Saving...',
  'pilot.log.need': 'Add at least 3 to continue.',
  'pilot.log.done': 'Done adding, continue',
  'pilot.log.added': 'Added so far',
  'pilot.log.required': 'Please fill in the question and the correct answer.',
  'pilot.log.max': "That's 5, a great start. Let's try recalling one.",

  // pilot: recall
  'pilot.recall.title': 'Your first win',
  'pilot.recall.sub': 'You saw the answer a minute ago. Can you pull it back from memory?',
  'pilot.recall.placeholder': 'Type your answer',
  'pilot.recall.check': 'Check',
  'pilot.recall.correct': 'Correct!',
  'pilot.recall.close': 'Correct! (just watch the spelling)',
  'pilot.recall.wrong': 'Not yet. This is exactly why the plan brings it back.',
  'pilot.recall.answerWas': 'The answer: {a}',
  'pilot.recall.retry': 'Try again',
  'pilot.recall.badge': 'Badge unlocked: First recall',
  'pilot.recall.cta': 'Show me my Recovery Plan',
  'pilot.recall.skip': 'Skip this',

  // pilot: plan
  'pilot.plan.title': 'Your Recovery Plan',
  'pilot.plan.sub': 'By {date}, these {n} mistakes can be locked in. Come back at each checkpoint.',
  'pilot.plan.today': 'Today',
  'pilot.plan.d1': 'Day 1',
  'pilot.plan.d3': 'Day 3',
  'pilot.plan.d7': 'Day 7',
  'pilot.plan.d14': 'Day 14',
  'pilot.plan.note': 'The dates are targets. Mnemoq spaces each card by how well you recall it.',
  'pilot.plan.cta': 'Go to my dashboard',
  'pilot.plan.review': 'Review them now',

  // pilot: exam coming path
  'pilot.up.topics': 'Weak topics',
  'pilot.up.date': 'Exam date (optional)',
  'pilot.up.title': 'Which topics worry you most?',
  'pilot.up.sub': 'Pick the topics you find hard. We will hand you a starter set to begin with.',
  'pilot.up.dateHint': 'We will plan your reviews so they finish before it.',
  'pilot.up.need': 'Pick at least one topic.',
  'pilot.up.cta': 'Show my starter set',

  'pilot.starter.title': 'Your starter set',
  'pilot.starter.sub': 'Hand-checked questions for your topics. Untick any you already know.',
  'pilot.starter.selected': '{n} of {max} selected',
  'pilot.starter.add': 'Add {n} cards',
  'pilot.starter.adding': 'Adding {done} of {n}...',
  'pilot.starter.none': 'Select at least one card.',
  'pilot.starter.max': 'You can add up to {max} cards to start.',
  'pilot.plan.final': 'Final review',
  'pilot.plan.exam': 'Exam day',
  'pilot.plan.subExam': 'Your exam is in {days} days. Come back at each checkpoint.',
  'pilot.plan.subExamToday': 'Your exam is today. One quick review now is the best use of the time.',

  // pilot: AI ask step
  'pilot.ai.title': 'Tell us exactly what to practise',
  'pilot.ai.sub': 'Name the subject and the topic. Our AI writes questions on exactly that, with a memory hook for each.',
  'pilot.ai.subject': 'Subject',
  'pilot.ai.subjectPh': 'e.g. Biology',
  'pilot.ai.topic': 'Topic',
  'pilot.ai.topicPh': 'e.g. Human heart and blood circulation',
  'pilot.ai.notes': 'Anything else? (optional)',
  'pilot.ai.notesPh': 'e.g. Medical admission test, focus on definitions and numbers',
  'pilot.ai.count': 'How many questions',
  'pilot.ai.generate': 'Write my questions',
  'pilot.ai.writing': 'Writing your questions...',
  'pilot.ai.writingHint': 'This usually takes 10 to 25 seconds, because every answer is double-checked.',
  'pilot.ai.need': 'Add a subject and a topic of at least 3 letters.',
  'pilot.ai.ready': 'Or pick from ready-made topics instead',
  'pilot.ai.limitNote': 'The AI can fail or be busy. If so, ready-made topics are always available.',
  'pilot.ai.fallback': 'Use ready-made topics instead',
  'pilot.ai.retry': 'Try again',
  'pilot.ai.step1': 'Choosing the key ideas in your topic...',
  'pilot.ai.step2': 'Writing your questions...',
  'pilot.ai.step3': 'Double-checking every answer...',
  'pilot.ai.reserved': 'Please choose a different subject name.',
  'pilot.aiset.verified': 'A second AI pass re-solved every question and removed the ones it was not sure about. AI can still be wrong, so skim them before you rely on them.',
  'pilot.aiset.unverified': 'AI draft. The second check could not run this time, so read each answer carefully before you add.',
  'pilot.aiset.fewer': 'You asked for {asked}. {got} passed the check.',
  'pilot.aiset.left': '{n} AI uses left today',
  'pilot.aiset.adding': 'Adding {done} of {n}...',
  'pilot.aiset.add': 'Add {n} cards',
  'pilot.aiset.title': 'Your questions on {topic}',
  'pilot.aiset.sub': 'Check them before you add. Untick any that look wrong or that you already know. AI can make mistakes.',
  'pilot.aiset.answer': 'Answer',
  'pilot.aiset.hook': 'Memory hook',
  'pilot.aiset.options': 'Wrong options',
  'pilot.aiset.more': 'Write a different set',
  'pilot.aiset.back': 'Change the topic',
  'pilot.aiset.chosen': '{n} of {total} selected',

  // recovery plan card (dashboard)
  'plan.eyebrow': 'RECOVERY PLAN',
  'plan.title': '{k} of {n} locked in',
  'plan.sub': 'Locked in means a 7-day gap or longer, or marked mastered.',
  'plan.checkpoint': 'Checkpoints',
  'plan.hide': 'Hide',
  'plan.reviewDue': 'Review due cards',
  'plan.complete': 'All {n} locked in. Well done!',
};

const bn = {
  'lang.label': 'ভাষা',

  'auth.signupTitle': 'আপনার অ্যাকাউন্ট তৈরি করুন',
  'auth.loginTitle': 'আবার স্বাগতম',
  'auth.tagline': 'প্রতিটি ভুল থেকে শিখে স্মরণশক্তি আরও মজবুত করুন।',
  'auth.email': 'ইমেইল',
  'auth.password': 'পাসওয়ার্ড',
  'auth.wait': 'অপেক্ষা করুন...',
  'auth.createBtn': 'অ্যাকাউন্ট তৈরি করুন',
  'auth.loginBtn': 'লগ ইন',
  'auth.haveAccount': 'আগে থেকেই অ্যাকাউন্ট আছে? লগ ইন করুন',
  'auth.noAccount': 'অ্যাকাউন্ট নেই? সাইন আপ করুন',

  'nav.workspace': 'ওয়ার্কস্পেস',
  'nav.profile': 'প্রোফাইল',
  'nav.home': 'হোম',
  'nav.add': 'কার্ড যোগ করুন',
  'nav.dashboard': 'ড্যাশবোর্ড',
  'nav.library': 'আমার লাইব্রেরি',
  'nav.review': 'কার্ড রিভিউ',
  'nav.how': 'কীভাবে কাজ করে',
  'nav.debrief': 'পরীক্ষা বিশ্লেষণ',
  'nav.logout': 'লগ আউট',
  'side.line1': 'ছোট ছোট উন্নতি।',
  'side.line2': 'দীর্ঘস্থায়ী জ্ঞান।',
  'top.eyebrow': 'আপনার শেখার জায়গা',
  'top.title': 'আপনাকে দেখে ভালো লাগল।',
  'top.subtitle': 'আজকের ভুলকে আগামীকালের শক্তিতে বদলে ফেলুন।',

  'pilot.skip': 'বাদ দিন, আমি নিজেই দেখে নেব',
  'pilot.back': 'পেছনে',
  'pilot.next': 'চালিয়ে যান',
  'pilot.step': 'ধাপ {n} / {total}',

  'pilot.story.eyebrow': 'মেমনিকে স্বাগতম',
  'pilot.story.title': 'পরীক্ষার খাতা হাতে পেয়েছেন? এই নম্বরগুলো যেন আর না হারায়, সেটা নিশ্চিত করি।',
  'pilot.story.sub': 'প্রায় ৩ মিনিটে আপনার নিজের ভুলগুলো দিয়েই একটি পরিকল্পনা তৈরি হবে, যাতে সেগুলো মনে থাকে। আপনি কেন এসেছেন?',
  'pilot.story.exam': 'আমি এইমাত্র পরীক্ষার ফল পেয়েছি',
  'pilot.story.examHint': 'ভুল উত্তরগুলো দিয়ে রিকভারি প্ল্যান বানান',
  'pilot.story.upcoming': 'আমার পরীক্ষা আসছে',
  'pilot.story.upcomingHint': 'টপিক বলুন, এআই আপনার অনুশীলনের প্রশ্ন লিখে দেবে',
  'pilot.story.learn': 'আমি যা শিখি তা মনে রাখতে চাই',
  'pilot.story.learnHint': 'নিজের মতো করে কার্ড যোগ করুন',

  'pilot.curve.title': 'আমরা কেন ভুলে যাই, আর কীভাবে ঠেকানো যায়',
  'pilot.curve.sub': 'দুই সপ্তাহে একটি স্মৃতির কী হয়, তা দেখুন। তারপর নিজে চেষ্টা করুন।',
  'pilot.curve.day': 'দিন {n}',
  'pilot.curve.slider': 'সময় এগিয়ে নিন',
  'pilot.curve.review': 'এখন রিভিউ করুন',
  'pilot.curve.reset': 'আবার শুরু',
  'pilot.curve.noReview': 'কখনও রিভিউ না করলে',
  'pilot.curve.withReview': 'আপনার রিভিউসহ',
  'pilot.curve.axisY': 'মনে আছে',
  'pilot.curve.axisX': 'দিন',
  'pilot.curve.reviews': 'এ পর্যন্ত রিভিউ: {n}',
  'pilot.curve.note': 'ধারণাটি বোঝানোর একটি সহজ ছবি, আপনার আসল তথ্য নয়।',
  'pilot.curve.demo': 'ডেমো',
  'pilot.curve.s1': 'আপনি নতুন কিছু শিখলেন। স্মৃতি: ১০০%।',
  'pilot.curve.s2': 'রিভিউ না করলে স্মৃতি দ্রুত ম্লান হয়। ধূসর রেখাটি সেটাই দেখাচ্ছে।',
  'pilot.curve.s3': 'ভুলে যাওয়ার ঠিক আগে রিভিউ করুন: স্মৃতি আবার উপরে ওঠে, আর পরের বার ম্লান হয় ধীরে।',
  'pilot.curve.s4': 'প্রতিটি রিভিউয়ের পর পরেরটির জন্য আরও বেশি অপেক্ষা করা যায়। একেই বলে স্পেসড রিপিটিশন।',
  'pilot.curve.s5': 'দিন ১৪: রিভিউসহ {with}% মনে আছে, রিভিউ ছাড়া মাত্র {without}%। এই রিভিউগুলোর সময় মেমনিক ঠিক করে দেয়।',
  'pilot.curve.skip': 'ডেমো বাদ দিন',
  'pilot.curve.replay': 'আবার দেখুন',
  'pilot.curve.tryIt': 'নিজে চেষ্টা করুন',
  'pilot.curve.play1': 'এবার আপনার পালা! সময় চলছে। যখন ইচ্ছা রিভিউ চাপুন আর সবুজ রেখাটি দেখুন।',
  'pilot.curve.playNudge': 'স্মৃতি ম্লান হচ্ছে। রিভিউ করার ভালো সময়!',
  'pilot.curve.paused': 'থামানো আছে। চালিয়ে যেতে "আবার চালু" চাপুন।',
  'pilot.curve.pause': 'থামান',
  'pilot.curve.resume': 'আবার চালু',
  'pilot.curve.endedNone': 'দিন ১৪, কোনো রিভিউ ছাড়া: মাত্র {without}% বাকি। "আবার শুরু" চেপে কয়েকবার রিভিউ চাপুন।',
  'pilot.curve.endedSome': 'দিন ১৪: {n}টি রিভিউসহ {with}% মনে আছে, রিভিউ ছাড়া {without}%।',
  'pilot.curve.endedOne': 'দিন ১৪: ১টি রিভিউসহ {with}% মনে আছে, রিভিউ ছাড়া {without}%।',
  'pilot.curve.introWho': '১৮৮৫ সালে হারম্যান এবিংহাউস নামের একজন বিজ্ঞানী নিজের স্মৃতি পরীক্ষা করেছিলেন। তিনি দেখলেন, নতুন কিছু শেখার পর আমরা প্রথমে খুব দ্রুত ভুলে যাই, তারপর ধীরে ধীরে। একে বলা হয় এবিংহাউসের ভুলে যাওয়ার বক্ররেখা (forgetting curve)।',
  'pilot.curve.introFix': 'সমাধান সহজ: ভুলে যাওয়ার ঠিক আগে একবার রিভিউ করুন। প্রতিটি রিভিউ স্মৃতিকে আরও দীর্ঘস্থায়ী করে, তাই পরের রিভিউ আরও পরে করলেও চলে। একে বলে স্পেসড রিপিটিশন (spaced repetition)। এভাবে কম পরিশ্রমে বেশি মনে থাকে।',
  'pilot.curve.introGo': 'দেখান, প্রায় ৪০ সেকেন্ড লাগবে',
  'pilot.curve.d1': 'ধরুন আজ আপনি নতুন কিছু শিখলেন। এর স্মৃতি শুরুতে ১০০%।',
  'pilot.curve.d2': 'এখন সময় যাচ্ছে, আর আমরা ভুলতে শুরু করছি। খুব দ্রুত।',
  'pilot.curve.d3': 'মাত্র ১ দিনেই প্রায় অর্ধেক চলে গেছে। এটাই ভুলে যাওয়ার বক্ররেখা।',
  'pilot.curve.d4': 'তাই হারিয়ে যাওয়ার ঠিক আগে রিভিউ করি। স্মৃতি আবার উঠে আসে।',
  'pilot.curve.d5': 'এবার স্মৃতি আরও ধীরে ম্লান হচ্ছে।',
  'pilot.curve.d6': 'ঠিক সময়ে আবার রিভিউ। এখন আরও ধীরে ম্লান হয়, তাই আরও একটু অপেক্ষা করা যায়।',
  'pilot.curve.d7': 'ব্যবধান ক্রমশ বাড়ছে।',
  'pilot.curve.d8': 'তৃতীয় রিভিউ, ৪ দিন পরে। ১, ২ আর ৪ দিনের ব্যবধান: এটাই স্পেসড রিপিটিশন।',
  'pilot.curve.d9': 'এবার দুই সপ্তাহ কেটে যাওয়া দেখুন।',
  'pilot.curve.cta': 'বুঝেছি, আমার ভুলগুলো যোগ করি',

  'pilot.log.title': 'যে ৩ থেকে ৫টি প্রশ্নে ভুল করেছেন সেগুলো লিখুন',
  'pilot.log.sub': 'একবারই বিষয় বেছে নিন। তারপর প্রতিটি ভুল লিখুন। শুধু প্রশ্ন আর সঠিক উত্তর জরুরি।',
  'pilot.log.counter': '{n} / ৫টি যোগ হয়েছে',
  'pilot.log.subject': 'বিষয়',
  'pilot.log.category': 'বিভাগ',
  'pilot.log.question': 'প্রশ্ন',
  'pilot.log.questionPh': 'পরীক্ষায় কী জিজ্ঞেস করা হয়েছিল?',
  'pilot.log.correct': 'সঠিক উত্তর',
  'pilot.log.correctPh': 'সঠিক উত্তরটি কী?',
  'pilot.log.wrong': 'আপনি যা লিখেছিলেন (ঐচ্ছিক)',
  'pilot.log.wrongPh': 'আপনার ভুল উত্তর',
  'pilot.log.hook': 'মনে রাখার কৌশল (ঐচ্ছিক)',
  'pilot.log.hookPh': 'মনে রাখতে সাহায্য করে এমন কৌশল, ছবি বা ছোট কারণ',
  'pilot.log.add': 'এই ভুলটি যোগ করুন',
  'pilot.log.saving': 'সংরক্ষণ হচ্ছে...',
  'pilot.log.need': 'চালিয়ে যেতে অন্তত ৩টি যোগ করুন।',
  'pilot.log.done': 'যোগ করা শেষ, এগিয়ে যান',
  'pilot.log.added': 'এ পর্যন্ত যোগ হয়েছে',
  'pilot.log.required': 'প্রশ্ন আর সঠিক উত্তর লিখুন।',
  'pilot.log.max': 'পাঁচটি হয়ে গেছে, দারুণ শুরু! এবার একটি মনে করার চেষ্টা করি।',

  'pilot.recall.title': 'আপনার প্রথম জয়',
  'pilot.recall.sub': 'কিছুক্ষণ আগেই উত্তরটি দেখেছেন। স্মৃতি থেকে কি তুলে আনতে পারেন?',
  'pilot.recall.placeholder': 'আপনার উত্তর লিখুন',
  'pilot.recall.check': 'যাচাই করুন',
  'pilot.recall.correct': 'সঠিক!',
  'pilot.recall.close': 'সঠিক! (শুধু বানানটা একটু দেখে নিন)',
  'pilot.recall.wrong': 'এখনও না। ঠিক এই কারণেই প্ল্যানটি এটিকে আবার সামনে আনবে।',
  'pilot.recall.answerWas': 'উত্তর: {a}',
  'pilot.recall.retry': 'আবার চেষ্টা করুন',
  'pilot.recall.badge': 'ব্যাজ পেয়েছেন: প্রথম স্মরণ',
  'pilot.recall.cta': 'আমার রিকভারি প্ল্যান দেখান',
  'pilot.recall.skip': 'এটি বাদ দিন',

  'pilot.plan.title': 'আপনার রিকভারি প্ল্যান',
  'pilot.plan.sub': '{date} এর মধ্যে এই {n}টি ভুল পাকাপোক্ত করা সম্ভব। প্রতিটি চেকপয়েন্টে ফিরে আসুন।',
  'pilot.plan.today': 'আজ',
  'pilot.plan.d1': 'দিন ১',
  'pilot.plan.d3': 'দিন ৩',
  'pilot.plan.d7': 'দিন ৭',
  'pilot.plan.d14': 'দিন ১৪',
  'pilot.plan.note': 'তারিখগুলো লক্ষ্য মাত্র। আপনি কতটা মনে রাখতে পারেন তার ওপর ভিত্তি করে মেমনিক প্রতিটি কার্ডের সময় ঠিক করে।',
  'pilot.plan.cta': 'আমার ড্যাশবোর্ডে যাই',
  'pilot.plan.review': 'এখনই রিভিউ করুন',

  'pilot.up.topics': 'দুর্বল টপিক',
  'pilot.up.date': 'পরীক্ষার তারিখ (ঐচ্ছিক)',
  'pilot.up.title': 'কোন টপিকগুলো নিয়ে সবচেয়ে বেশি চিন্তা?',
  'pilot.up.sub': 'যে টপিকগুলো কঠিন লাগে সেগুলো বেছে নিন। শুরু করার জন্য আমরা একটি স্টার্টার সেট দেব।',
  'pilot.up.dateHint': 'পরীক্ষার আগেই যেন সব রিভিউ শেষ হয়, সেভাবে পরিকল্পনা করব।',
  'pilot.up.need': 'অন্তত একটি টপিক বেছে নিন।',
  'pilot.up.cta': 'আমার স্টার্টার সেট দেখান',

  'pilot.starter.title': 'আপনার স্টার্টার সেট',
  'pilot.starter.sub': 'আপনার টপিকের জন্য যাচাই করা প্রশ্ন। যেগুলো আগে থেকেই জানেন সেগুলো বাদ দিন।',
  'pilot.starter.selected': '{max}টির মধ্যে {n}টি বাছাই করা হয়েছে',
  'pilot.starter.add': '{n}টি কার্ড যোগ করুন',
  'pilot.starter.adding': '{n}টির মধ্যে {done}টি যোগ হয়েছে...',
  'pilot.starter.none': 'অন্তত একটি কার্ড বাছুন।',
  'pilot.starter.max': 'শুরুতে সর্বোচ্চ {max}টি কার্ড যোগ করা যাবে।',
  'pilot.plan.final': 'শেষ রিভিউ',
  'pilot.plan.exam': 'পরীক্ষার দিন',
  'pilot.plan.subExam': 'আপনার পরীক্ষা {days} দিন পরে। প্রতিটি চেকপয়েন্টে ফিরে আসুন।',
  'pilot.plan.subExamToday': 'আপনার পরীক্ষা আজ। এখন একবার দ্রুত রিভিউ করাই সবচেয়ে ভালো ব্যবহার।',

  'pilot.ai.title': 'ঠিক কী অনুশীলন করতে চান, বলুন',
  'pilot.ai.sub': 'বিষয় আর টপিকের নাম লিখুন। আমাদের AI ঠিক সেটি নিয়েই প্রশ্ন বানাবে, প্রতিটির জন্য মনে রাখার কৌশলসহ।',
  'pilot.ai.subject': 'বিষয়',
  'pilot.ai.subjectPh': 'যেমন: জীববিজ্ঞান',
  'pilot.ai.topic': 'টপিক',
  'pilot.ai.topicPh': 'যেমন: হৃদপিণ্ড ও রক্ত সঞ্চালন',
  'pilot.ai.notes': 'আর কিছু বলার আছে? (ঐচ্ছিক)',
  'pilot.ai.notesPh': 'যেমন: মেডিকেল ভর্তি পরীক্ষা, সংজ্ঞা আর সংখ্যার ওপর জোর',
  'pilot.ai.count': 'কতটি প্রশ্ন',
  'pilot.ai.generate': 'আমার প্রশ্ন লিখুন',
  'pilot.ai.writing': 'আপনার প্রশ্ন লেখা হচ্ছে...',
  'pilot.ai.writingHint': 'সাধারণত ১০ থেকে ২৫ সেকেন্ড লাগে, কারণ প্রতিটি উত্তর দুবার যাচাই হয়।',
  'pilot.ai.need': 'একটি বিষয় এবং অন্তত ৩ অক্ষরের একটি টপিক লিখুন।',
  'pilot.ai.ready': 'অথবা তৈরি টপিক থেকে বেছে নিন',
  'pilot.ai.limitNote': 'AI কখনও ব্যর্থ বা ব্যস্ত থাকতে পারে। তখন তৈরি টপিক সবসময় আছে।',
  'pilot.ai.fallback': 'তৈরি টপিক ব্যবহার করুন',
  'pilot.ai.retry': 'আবার চেষ্টা করুন',
  'pilot.ai.step1': 'আপনার টপিকের মূল বিষয়গুলো বেছে নিচ্ছি...',
  'pilot.ai.step2': 'প্রশ্ন লিখছি...',
  'pilot.ai.step3': 'প্রতিটি উত্তর আবার যাচাই করছি...',
  'pilot.ai.reserved': 'অনুগ্রহ করে অন্য একটি বিষয়ের নাম দিন।',
  'pilot.aiset.verified': 'দ্বিতীয় একটি এআই ধাপ প্রতিটি প্রশ্ন নতুন করে সমাধান করেছে এবং যেগুলো নিয়ে নিশ্চিত ছিল না সেগুলো বাদ দিয়েছে। তবুও এআই ভুল করতে পারে, তাই ভরসা করার আগে একবার দেখে নিন।',
  'pilot.aiset.unverified': 'এআই-এর খসড়া। এবার দ্বিতীয় যাচাই চালানো যায়নি, তাই যোগ করার আগে প্রতিটি উত্তর মন দিয়ে পড়ুন।',
  'pilot.aiset.fewer': 'আপনি {asked}টি চেয়েছিলেন। {got}টি যাচাই পেরিয়েছে।',
  'pilot.aiset.left': 'আজ আরও {n}টি এআই ব্যবহার বাকি',
  'pilot.aiset.adding': '{n}টির মধ্যে {done}টি যোগ হয়েছে...',
  'pilot.aiset.add': '{n}টি কার্ড যোগ করুন',
  'pilot.aiset.title': '{topic} নিয়ে আপনার প্রশ্ন',
  'pilot.aiset.sub': 'যোগ করার আগে দেখে নিন। ভুল মনে হলে বা আগে থেকেই জানা থাকলে টিক তুলে দিন। AI ভুল করতে পারে।',
  'pilot.aiset.answer': 'উত্তর',
  'pilot.aiset.hook': 'মনে রাখার কৌশল',
  'pilot.aiset.options': 'ভুল অপশন',
  'pilot.aiset.more': 'আরেকটি সেট লিখুন',
  'pilot.aiset.back': 'টপিক বদলান',
  'pilot.aiset.chosen': '{total}টির মধ্যে {n}টি বাছাই করা হয়েছে',

  'plan.eyebrow': 'রিকভারি প্ল্যান',
  'plan.title': '{n}টির মধ্যে {k}টি পাকাপোক্ত',
  'plan.sub': 'পাকাপোক্ত মানে ৭ দিন বা তার বেশি ব্যবধান, অথবা মাস্টার্ড হিসেবে চিহ্নিত।',
  'plan.checkpoint': 'চেকপয়েন্ট',
  'plan.hide': 'লুকান',
  'plan.reviewDue': 'বাকি কার্ড রিভিউ করুন',
  'plan.complete': 'সবকটি ({n}টি) পাকাপোক্ত। চমৎকার!',
};

const DICTS = { en, bn };

const I18nContext = createContext(null);

function readLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === 'bn' ? 'bn' : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(readLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => {
    function setLang(next) {
      const chosen = next === 'bn' ? 'bn' : 'en';
      setLangState(chosen);
      try {
        localStorage.setItem(LANG_KEY, chosen);
      } catch {
        // Not being able to remember the choice is fine.
      }
    }

    function t(key, vars = {}) {
      const text = DICTS[lang][key] ?? en[key] ?? key;
      return text.replace(/\{(\w+)\}/g, (_, name) =>
        vars[name] === undefined ? `{${name}}` : String(vars[name])
      );
    }

    return { lang, setLang, t, locale: lang === 'bn' ? 'bn-BD' : 'en-GB' };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}

// Two small buttons: English | বাংলা
export function LanguageToggle({ className = '' }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div className={`lang-toggle ${className}`} role="group" aria-label={t('lang.label')}>
      <button
        type="button"
        className={lang === 'en' ? 'active' : ''}
        aria-pressed={lang === 'en'}
        onClick={() => setLang('en')}
      >
        EN
      </button>
      <button
        type="button"
        className={lang === 'bn' ? 'active' : ''}
        aria-pressed={lang === 'bn'}
        onClick={() => setLang('bn')}
      >
        বাং
      </button>
    </div>
  );
}
