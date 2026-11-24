import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { track } from '../track';
import { noteRoundDone } from '../install/runtime';
import { LanguageToggle, useI18n } from '../i18n';
import MnemoqLogo from '../components/MnemoqLogo';
import Jonaki from '../components/Jonaki';
import { CATEGORY_LABEL } from './questions';
import { BETS, ROUND_SIZE, dhakaDate, loadHistory, pointsFor, puzzleNumber, questionsFor, saveRound, scoreOf, streakOf } from './puzzle';
import { bnDigits, makeT } from './strings';
import { loadSettings, saveSettings, setMusicOn, setSoundOn, sfx } from './audio';
import { haptic, setHapticsOn } from './haptics';
import { NightSky, Sparks } from './Stage';
import ChargeLantern from './ChargeLantern';
import Result from './Result';
import '../polish.css';
import './daily.css';

// mnemoq.../daily: five questions a night, the same for everyone, playable
// without an account. Pick an answer, then hold the lantern to say how sure
// you are. Jonaki the firefly reacts to every move.

const LETTERS = ['A', 'B', 'C', 'D'];
const CATEGORY_ICON = { bangladesh: '🪷', science: '🔬', words: '✒️', numbers: '➗', world: '🌏' };

export default function Daily() {
  const { lang } = useI18n();
  const t = useMemo(() => makeT(lang), [lang]);
  const num = useCallback((n) => (lang === 'bn' ? bnDigits(n) : String(n)), [lang]);
  const number = useMemo(() => puzzleNumber(), []);
  const questions = useMemo(() => questionsFor(number), [number]);
  const [history, setHistory] = useState(loadHistory);
  const playedToday = history.plays[number];
  const [phase, setPhase] = useState(playedToday ? 'done' : 'intro');
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState(null);
  const [bet, setBet] = useState(null);
  const [charge, setCharge] = useState(0);
  const [marks, setMarks] = useState(playedToday?.marks || []);
  const [settings, setSettings] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [floater, setFloater] = useState(null);
  const sparks = useRef(null);
  const optionRefs = useRef([]);
  const lanternRef = useRef(null);

  const question = questions[step];
  const side = question?.[lang] || question?.en;
  const revealed = bet !== null;
  const correct = revealed && picked === question.answer;
  const score = scoreOf(marks);

  // The page is a dark "night" scene whatever the app theme is.
  useEffect(() => {
    document.body.classList.add('dly-body');
    return () => document.body.classList.remove('dly-body');
  }, []);

  useEffect(() => {
    document.title = `${t('title')} #${num(number)}`;
  }, [t, num, number]);

  useEffect(() => {
    setSoundOn(settings.sound);
    setHapticsOn(settings.haptics);
    saveSettings(settings);
  }, [settings]);

  function toggle(key) {
    setSettings((s) => {
      const next = { ...s, [key]: !s[key] };

      if (key === 'music') setMusicOn(next.music);
      if (key === 'sound' && next.sound) setTimeout(() => sfx.select(2), 0);
      if (key === 'haptics' && next.haptics) setTimeout(() => haptic.select(), 0);

      return next;
    });
  }

  function start() {
    sfx.start();
    haptic.select();
    if (settings.music) setMusicOn(true);
    track('daily_start', { page: 'daily', number, lang });
    setPhase('play');
  }

  function pick(i) {
    if (revealed) return;

    setPicked(i);
    sfx.select(i);
    haptic.select();
  }

  function centerOf(el) {
    const box = el?.getBoundingClientRect();

    return box ? [box.left + box.width / 2, box.top + box.height / 2] : [innerWidth / 2, innerHeight / 2];
  }

  function lockIn(betId) {
    if (picked === null || revealed) return;

    const isRight = picked === question.answer;
    const stake = BETS.find((b) => b.id === betId).stake;
    const points = pointsFor(isRight, betId);

    setBet(betId);
    setCharge(0);
    setMarks((list) => [...list, { id: question.id, picked, correct: isRight, bet: betId }]);
    setFloater({ key: `${step}-${betId}`, text: points > 0 ? `+${num(points)}` : points < 0 ? `−${num(-points)}` : num(0), good: points > 0 });

    if (isRight) {
      sfx.correct(stake);
      haptic.correct();
      const [x, y] = centerOf(optionRefs.current[picked]);
      sparks.current?.burst(x, y, { count: 14 + stake * 10, spread: 0.7 + stake * 0.25 });
      const [lx, ly] = centerOf(lanternRef.current?.children[step]);
      setTimeout(() => sparks.current?.burst(lx, ly, { count: 16, spread: 0.6 }), 260);
    } else {
      sfx.wrong(stake);
      haptic.wrong();
    }
  }

  function next() {
    sfx.next();
    haptic.tap();
    setFloater(null);

    if (step + 1 < ROUND_SIZE) {
      setStep(step + 1);
      setPicked(null);
      setBet(null);
      return;
    }

    const saved = saveRound(number, marks);

    setHistory(saved);
    setPhase('done');
    track('daily_finish', { page: 'daily', number, score: scoreOf(marks), lang });
    noteRoundDone('daily');
  }

  // Keyboard: 1-4 or A-D pick, Enter goes on (Space holds the lantern).
  useEffect(() => {
    if (phase !== 'play') return undefined;

    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return;

      const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());

      if (i >= 0 && !revealed && e.key.length === 1) pick(i);
      if (e.key === 'Enter' && revealed) next();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const mood = (() => {
    if (phase === 'intro') return 'idle';
    if (phase === 'done') return null;
    if (revealed) return correct ? (bet === 'sure' ? 'wow' : 'happy') : 'oops';
    if (charge > 0) return 'charge';
    return picked === null ? 'think' : 'idle';
  })();
  const glow = revealed ? (correct ? 0.6 + BETS.findIndex((b) => b.id === bet) * 0.2 : 0.15) : charge ? 0.4 + charge * 0.2 : undefined;
  const streak = streakOf(history, number);
  const dateLabel = new Date(`${dhakaDate()}T12:00:00`).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className={`dly dly-phase-${phase}`} lang={lang}>
      <NightSky glow={marks.filter((m) => m.correct).length / ROUND_SIZE} />
      <Sparks ref={sparks} />

      <header className="dly-top">
        <MnemoqLogo size={26} tagline={false} href="/" />
        <div className="dly-top-right">
          {phase === 'play' && (
            <span className="dly-score-pill" aria-label={`${score} ${t('points')}`}>
              <span key={score} className="dly-score-num">
                {num(score)}
              </span>
            </span>
          )}
          <button type="button" className="dly-icon-btn" aria-label={t('settings')} aria-expanded={showSettings} onClick={() => setShowSettings((v) => !v)}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.4-3.2c0-.5 0-.9-.1-1.3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.2-1.3L14.3 3h-4l-.4 2.4c-.8.3-1.5.8-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1c.7.5 1.4 1 2.2 1.3l.4 2.4h4l.4-2.4c.8-.3 1.5-.8 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.3Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {showSettings && (
          <div className="dly-settings" role="dialog" aria-label={t('settings')}>
            {['sound', 'music', 'haptics'].map((key) => (
              <label key={key} className="dly-switch">
                <span>{t(key)}</span>
                <input type="checkbox" checked={settings[key]} onChange={() => toggle(key)} />
                <i aria-hidden="true" />
              </label>
            ))}
            <div className="dly-switch">
              <span>{t('language')}</span>
              <LanguageToggle />
            </div>
          </div>
        )}
      </header>

      <main className="dly-main">
        {phase === 'intro' && (
          <section className="dly-intro">
            <Jonaki mood="idle" size={150} className="dly-hero-mascot" title="Jonaki" />
            <p className="dly-kicker">
              #{num(number)} · {dateLabel}
            </p>
            <h1 className="dly-title">{t('title')}</h1>
            <p className="dly-lead">{t('tagline')}</p>

            <div className="dly-lineup" aria-label={t('lineup')}>
              {questions.map((q, i) => (
                <span key={q.id} className="dly-lineup-item" style={{ animationDelay: `${0.25 + i * 0.09}s` }}>
                  <b aria-hidden="true">{CATEGORY_ICON[q.category]}</b>
                  {CATEGORY_LABEL[lang]?.[q.category] || CATEGORY_LABEL.en[q.category]}
                </span>
              ))}
            </div>

            <ol className="dly-rules">
              <li>{t('rule1')}</li>
              <li>{t('rule2')}</li>
              <li>{t('rule3')}</li>
            </ol>

            <button type="button" className="dly-play" onClick={start}>
              {t('start')}
            </button>
            {streak > 0 && <p className="dly-streak-note">🔥 {t('streakNote', { n: streak })}</p>}
          </section>
        )}

        {phase === 'play' && question && (
          <>
            <div className="dly-lanterns" ref={lanternRef} aria-label={t('question', { n: step + 1, total: ROUND_SIZE })}>
              {questions.map((q, i) => {
                const m = marks[i];
                const state = m ? (m.correct ? (m.bet === 'sure' ? 'lit bright' : 'lit') : 'out') : i === step ? 'now' : '';

                return <span key={q.id} className={`dly-lantern ${state}`} />;
              })}
            </div>

            <section key={step} className="dly-card dly-qcard">
              <div className="dly-q-head">
                <Jonaki mood={mood} glow={glow} size={72} />
                <div>
                  <p className="dly-meta">
                    <span>
                      {CATEGORY_ICON[question.category]} {CATEGORY_LABEL[lang]?.[question.category] || CATEGORY_LABEL.en[question.category]}
                    </span>
                    <span className="dly-level" aria-label={t('level', { n: question.level })}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <i key={i} className={i < question.level ? 'on' : ''} />
                      ))}
                    </span>
                  </p>
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
                      style={{ animationDelay: `${0.05 + i * 0.06}s` }}
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

              {!revealed && <ChargeLantern disabled={picked === null} t={t} lang={lang} onCharge={setCharge} onLock={lockIn} />}

              {revealed && (
                <div className={`dly-reveal ${correct ? 'ok' : 'miss'}`} aria-live="polite">
                  <p className="dly-verdict">{correct ? t('right') : t('wrong')}</p>
                  {!correct && <p className="dly-answer">{t('answerWas', { answer: side.options[question.answer] })}</p>}
                  <p className="dly-why">{side.why}</p>
                  {!correct && bet === 'sure' && (
                    <p className="dly-hyper">
                      <b>✦ {t('bright')}</b> {t('hypercorrect')}
                    </p>
                  )}
                  <button type="button" className="dly-play dly-next-btn" onClick={next} autoFocus>
                    {step + 1 < ROUND_SIZE ? t('next') : t('finish')}
                  </button>
                </div>
              )}
            </section>

            {floater && (
              <span key={floater.key} className={`dly-floater ${floater.good ? 'good' : 'bad'}`} aria-hidden="true">
                {floater.text}
              </span>
            )}
          </>
        )}

        {phase === 'done' && <Result number={number} marks={marks} questions={questions} history={history} t={t} lang={lang} num={num} sparks={sparks} />}
      </main>
    </div>
  );
}
