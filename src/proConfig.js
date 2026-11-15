// Everything about Mnemoq Pro that the owner of the site decides: prices,
// how to pay, and who to contact. Change the values here; no other file
// needs to change.
//
// Payment is by access code for now (see supabase/stage5.sql): the student
// pays by one of the methods below, sends proof, and receives a code to
// redeem on the Pro page.

export const PRO = {
  name: 'Mnemoq Pro',

  // Priced for students in Bangladesh: about the cost of a few cups of tea a
  // month. Change these freely; `days` must match the codes you create.
  offers: [
    { id: 'month', label: '1 month', price: '৳99', days: 30, note: 'Try everything' },
    { id: 'season', label: '4 months', price: '৳299', days: 120, note: 'Covers one full SAT preparation', best: true },
    { id: 'year', label: '12 months', price: '৳599', days: 365, note: 'Covers every retake' },
  ],

  // TODO(owner): put your real payment details here. Leave a value empty to hide it.
  payment: {
    bkash: '',
    nagad: '',
    // Where a student sends proof of payment and receives the code.
    contactLabel: '',
    contactUrl: '',
    email: '',
  },

  benefits: [
    { id: 'full', title: 'Full adaptive practice tests', detail: 'Four timed modules that get harder or easier with you, like the real test, with a 400-1600 estimate.' },
    { id: 'bank', title: 'The whole question bank', detail: 'Hundreds more original questions across all 27 skills, so practice stays fresh.' },
    { id: 'drills', title: 'Unlimited drills and modules', detail: 'Practise your weakest skill as often as you like, with no daily or weekly limit.' },
    { id: 'coach', title: 'AI coach', detail: 'A written analysis of your diagnostic: what to fix first, how to fix it, and what to do this week.' },
    { id: 'plan', title: 'A plan to your test day', detail: 'Phases and score milestones from today to your SAT date, updated as your estimate moves.' },
  ],
};

export const hasPaymentDetails = () => Boolean(PRO.payment.bkash || PRO.payment.nagad || PRO.payment.contactUrl || PRO.payment.email);
