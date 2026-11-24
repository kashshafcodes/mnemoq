import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { track } from '../track';
import Jonaki from '../components/Jonaki';
import { CARD_HOME } from './questions';
import { MAX_SCORE, msUntilNext, scoreOf, shareText } from './puzzle';
import { loopT } from '../loop/strings';
import { bnDigits, rankOf } from './strings';
import { drawShareCard } from './shareImage';
import { sfx } from './audio';
import { haptic } from './haptics';

// The end of the night: the lanterns light up one by one (each plays a note,
// so every round has its own little tune), then the score, rank, sharing and
// the misses worth keeping.

const SHARE_URL = 'https://mnemoq-two.vercel.app/daily';
const MOODS = { 5: 'wow', 4: 'happy', 3: 'happy', 2: 'idle', 1: 'oops' };

// The result screen's Jonaki as standalone SVG markup for the share image.
function mascotMarkup() {
  const svg = document.querySelector('.dly-result .jonaki');

  if (!svg) return null;

  const copy = svg.cloneNode(true);

  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', '240');
  copy.setAttribute('height', '240');

  return new XMLSerializer().serializeToString(copy);
}

function clock(ms) {
  const total = Math.floor(ms / 1000);
  const pad = (n) => String(n).padStart(2, '0');

  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

export default function Result({ number, marks, questions, history, t, lang, num, sparks, inApp = null, streak = 0 }) {
  const score = scoreOf(marks);
  const rank = rankOf(score);
  const plays = Object.values(history.plays);
  const best = plays.reduce((top, p) => Math.max(top, p.score), score);
  const sure = marks.filter((m) => m.bet === 'sure');
  const missed = marks.map((m, i) => ({ mark: m, question: questions[i] })).filter(({ mark }) => !mark.correct);
  const [shown, setShown] = useState(0); // lanterns revealed so far
  const [counted, setCounted] = useState(0);
  const [toast, setToast] = useState('');
  const [left, setLeft] = useState(() => msUntilNext());
  const lanternRefs = useRef([]);
  const done = shown >= marks.length;

  // Light the lanterns one by one, then count the score up.
  useEffect(() => {
    if (shown < marks.length) {
      const id = setTimeout(() => {
        const m = marks[shown];

        sfx.melody(shown, m.correct);
        if (m.correct) {
          const box = lanternRefs.current[shown]?.getBoundingClientRect();
          if (box) sparks.current?.burst(box.left + box.width / 2, box.top + box.height / 2, { count: m.bet === 'sure' ? 26 : 14, spread: 0.6 });
        }
        setShown(shown + 1);
      }, shown === 0 ? 450 : 380);

      return () => clearTimeout(id);
    }

    return undefined;
  }, [shown, marks, sparks]);

  useEffect(() => {
    if (!done) return undefined;

    if (counted === score) {
      sfx.fanfare(Math.max(0, score) / MAX_SCORE);
      if (rank >= 4) {
        haptic.celebrate();
        sparks.current?.burst(innerWidth / 2, innerHeight * 0.3, { count: 60, spread: 1.4 });
      }
      return undefined;
    }

    const id = setTimeout(() => {
      setCounted((c) => c + Math.sign(score - c));
      sfx.tick();
    }, 55);

    return () => clearTimeout(id);
  }, [done, counted, score, rank, sparks]);

  useEffect(() => {
    const id = setInterval(() => setLeft(msUntilNext()), 1000);
    return () => clearInterval(id);
  }, []);

  function flash(message) {
    setToast(message);
    setTimeout(() => setToast(''), 2600);
  }

  async function cardBlob() {
    return drawShareCard({
      number: num(number),
      marks,
      score: num(score),
      max: num(MAX_SCORE),
      rankName: t(`rank_${rank}`),
      rankLine: t(`rankLine_${rank}`),
      title: t('title'),
      url: SHARE_URL,
      fontFamily: lang === 'bn' ? '"Noto Sans Bengali", "Inter", sans-serif' : '"Inter", sans-serif',
      mascotSvg: mascotMarkup(),
    });
  }

  async function share() {
    haptic.tap();
    sfx.tap();
    track('daily_share', { page: 'daily', number, score });

    const text = shareText({ number, marks, lang, url: SHARE_URL });

    try {
      const blob = await cardBlob();
      const file = blob && new File([blob], `mnemoq-daily-${number}.png`, { type: 'image/png' });

      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }

      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ text });
        return;
      }

      await navigator.clipboard.writeText(text);
      flash(t('copied'));
    } catch {
      // Cancelled or blocked.
    }
  }

  async function saveImage() {
    haptic.tap();
    sfx.tap();

    const blob = await cardBlob();

    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `mnemoq-daily-${number}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    track('daily_image', { page: 'daily', number });
  }

  return (
    <>
      <section className="dly-card dly-result">
        <Jonaki mood={done ? MOODS[rank] : 'think'} glow={done ? 0.2 + rank * 0.16 : 0.4} size={120} />
        <p className="dly-kicker">{t('resultTitle', { n: number })}</p>

        <div className="dly-result-lanterns">
          {marks.map((m, i) => (
            <span
              key={i}
              ref={(el) => (lanternRefs.current[i] = el)}
              className={`dly-lantern big ${i < shown ? (m.correct ? (m.bet === 'sure' ? 'lit bright' : 'lit') : 'out') : ''}`}
            />
          ))}
        </div>

        <p className={`dly-score ${done ? 'in' : ''}`}>
          <b>{num(counted)}</b>
          <span>
            / {num(MAX_SCORE)} {t('points')}
          </span>
        </p>

        <div className={`dly-rank ${done && counted === score ? 'in' : ''}`}>
          <h2>{t(`rank_${rank}`)}</h2>
          <p>{t(`rankLine_${rank}`)}</p>
        </div>

        <p className="dly-calibration">{sure.length ? t('calibration', { n: sure.length, right: sure.filter((m) => m.correct).length }) : t('calibrationNone')}</p>

        <dl className="dly-stats">
          <div>
            <dt>{t('streak')}</dt>
            <dd>
              {num(streak)}
              {streak > 0 && <span aria-hidden="true"> 🔥</span>}
            </dd>
          </div>
          <div>
            <dt>{t('played')}</dt>
            <dd>{num(plays.length)}</dd>
          </div>
          <div>
            <dt>{t('best')}</dt>
            <dd>{num(best)}</dd>
          </div>
        </dl>

        <div className="dly-share-row">
          <button type="button" className="dly-play" onClick={share}>
            {t('share')}
          </button>
          <button type="button" className="dly-ghost" onClick={saveImage}>
            {t('saveImage')}
          </button>
        </div>
        <p className="dly-next">{t('nextIn', { time: lang === 'bn' ? bnDigits(clock(left)) : clock(left) })}</p>
      </section>

      {inApp ? <AppNext missed={missed} t={t} lang={lang} inApp={inApp} /> : <Misses missed={missed} t={t} lang={lang} />}

      {toast && (
        <p className="dly-toast" role="status">
          {toast}
        </p>
      )}
    </>
  );
}

// A missed question as a review card (for the app's addCard, or a database row).
function cardFrom({ mark, question }, lang) {
  const side = question[lang] || question.en;
  const home = CARD_HOME[question.category];

  return {
    subject: home.subject,
    category: home.category,
    question: side.q,
    yourAnswer: side.options[mark.picked] || '',
    correctAnswer: side.options[question.answer],
    explanation: side.why,
  };
}

const brightFirst = (missed) => [...missed].sort((a, b) => (b.mark.bet === 'sure') - (a.mark.bet === 'sure'));

function MissList({ sorted, t, lang }) {
  return (
    <ul className="dly-missed">
      {sorted.map(({ mark, question }) => {
        const side = question[lang] || question.en;

        return (
          <li key={question.id} className={mark.bet === 'sure' ? 'bright' : ''}>
            {mark.bet === 'sure' && <em>✦ {t('bright')}</em>}
            <span>{side.q}</span>
            <b>{side.options[question.answer]}</b>
          </li>
        );
      })}
    </ul>
  );
}

// Inside the app (signed in): never a dead end. Misses -> save them and review
// them now. No misses -> one round of due cards, or "Done for today".
function AppNext({ missed, t, lang, inApp }) {
  const lt = loopT(lang);
  const [state, setState] = useState('idle');
  const sorted = brightFirst(missed);
  const due = inApp.dueCount || 0;

  async function saveAndReview() {
    setState('saving');
    haptic.tap();

    const result = await inApp.onSaveAndReview(sorted.map((item) => cardFrom(item, lang)));

    if (result?.error) {
      setState('failed');
      return;
    }

    sfx.correct(2);
    track('daily_cards_saved', { page: 'daily', count: result?.saved || 0, then: 'review' });
  }

  if (missed.length === 0) {
    return (
      <section className="dly-card dly-misses">
        <p className="dly-perfect">✦ {t('perfect')}</p>
        <p className="dly-note">{due > 0 ? lt('dailyEnd.dueToo', { n: due }) : lt('dailyEnd.perfect.next')}</p>
        <button type="button" className="dly-play dly-block" onClick={due > 0 ? inApp.onReview : inApp.onDone}>
          {due > 0 ? lt('play.title') : lt('session.next.done')}
        </button>
        <button type="button" className="dly-ghost dly-block" onClick={inApp.onBack}>
          {t('openApp')}
        </button>
      </section>
    );
  }

  return (
    <section className="dly-card dly-misses">
      <h2>{t('missedTitle')}</h2>
      <MissList sorted={sorted} t={t} lang={lang} />
      <button type="button" className="dly-play dly-block" disabled={state === 'saving'} onClick={saveAndReview}>
        {state === 'saving' ? t('saving') : lt('dailyEnd.review.save', { n: missed.length })}
      </button>
      {state === 'failed' && <p className="dly-note bad">{t('saveFailed')}</p>}
      <button type="button" className="dly-ghost dly-block" onClick={inApp.onDone}>
        {lt('dailyEnd.later')}
      </button>
    </section>
  );
}

// The questions you missed (bright mistakes first) and a way to keep them.
function Misses({ missed, t, lang }) {
  const [session, setSession] = useState(undefined);
  const [state, setState] = useState('idle');
  const sorted = brightFirst(missed);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session || null))
      .catch(() => setSession(null));
  }, []);

  if (missed.length === 0) {
    return (
      <section className="dly-card dly-misses">
        <p className="dly-perfect">✦ {t('perfect')}</p>
        <a className="dly-ghost dly-block" href="/">
          {t('openApp')}
        </a>
      </section>
    );
  }

  async function saveCards() {
    const userId = session?.user?.id;

    if (!userId) return;

    setState('saving');
    haptic.tap();

    const now = new Date().toISOString();
    const rows = sorted.map((item) => {
      const card = cardFrom(item, lang);

      return {
        id: crypto.randomUUID(),
        user_id: userId,
        subject: card.subject,
        category: card.category,
        question: card.question,
        your_answer: card.yourAnswer,
        correct_answer: card.correctAnswer,
        explanation: card.explanation,
        created_at: now,
        next_review_at: null,
        review_count: 0,
        review_interval_days: 0,
        mastered: false,
      };
    });

    const { error } = await supabase.from('mistakes').insert(rows);

    setState(error ? 'failed' : 'saved');

    if (!error) {
      sfx.correct(2);
      haptic.correct();
      track('daily_cards_saved', { page: 'daily', count: rows.length });
    }
  }

  return (
    <section className="dly-card dly-misses">
      <h2>{t('missedTitle')}</h2>
      <MissList sorted={sorted} t={t} lang={lang} />

      {session === undefined ? null : session ? (
        <>
          {state !== 'saved' && (
            <button type="button" className="dly-play dly-block" disabled={state === 'saving'} onClick={saveCards}>
              {state === 'saving' ? t('saving') : t('save', { n: missed.length })}
            </button>
          )}
          {state === 'saved' && <p className="dly-note ok">{t('saved')}</p>}
          {state === 'failed' && <p className="dly-note bad">{t('saveFailed')}</p>}
          <a className="dly-ghost dly-block" href="/">
            {t('openApp')}
          </a>
        </>
      ) : (
        <div className="dly-signup">
          <Jonaki mood="happy" size={56} />
          <div>
            <h3>{t('signupTitle')}</h3>
            <p>{t('signupBody')}</p>
            <a className="dly-play dly-block" href="/?utm_source=daily&utm_medium=result">
              {t('signup')}
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
