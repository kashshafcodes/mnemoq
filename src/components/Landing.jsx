import { useEffect, useRef } from 'react';
import Auth from '../Auth';
import { LanguageToggle, useI18n } from '../i18n';
import { PRO } from '../proConfig';
import { launchActive, priceOf, taka } from '../pricing';
import { track } from '../track';
import MnemoqLogo from './MnemoqLogo';

// The page everyone who is not signed in sees: what Mnemoq is, who it is for,
// and a sign-up form that is never more than one tap away.

const COPY = {
  en: {
    login: 'Log in',
    start: 'Start free',
    kicker: 'For SAT and NSU admission prep',
    title1: 'Stop making the',
    title2: 'same mistake twice.',
    lead: 'Mnemoq saves every question you get wrong and brings it back right before you would forget it. A few minutes a day, and the mistakes stop coming back on test day.',
    ctaMain: 'Start free',
    ctaSat: 'Take the free SAT diagnostic',
    nsuTry: 'University admission? Take a free check:',
    nsuTryLink: 'Take the free NSU check',
    tryFree: 'Try it free, no sign-up',
    trust: ['Free plan, no card needed', 'Works on your phone', 'English and বাংলা'],
    howKicker: 'How it works',
    howTitle: 'Three steps. Two minutes a day.',
    steps: [
      ['Save the mistake', 'Got a question wrong in a mock, a class test or a book? Add it in seconds, or let AI turn your notes into cards.'],
      ['Review at the right moment', 'Mnemoq schedules each card for the moment you are about to forget it, and reminds you on your phone.'],
      ['Watch it stick', 'Cards you know drift further apart. Weak ones come back sooner. Your progress page shows what is mastered.'],
    ],
    pathKicker: 'Exam paths',
    pathTitle: 'Built around the exam you are actually taking.',
    sat: ['Digital SAT', 'A 25-minute diagnostic, a 400–1600 score estimate, a map of all 27 skills and timed practice modules.'],
    nsu: ['NSU and BRAC admission', 'Free checks for NSU and BRAC University, an AI diagnostic of every section, mock tests in the real format and a readiness score.'],
    any: ['A practice library', 'Over 11,000 questions: vocabulary, maths word problems, quantitative reasoning, physics, chemistry, biology and more, with worked solutions.'],
    whyKicker: 'Why it works',
    whyTitle: 'Re-reading feels productive. Recalling actually is.',
    why: 'Most of what we study fades within days unless we come back to it. Testing yourself just as it starts to fade (spaced repetition and active recall) is one of the most studied ways to make knowledge last. Mnemoq does the scheduling, so you only do the remembering.',
    priceKicker: 'Pricing',
    priceTitle: 'Generous for free. Cheap for everything.',
    free: 'Free',
    freeList: ['Unlimited review cards', 'SAT diagnostic and score estimate', 'Skill map and score log', '3 drills a day, a timed module a week', 'Smart reminders'],
    proList: ['Full adaptive SAT practice tests', 'The whole question bank', 'Unlimited drills and modules', 'AI coach and a plan to test day'],
    perMonth: '/ month',
    pay: 'Pay with bKash or Nagad',
    faqKicker: 'Questions',
    faq: [
      ['Is it really free?', 'Yes. Saving and reviewing cards, the SAT diagnostic and reminders are free with no time limit. Pro adds full practice tests, the whole question bank and the AI coach.'],
      ['Are these official SAT questions?', 'No. They are original questions written to match the Digital SAT. Use College Board’s Bluebook for official practice tests; use Mnemoq to fix what those tests show you got wrong.'],
      ['Does it work on my phone?', 'Yes. Open it in your browser and add it to your home screen. Reminders work on Android, and on iPhone once added to the home screen.'],
      ['How do I pay for Pro?', 'Send the amount by bKash or Nagad and you get an access code to type on the Pro page. No card needed.'],
    ],
    finalTitle: 'Your next mistake is your next point.',
    finalLead: 'Create a free account and save your first card in under a minute.',
    footer: 'Made in Bangladesh for students everywhere.',
  },
  bn: {
    login: 'লগ ইন',
    start: 'ফ্রি শুরু করুন',
    kicker: 'SAT ও NSU ভর্তি প্রস্তুতির জন্য',
    title1: 'একই ভুল',
    title2: 'আর দ্বিতীয়বার নয়।',
    lead: 'যে প্রশ্নগুলো ভুল করেন, Mnemoq সেগুলো সংরক্ষণ করে এবং ভুলে যাওয়ার ঠিক আগে আবার সামনে আনে। দিনে কয়েক মিনিট, আর পরীক্ষার দিন সেই ভুলগুলো আর ফিরে আসে না।',
    ctaMain: 'ফ্রি শুরু করুন',
    ctaSat: 'ফ্রি SAT ডায়াগনস্টিক দিন',
    nsuTry: 'বিশ্ববিদ্যালয় ভর্তি? ফ্রি চেক দিন:',
    nsuTryLink: 'ফ্রি NSU চেক দিন',
    tryFree: 'সাইন আপ ছাড়াই ফ্রি চেষ্টা করুন',
    trust: ['ফ্রি প্ল্যান, কার্ড লাগবে না', 'ফোনেই চলে', 'English ও বাংলা'],
    howKicker: 'কীভাবে কাজ করে',
    howTitle: 'তিনটি ধাপ। দিনে দুই মিনিট।',
    steps: [
      ['ভুলটা সেভ করুন', 'মক টেস্ট, ক্লাস টেস্ট বা বইয়ে কোনো প্রশ্ন ভুল করেছেন? কয়েক সেকেন্ডে যোগ করুন, অথবা এআই দিয়ে নোট থেকে কার্ড বানান।'],
      ['ঠিক সময়ে রিভিউ করুন', 'যখন ভুলে যেতে শুরু করবেন, ঠিক তখনই Mnemoq কার্ডটি ফিরিয়ে আনে এবং ফোনে মনে করিয়ে দেয়।'],
      ['মনে থেকে যাবে', 'যেগুলো জানেন সেগুলো দেরিতে আসে, দুর্বলগুলো আগে। প্রোগ্রেস পেজে দেখুন কী আয়ত্ত হয়েছে।'],
    ],
    pathKicker: 'পরীক্ষার পথ',
    pathTitle: 'আপনার আসল পরীক্ষাকে ঘিরেই সাজানো।',
    sat: ['ডিজিটাল SAT', '২৫ মিনিটের ডায়াগনস্টিক, ৪০০–১৬০০ স্কোর অনুমান, ২৭টি দক্ষতার মানচিত্র এবং টাইমড প্র্যাকটিস মডিউল।'],
    nsu: ['NSU ও BRAC ভর্তি', 'NSU ও BRAC বিশ্ববিদ্যালয়ের ফ্রি চেক, প্রতিটি সেকশনের এআই ডায়াগনস্টিক, আসল ফরম্যাটে মক টেস্ট এবং রেডিনেস স্কোর।'],
    any: ['প্র্যাকটিস লাইব্রেরি', '১১,০০০+ প্রশ্ন: শব্দভাণ্ডার, গণিতের সমস্যা, কোয়ান্টিটেটিভ, পদার্থ, রসায়ন, জীববিজ্ঞান এবং আরও, ধাপে ধাপে সমাধানসহ।'],
    whyKicker: 'কেন কাজ করে',
    whyTitle: 'বারবার পড়া মনে হয় কাজের। নিজেকে প্রশ্ন করাই আসল কাজ।',
    why: 'যা পড়ি তার বেশিরভাগই কয়েক দিনের মধ্যে ঝাপসা হয়ে যায়। ঠিক ভুলে যাওয়ার মুখে নিজেকে পরীক্ষা করা (স্পেসড রিপিটিশন ও অ্যাক্টিভ রিকল) দীর্ঘদিন মনে রাখার সবচেয়ে পরীক্ষিত উপায়গুলোর একটি। সময়সূচি Mnemoq করে, আপনি শুধু মনে করেন।',
    priceKicker: 'মূল্য',
    priceTitle: 'ফ্রিতেই অনেক কিছু। সবকিছুর জন্য খুব কম দাম।',
    free: 'ফ্রি',
    freeList: ['আনলিমিটেড রিভিউ কার্ড', 'SAT ডায়াগনস্টিক ও স্কোর অনুমান', 'দক্ষতার মানচিত্র ও স্কোর লগ', 'দিনে ৩টি ড্রিল, সপ্তাহে একটি টাইমড মডিউল', 'স্মার্ট রিমাইন্ডার'],
    proList: ['পূর্ণ অ্যাডাপটিভ SAT প্র্যাকটিস টেস্ট', 'পুরো প্রশ্নব্যাংক', 'আনলিমিটেড ড্রিল ও মডিউল', 'এআই কোচ ও পরীক্ষার দিন পর্যন্ত পরিকল্পনা'],
    perMonth: '/ মাস',
    pay: 'বিকাশ বা নগদে পেমেন্ট',
    faqKicker: 'প্রশ্ন',
    faq: [
      ['সত্যিই কি ফ্রি?', 'হ্যাঁ। কার্ড সেভ ও রিভিউ, SAT ডায়াগনস্টিক এবং রিমাইন্ডার সময়সীমা ছাড়াই ফ্রি। Pro-তে আছে পূর্ণ প্র্যাকটিস টেস্ট, পুরো প্রশ্নব্যাংক ও এআই কোচ।'],
      ['এগুলো কি অফিসিয়াল SAT প্রশ্ন?', 'না। ডিজিটাল SAT-এর ধরনে লেখা মৌলিক প্রশ্ন। অফিসিয়াল টেস্টের জন্য College Board-এর Bluebook ব্যবহার করুন; সেখানে যা ভুল হয়, তা ঠিক করতে Mnemoq।'],
      ['ফোনে চলবে?', 'হ্যাঁ। ব্রাউজারে খুলে হোম স্ক্রিনে যোগ করুন। অ্যান্ড্রয়েডে রিমাইন্ডার চলে; আইফোনে হোম স্ক্রিনে যোগ করার পর।'],
      ['Pro-র জন্য কীভাবে পেমেন্ট করব?', 'বিকাশ বা নগদে টাকা পাঠালে একটি অ্যাক্সেস কোড পাবেন, সেটি Pro পেজে লিখুন। কার্ড লাগবে না।'],
    ],
    finalTitle: 'আপনার পরের ভুলই আপনার পরের নম্বর।',
    finalLead: 'ফ্রি অ্যাকাউন্ট খুলে এক মিনিটের মধ্যে প্রথম কার্ড সেভ করুন।',
    footer: 'বাংলাদেশে তৈরি, সব শিক্ষার্থীর জন্য।',
  },
};

function DemoCard() {
  return (
    <div className="lp-demo" aria-hidden="true">
      <div className="lp-demo-card lp-demo-back">
        <span className="lp-chip">Math · Algebra</span>
        <p>If 3x + 7 = 22, what is x?</p>
      </div>
      <div className="lp-demo-card lp-demo-front">
        <div className="lp-demo-top">
          <span className="lp-chip">SAT · Words in context</span>
          <span className="lp-due">Due now</span>
        </div>
        <p className="lp-demo-q">
          As used in the passage, <b>&ldquo;equivocal&rdquo;</b> most nearly means…
        </p>
        <ul className="lp-demo-options">
          <li>A. decisive</li>
          <li className="is-right">B. open to more than one reading</li>
          <li className="is-wrong">C. generous</li>
        </ul>
        <div className="lp-demo-foot">
          <span>
            You missed this <b>3 days ago</b>
          </span>
          <span className="lp-next">Next review in 6 days</span>
        </div>
      </div>
      <div className="lp-demo-stat">
        <b>1340</b>
        <span>Example: SAT estimate, +90 this month</span>
      </div>
    </div>
  );
}

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3.5 8.5 6.5 11.5 12.5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Landing() {
  const { lang } = useI18n();
  const c = COPY[lang] || COPY.en;
  const formRef = useRef(null);
  const from = PRO.offers[0];
  const best = PRO.offers.find((o) => o.best) || from;

  useEffect(() => {
    track('landing_view', { page: 'landing' });
  }, []);

  function goSignup(where) {
    track('cta_click', { page: 'landing', where });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => document.getElementById('auth-email')?.focus({ preventScroll: true }), 450);
  }

  return (
    <div className="lp">
      <header className="lp-nav">
        <MnemoqLogo size={30} />
        <div className="lp-nav-right">
          <LanguageToggle />
          <button type="button" className="mq-btn mq-btn-ghost lp-hide-sm" onClick={() => goSignup('nav_login')}>
            {c.login}
          </button>
          <button type="button" className="mq-btn mq-btn-primary" onClick={() => goSignup('nav')}>
            {c.start}
          </button>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-text">
          <p className="lp-kicker">{c.kicker}</p>
          <h1>
            {c.title1} <span className="lp-hl">{c.title2}</span>
          </h1>
          <p className="lp-lead">{c.lead}</p>
          <div className="lp-ctas">
            <button type="button" className="mq-btn mq-btn-primary mq-btn-lg" onClick={() => goSignup('hero')}>
              {c.ctaMain} <span aria-hidden="true">→</span>
            </button>
            <a className="mq-btn mq-btn-ghost mq-btn-lg" href="/sat" onClick={() => track('cta_click', { page: 'landing', where: 'hero_sat' })}>
              {c.ctaSat}
            </a>
          </div>
          <p className="lp-also">
            {c.nsuTry}{' '}
            <a href="/nsu" onClick={() => track('cta_click', { page: 'landing', where: 'hero_nsu' })}>
              NSU →
            </a>{' '}
            ·{' '}
            <a href="/brac" onClick={() => track('cta_click', { page: 'landing', where: 'hero_brac' })}>
              BRAC →
            </a>
          </p>
          <ul className="lp-trust">
            {c.trust.map((item) => (
              <li key={item}>
                <CheckIcon /> {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="lp-hero-side" ref={formRef} id="start">
          <DemoCard />
          <Auth compact />
        </div>
      </section>

      <section className="lp-section" id="how">
        <p className="lp-kicker">{c.howKicker}</p>
        <h2>{c.howTitle}</h2>
        <ol className="lp-steps">
          {c.steps.map(([title, body], i) => (
            <li key={title}>
              <span className="lp-step-n">{i + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-section">
        <p className="lp-kicker">{c.pathKicker}</p>
        <h2>{c.pathTitle}</h2>
        <div className="lp-paths">
          {[
            [c.sat, 'lp-path-sat', 'New', '/sat'],
            [c.nsu, 'lp-path-nsu', null, '/nsu'],
            [c.any, 'lp-path-any', null, null],
          ].map(([[title, body], cls, tag, href]) => (
            <article key={title} className={`lp-path ${cls}`}>
              {tag && <span className="lp-tag">{tag}</span>}
              <h3>{title}</h3>
              <p>{body}</p>
              {href && (
                <a className="lp-path-link" href={href}>
                  {c.tryFree} →
                </a>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section lp-why">
        <div>
          <p className="lp-kicker">{c.whyKicker}</p>
          <h2>{c.whyTitle}</h2>
          <p className="lp-lead">{c.why}</p>
        </div>
        <svg className="lp-curve" viewBox="0 0 320 180" role="img" aria-label="Memory fades without review; each review makes it fade more slowly">
          <line x1="20" y1="160" x2="310" y2="160" className="lp-axis" />
          <line x1="20" y1="15" x2="20" y2="160" className="lp-axis" />
          <path d="M20 20 C 50 95, 80 130, 140 145 S 260 155, 310 156" className="lp-fade" />
          <path d="M20 20 C 35 55, 45 65, 60 70 L60 22 C 85 55, 100 62, 120 66 L120 22 C 160 45, 190 50, 230 52 L230 22 C 260 33, 285 36, 310 37" className="lp-keep" />
          <text x="300" y="148" textAnchor="end" className="lp-curve-label">without review</text>
          <text x="300" y="30" textAnchor="end" className="lp-curve-label lp-curve-keep">with Mnemoq</text>
        </svg>
      </section>

      <section className="lp-section" id="pricing">
        <p className="lp-kicker">{c.priceKicker}</p>
        <h2>{c.priceTitle}</h2>
        <div className="lp-prices">
          <article className="lp-price">
            <h3>{c.free}</h3>
            <p className="lp-amount">
              ৳0 <small>{c.perMonth}</small>
            </p>
            <ul>
              {c.freeList.map((item) => (
                <li key={item}>
                  <CheckIcon /> {item}
                </li>
              ))}
            </ul>
            <button type="button" className="mq-btn mq-btn-ghost mq-btn-block" onClick={() => goSignup('price_free')}>
              {c.start}
            </button>
          </article>
          <article className="lp-price lp-price-pro">
            <h3>Pro</h3>
            {launchActive() && <span className="lp-offer">{PRO.launch.name} · 50% off</span>}
            <p className="lp-amount">
              {taka(priceOf(from).now)} {priceOf(from).was && <s>{taka(priceOf(from).was)}</s>} <small>{c.perMonth}</small>
            </p>
            <p className="lp-price-note">
              {best.label}: {taka(priceOf(best).now)}
              {priceOf(best).was ? ` (regular ${taka(priceOf(best).was)})` : ''}. {c.pay}.
            </p>
            <ul>
              {c.proList.map((item) => (
                <li key={item}>
                  <CheckIcon /> {item}
                </li>
              ))}
            </ul>
            <button type="button" className="mq-btn mq-btn-primary mq-btn-block" onClick={() => goSignup('price_pro')}>
              {c.start}
            </button>
          </article>
        </div>
      </section>

      <section className="lp-section lp-faq">
        <p className="lp-kicker">{c.faqKicker}</p>
        {c.faq.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>

      <section className="lp-final">
        <h2>{c.finalTitle}</h2>
        <p>{c.finalLead}</p>
        <button type="button" className="mq-btn mq-btn-primary mq-btn-lg" onClick={() => goSignup('final')}>
          {c.ctaMain} <span aria-hidden="true">→</span>
        </button>
      </section>

      <footer className="lp-footer">
        <MnemoqLogo size={22} />
        <p>{c.footer}</p>
        <p>© {new Date().getFullYear()} Mnemoq</p>
      </footer>

      <div className="lp-sticky">
        <button type="button" className="mq-btn mq-btn-primary mq-btn-block" onClick={() => goSignup('sticky')}>
          {c.ctaMain} <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
