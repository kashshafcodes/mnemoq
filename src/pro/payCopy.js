// Payment wording in English and Bangla, driven by PRO.payment in
// proConfig.js. A method only appears in copy when its number is set, so
// adding a Nagad number there makes every "bKash" line say "bKash or Nagad"
// automatically (and the other way round).

const METHOD_NAMES = {
  en: { bkash: 'bKash', nagad: 'Nagad', or: ' or ' },
  // Bangla needs two forms: the plain name and the locative ("in bKash").
  bn: { bkash: 'বিকাশ', nagad: 'নগদ', or: ' বা ', bkashIn: 'বিকাশে', nagadIn: 'নগদে' },
};

// Which methods have a number set, in a fixed order.
export function payMethods(payment = {}) {
  return ['bkash', 'nagad'].filter((m) => Boolean(String(payment[m] || '').trim()));
}

// "bKash", "Nagad" or "bKash or Nagad" (Bangla: বিকাশ / নগদ / বিকাশ বা নগদ).
// Falls back to bKash when nothing is set, since that is the decided method.
export function methodLabel(payment, lang = 'en') {
  const names = METHOD_NAMES[lang] || METHOD_NAMES.en;
  const methods = payMethods(payment);
  const list = methods.length ? methods : ['bkash'];

  return list.map((m) => names[m]).join(names.or);
}

// Bangla locative: "বিকাশে", "নগদে", "বিকাশ বা নগদে". English is unchanged.
export function methodLabelIn(payment, lang = 'en') {
  if (lang !== 'bn') return methodLabel(payment, lang);

  const names = METHOD_NAMES.bn;
  const methods = payMethods(payment);
  const list = methods.length ? methods : ['bkash'];

  if (list.length === 1) return names[`${list[0]}In`];

  return `${names[list[0]]}${names.or}${names[`${list[1]}In`]}`;
}

const fill = (text, vars = {}) => text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));

const COPY = {
  en: {
    landingPay: 'Pay with {method}',
    landingFaqQ: 'How do I pay for Pro?',
    landingFaqA: 'Send Money by {method}, then type the transaction ID from the SMS on the Pro page. Pro starts automatically, usually within a minute. No card needed.',
    payWith: 'Pay with {method}. Pro starts automatically, usually within a minute.',
    stepOpen: 'Open {method} and choose <b>Send Money</b>.',
    stepType: 'Type the transaction ID (TrxID) from the confirmation SMS and the last 4 digits of the number the money was sent from.',
    last4Label: 'Last 4 digits of the {method} number the money was sent from (a parent’s number is fine)',
    parentHint: 'Paid from a parent’s or friend’s {method}? Use the last 4 digits of that number.',
    waiting: 'Waiting for your payment to arrive. It usually takes under a minute; at night it can take longer.',
    checkingTrx: 'Checking TrxID',
    edit: 'Edit',
    timeout: 'Your claim is saved (TrxID {trx}). Pro will switch on by itself as soon as the {method} SMS reaches us. You can close this page. If it’s not on within 2 hours, message us on WhatsApp with this TrxID.',
    mismatch: 'These 4 digits don’t match the number this payment came from. If a parent or friend paid, use the last 4 digits of their number.',
    pendingTitle: 'Payment pending: TrxID {trx}',
    pendingBody: 'Still checking. It completes by itself when the payment SMS reaches us; your TrxID is saved. If it’s not on within 2 hours, message us on WhatsApp with this TrxID.',
    pendingCheck: 'Check now',
    pendingDismiss: 'Hide',
    parentButton: 'Send to a parent',
    parentOther: 'Other apps',
    checking: 'Checking…',
    pendingDone: 'Payment received. {days} days of Pro added.',
    parentCopied: 'Message copied. Paste it to your parent.',
    planTag: 'Covers one full SAT prep',
    parentText:
      'Hi, I’m preparing for the SAT on Mnemoq ({site}). Mnemoq Pro for {plan} is {price} until {endDate} (regular {regular}). To pay: open {method} → Send Money → {price} to {number}. Then please send me the TrxID from the SMS and the last 4 digits of your number, and I’ll activate it.',
    parentTextNoOffer:
      'Hi, I’m preparing for the SAT on Mnemoq ({site}). Mnemoq Pro for {plan} is {price}. To pay: open {method} → Send Money → {price} to {number}. Then please send me the TrxID from the SMS and the last 4 digits of your number, and I’ll activate it.',
  },
  bn: {
    landingPay: '{method} দিয়ে পেমেন্ট',
    landingFaqQ: 'Pro-র জন্য কীভাবে পেমেন্ট করব?',
    landingFaqA: '{methodIn} Send Money করুন, তারপর SMS-এর ট্রানজেকশন আইডি Pro পেজে লিখুন। সাধারণত এক মিনিটের মধ্যে Pro নিজে থেকেই চালু হয়। কার্ড লাগবে না।',
    payWith: '{method} দিয়ে পেমেন্ট করুন। সাধারণত এক মিনিটের মধ্যে Pro নিজে থেকেই চালু হয়।',
    stepOpen: '{method} খুলে <b>Send Money</b> বেছে নিন।',
    stepType: 'নিশ্চিতকরণ SMS-এর ট্রানজেকশন আইডি (TrxID) আর যে নম্বর থেকে টাকা পাঠানো হয়েছে তার শেষ ৪ সংখ্যা লিখুন।',
    last4Label: 'যে {method} নম্বর থেকে টাকা পাঠানো হয়েছে তার শেষ ৪ সংখ্যা (মা-বাবার নম্বর হলেও চলবে)',
    parentHint: 'মা-বাবা বা বন্ধুর {method} থেকে পাঠিয়েছেন? তাহলে সেই নম্বরের শেষ ৪ সংখ্যা দিন।',
    waiting: 'আপনার পেমেন্ট পৌঁছানোর অপেক্ষায়। সাধারণত এক মিনিটের কম লাগে; রাতে একটু বেশি লাগতে পারে।',
    checkingTrx: 'যাচাই হচ্ছে TrxID',
    edit: 'বদলান',
    timeout: 'আপনার দাবি সংরক্ষিত হয়েছে (TrxID {trx})। {method}-এর SMS আমাদের কাছে পৌঁছালেই Pro নিজে থেকে চালু হবে, পেজটি বন্ধ করে দিতে পারেন। ২ ঘণ্টার মধ্যে চালু না হলে এই TrxID দিয়ে WhatsApp-এ আমাদের জানান।',
    mismatch: 'এই ৪টি সংখ্যা পেমেন্টটি যে নম্বর থেকে এসেছে তার সাথে মিলছে না। মা-বাবা বা বন্ধু পাঠালে তাঁদের নম্বরের শেষ ৪ সংখ্যা দিন।',
    pendingTitle: 'পেমেন্ট অপেক্ষমাণ: TrxID {trx}',
    pendingBody: 'এখনও যাচাই হচ্ছে। পেমেন্টের SMS আমাদের কাছে পৌঁছালেই নিজে থেকে সম্পূর্ণ হবে; আপনার TrxID সংরক্ষিত আছে। ২ ঘণ্টার মধ্যে চালু না হলে এই TrxID দিয়ে WhatsApp-এ আমাদের জানান।',
    pendingCheck: 'এখন দেখুন',
    pendingDismiss: 'লুকান',
    parentButton: 'মা-বাবাকে পাঠান',
    parentOther: 'অন্য অ্যাপে',
    checking: 'যাচাই হচ্ছে…',
    pendingDone: 'পেমেন্ট পাওয়া গেছে। {days} দিনের Pro যোগ হয়েছে।',
    parentCopied: 'বার্তা কপি হয়েছে। মা-বাবাকে পেস্ট করে পাঠান।',
    planTag: 'একটি পূর্ণ SAT প্রস্তুতির জন্য যথেষ্ট',
    parentText:
      'আমি Mnemoq-এ SAT-এর প্রস্তুতি নিচ্ছি ({site})। Mnemoq Pro {plan} {endDate} পর্যন্ত {price} (নিয়মিত দাম {regular})। পেমেন্ট করতে: {method} খুলে Send Money → {number} নম্বরে {price} পাঠান। তারপর SMS-এর TrxID আর আপনার নম্বরের শেষ ৪ সংখ্যা আমাকে পাঠিয়ে দিন, আমি চালু করে নেব।',
    parentTextNoOffer:
      'আমি Mnemoq-এ SAT-এর প্রস্তুতি নিচ্ছি ({site})। Mnemoq Pro {plan} {price}। পেমেন্ট করতে: {method} খুলে Send Money → {number} নম্বরে {price} পাঠান। তারপর SMS-এর TrxID আর আপনার নম্বরের শেষ ৪ সংখ্যা আমাকে পাঠিয়ে দিন, আমি চালু করে নেব।',
  },
};

// payText(payment, lang, key, vars): one line of payment copy, with {method}
// and {methodIn} filled from the payment config.
export function payText(payment, lang, key, vars = {}) {
  const table = COPY[lang] || COPY.en;
  const text = table[key] ?? COPY.en[key] ?? key;

  return fill(text, { method: methodLabel(payment, lang), methodIn: methodLabelIn(payment, lang), ...vars });
}

export const SITE_URL = 'https://mnemoq-two.vercel.app';

// The prefilled "Send to a parent" message. `was` is the regular price when a
// launch offer is running, otherwise null.
export function parentShareText(payment, lang, { plan, price, was, endDate, number }) {
  return payText(payment, lang, was ? 'parentText' : 'parentTextNoOffer', {
    site: SITE_URL,
    plan,
    price,
    regular: was || '',
    endDate: endDate || '',
    number,
  });
}

export const whatsappShareUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

// A claim that is still waiting is remembered on this device, so a reload of
// the Pro page can say "Payment pending" instead of forgetting it. Keyed by the
// account so another person on the same phone never sees it.
const PENDING_KEY = 'mnemoq-pay-pending';
const PENDING_MAX_AGE = 3 * 24 * 60 * 60 * 1000;

export function loadPending(account, now = Date.now()) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PENDING_KEY) || 'null');

    if (!saved || saved.account !== (account || '') || now - saved.at > PENDING_MAX_AGE) return null;

    return saved;
  } catch {
    return null;
  }
}

export function savePending(account, trx, last4, now = Date.now()) {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify({ account: account || '', trx, last4, at: now }));
  } catch {
    // Storage blocked: the pending note just won't survive a reload.
  }
}

export function clearPending() {
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}
