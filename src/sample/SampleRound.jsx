import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { track } from '../track';
import Jonaki from '../components/Jonaki';
import { CARD_HOME } from '../daily/questions';
import { bnDigits, makeT } from '../daily/strings';
import { NightSky, Sparks } from '../daily/Stage';
import ChargeLantern from '../daily/ChargeLantern';
import { haptic } from '../haptics';
import { sfx } from '../daily/audio';
import { SAMPLE, resultKeys, shareUrl } from './strings';
import { SAMPLE_QUESTIONS } from './questions';
import { saveSampleMisses } from './store';
import '../daily/daily.css';
import './sample.css';

// The sample round, before sign-up: three sample-only questions (questions.js,
// not in the Daily pool), the same lantern bet, then "save your progress" and
// "send this round to a friend". Misses wait in this browser (store.js) and
// become the new account's first cards.
// Loaded only when someone taps "Try a sample round" on the landing page or
// opens the /sample link (via = 'landing' or 'link').

const LETTERS = ['A', 'B', 'C', 'D'];
const SIZE = 3;

export default function SampleRound({ onClose, onSignup, onLogin, via = 'landing' }) {
  const { lang } = useI18n();
  const dt = useMemo(() => makeT(lang), [lang]);
  const s = (key, vars = {}) => {
    const text = (SAMPLE[lang] || SAMPLE.en)[key] ?? SAMPLE.en[key] ?? key;
    const filled = text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));

    return lang === 'bn' ? bnDigits(filled) : filled;
  };
  const questions = SAMPLE_QUESTIONS;
  const [phase, setPhase] = useState('hello');
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState(null);
  const [bet, setBet] = useState(null);
  const [marks, setMarks] = useState([]);
  const [shareNote, setShareNote] = useState('');
  const openedAt = useRef(0);
  const sparks = useRef(null);
  const optionRefs = useRef([]);
  const dialogRef = useRef(null);

  const question = questions[step];
  const side = question?.[lang] || question?.en;
  const revealed = bet !== null;
  const correct = revealed && picked === question.answer;
  const right = marks.filter((m) => m.correct).length;
  const keys = resultKeys(right, SIZE);

  function skip(how) {
    track('sample_skip', { page: 'landing', how, right, phase, lang });
    onClose();
  }

  // Close (X or Escape) always goes through skip(), so it is counted once.
  const skipRef = useRef(skip);

  useEffect(() => {
    skipRef.current = skip;
  });

  // Once per sheet (the guard also covers StrictMode's double run in dev).
  useEffect(() => {
    if (openedAt.current) return;

    openedAt.current = Date.now();
    track('sample_open', { page: 'landing', via, lang });
  }, [via, lang]);

  // A full-screen sheet: lock the page behind it, close on Escape.
  useEffect(() => {
    const previous = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') skipRef.current('close');
    };

    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    dialogRef.current?.scrollTo?.({ top: 0 });
  }, [step, phase]);

  function start() {
    sfx.start();
    haptic.select();
    track('sample_start', { page: 'landing', lang });
    setPhase('play');
  }

  function pick(i) {
    if (revealed) return;

    setPicked(i);
    sfx.select(i);
    haptic.select();
  }

  function lockIn(betId) {
    if (picked === null || revealed) return;

    const isRight = picked === question.answer;

    setBet(betId);
    setMarks((list) => [...list, { picked, correct: isRight, bet: betId }]);
    track('sample_answer', { page: 'landing', step: step + 1, qid: question.id, correct: isRight, bet: betId, lang });

    if (isRight) {
      sfx.correct(2);
      haptic.correct();
      const box = optionRefs.current[picked]?.getBoundingClientRect();
      if (box) sparks.current?.burst(box.left + box.width / 2, box.top + box.height / 2, { count: 20, spread: 0.8 });
    } else {
      sfx.wrong(1);
      haptic.wrong();
    }
  }

  function next() {
    sfx.next();
    if (step + 1 < SIZE) {
      haptic.tap();
      setStep(step + 1);
      setPicked(null);
      setBet(null);
      return;
    }

    const missed = marks
      .map((mark, i) => ({ mark, question: questions[i] }))
      .filter(({ mark }) => !mark.correct)
      .map(({ mark, question: q }) => {
        const text = q[lang] || q.en;
        const home = CARD_HOME[q.category];

        return {
          subject: home.subject,
          category: home.category,
          question: text.q,
          yourAnswer: text.options[mark.picked] || '',
          correctAnswer: text.options[q.answer],
          explanation: text.why,
        };
      });

    // Round done: celebrate inside this tap (iPhones only tick during a tap).
    haptic.celebrate();
    saveSampleMisses(missed);
    track('sample_finish', {
      page: 'landing',
      right,
      bright_misses: marks.filter((m) => !m.correct && m.bet === 'sure').length,
      ms: Date.now() - openedAt.current,
      lang,
    });
    setPhase('done');
  }

  // Native share sheet where there is one, else copy the text and link.
  async function share() {
    const text = s('shareText', { n: right });
    const url = shareUrl(window.location.origin);

    try {
      if (navigator.share) {
        await navigator.share({ text, url });
        track('sample_share', { page: 'landing', right, how: 'sheet', lang });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShareNote(s('shareCopied'));
      track('sample_share', { page: 'landing', right, how: 'copy', lang });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      // No share sheet and no clipboard: show the link so it can be copied by hand.
      setShareNote(`${text} ${url}`);
      track('sample_share', { page: 'landing', right, how: 'shown', lang });
    }
  }

  const mood = phase === 'hello' ? 'happy' : phase === 'done' ? (right === SIZE ? 'wow' : 'idle') : revealed ? (correct ? 'happy' : 'oops') : picked === null ? 'think' : 'idle';

  return (
    <div className="dly smp" role="dialog" aria-modal="true" aria-label={s('open')} ref={dialogRef} tabIndex={-1} lang={lang}>
      <NightSky glow={right / SIZE} />
      <Sparks ref={sparks} />

      <header className="dly-top">
        <span className="smp-count">{phase === 'play' ? s('lantern', { n: step + 1, total: SIZE }) : ''}</span>
        <button type="button" className="dly-icon-btn" aria-label={s('close')} onClick={() => skip('close')}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <main className="dly-main">
        {phase === 'hello' && (
          <section className="dly-intro">
            <Jonaki mood="happy" size={130} className="dly-hero-mascot" />
            <p className="smp-bubble">{s('s1Jonaki')}</p>
            <p className="dly-lead">{s('s1Sub')}</p>
            <button type="button" className="dly-play" onClick={start}>
              {s('s1Start')}
            </button>
            <button type="button" className="dly-ghost smp-quiet" onClick={onLogin}>
              {s('s1HaveAccount')}
            </button>
          </section>
        )}

        {phase === 'play' && question && (
          <>
            <div className="dly-lanterns" aria-hidden="true">
              {questions.map((q, i) => {
                const m = marks[i];

                return <span key={q.id} className={`dly-lantern ${m ? (m.correct ? 'lit' : 'out') : i === step ? 'now' : ''}`} />;
              })}
            </div>

            <section key={step} className="dly-card dly-qcard">
              <div className="dly-q-head">
                <Jonaki mood={mood} size={64} />
                <div>
                  {step === 0 && !revealed && <p className="smp-hint">{s('s2Jonaki')}</p>}
                  <h1 className="dly-question">{side.q}</h1>
                </div>
              </div>

              <div className="dly-options" role="group">
                {side.options.map((option, i) => {
                  let state = '';

                  if (revealed && i === question.answer) state = 'right';
                  else if (revealed && i === picked) state = 'wrong';
                  else if (i === picked) state = 'picked';

                  return (
                    <button
                      key={option}
                      ref={(el) => (optionRefs.current[i] = el)}
                      type="button"
                      className={`dly-option ${state}`}
                      disabled={revealed}
                      aria-pressed={i === picked}
                      onClick={() => pick(i)}
                    >
                      <span className="dly-letter" aria-hidden="true">
                        {LETTERS[i]}
                      </span>
                      <span className="dly-option-text">{option}</span>
                    </button>
                  );
                })}
              </div>

              {!revealed && <ChargeLantern disabled={picked === null} t={dt} lang={lang} onCharge={() => {}} onLock={lockIn} />}

              {revealed && (
                <div className={`dly-reveal ${correct ? 'ok' : 'miss'}`} aria-live="polite">
                  <p className="dly-verdict">{correct ? (bet === 'guess' ? s('s2Guess') : s('s2Right')) : bet === 'sure' ? s('s2Bright') : s('s2Wrong')}</p>
                  {!correct && <p className="dly-answer">{dt('answerWas', { answer: side.options[question.answer] })}</p>}
                  <p className="dly-why">{side.why}</p>
                  <button type="button" className="dly-play dly-next-btn" onClick={next} autoFocus>
                    {step + 1 < SIZE ? s('next') : s('finish')}
                  </button>
                </div>
              )}
            </section>
          </>
        )}

        {phase === 'done' && (
          <section className="dly-card smp-done">
            <Jonaki mood={mood} glow={0.3 + (right / SIZE) * 0.6} size={96} />
            <div className="dly-result-lanterns" aria-hidden="true">
              {marks.map((m, i) => (
                <span key={i} className={`dly-lantern big ${m.correct ? 'lit' : 'out'}`} />
              ))}
            </div>
            <p className="smp-bubble">{s(keys.line)}</p>
            <p className="dly-lead">{s('s3What')}</p>
            <h2>{s(keys.title)}</h2>
            <p className="dly-note">{s(keys.body)}</p>
            <button
              type="button"
              className="dly-play dly-block"
              onClick={() => {
                track('cta_click', { page: 'landing', where: 'sample_save', right });
                onSignup();
              }}
            >
              {s('saveButton')}
            </button>
            <button type="button" className="dly-ghost dly-block" onClick={() => skip('later')}>
              {s('later')}
            </button>
            <p className="smp-small">{s(keys.note)}</p>
            {right > 0 && (
              <button type="button" className="smp-share" onClick={share}>
                {s('share')}
              </button>
            )}
            {shareNote && (
              <p className="smp-small smp-share-note" role="status">
                {shareNote}
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
