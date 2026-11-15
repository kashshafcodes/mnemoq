// Everything about Mnemoq Pro that the owner of the site decides: prices,
// how to pay, and who to contact. Change the values here; no other file
// needs to change.
//
// Payment is by access code for now (see supabase/stage5.sql): the student
// pays by one of the methods below, sends proof, and receives a code to
// redeem on the Pro page.

export const PRO = {
  name: 'Mnemoq Pro',

  // Priced for students in Bangladesh. `price` is what a student pays during
  // the launch offer; `regular` is the real price after the offer ends (it is
  // shown crossed out until then). Amounts are in taka. `days` is how long Pro
  // lasts. The payment checker (api/_payments.js) uses these same numbers.
  offers: [
    { id: 'month', label: '1 month', price: 99, regular: 199, days: 30, note: 'Try everything' },
    { id: 'season', label: '4 months', price: 299, regular: 599, days: 120, note: 'Covers one full SAT preparation', best: true },
    { id: 'year', label: '12 months', price: 599, regular: 1199, days: 365, note: 'Covers every retake' },
  ],

  // The launch offer. After `endsAt` every plan costs its `regular` price.
  // To run another offer later, set a new end date (and prices) here.
  launch: {
    name: 'Launch offer',
    endsAt: '2026-12-15T23:59:59+06:00',
  },

  // TODO(owner): put your real payment details here. Leave a value empty to hide it.
  payment: {
    bkash: '01891966267',
    nagad: '',
    // Where a student sends proof of payment and receives the code.
    contactLabel: 'WhatsApp',
    contactUrl: 'https://wa.me/8801891966267',
    email: '',
  },

  benefits: [
    { id: 'full', title: 'Full adaptive practice tests', detail: 'Four timed modules that get harder or easier with you, like the real test, with a 400-1600 estimate.' },
    { id: 'bank', title: 'The whole question bank', detail: 'Every set in the practice library (over 11,000 questions, from vocabulary to physics) and hundreds more original SAT questions across all 27 skills.' },
    { id: 'drills', title: 'Unlimited drills and modules', detail: 'Practise your weakest skill as often as you like, with no daily or weekly limit.' },
    { id: 'coach', title: 'AI coach', detail: 'A written analysis of your diagnostic: what to fix first, how to fix it, and what to do this week.' },
    { id: 'plan', title: 'A plan to your test day', detail: 'Phases and score milestones from today to your SAT date, updated as your estimate moves.' },
  ],
};

export const hasPaymentDetails = () => Boolean(PRO.payment.bkash || PRO.payment.nagad || PRO.payment.contactUrl || PRO.payment.email);
