import { useEffect, useMemo, useRef, useState } from 'react';
import MnemoqLogo from './MnemoqLogo';
import { LanguageToggle, useI18n } from '../i18n';
import { checkTypedAnswer } from '../quiz';
import {
  CHECKPOINTS,
  PILOT_MAX_CARDS,
  PILOT_MIN_CARDS,
  daysUntil,
  isLockedIn,
  planDates,
  retentionAt,
} from '../pilot';
import {
  DEFAULT_SUBJECT,
  canonicalCategory,
  canonicalSubject,
  cleanName,
  getCategories,
  getSubjectNames,
  isReservedName,
  subjectAccent,
} from '../subjects';
import { requestStarterSet } from '../aiGenerate';
import { STARTER_CARDS, STARTER_TOPICS } from '../starterSets';

const EXAM_STEPS = ['story', 'curve', 'log', 'recall', 'plan'];
const AI_STEPS = ['story', 'ask', 'set', 'recall', 'plan'];
const UPCOMING_STEPS = ['story', 'topics', 'starter', 'recall', 'plan'];
const COUNT_CHOICES = [5, 8, 10];
const STARTER_MAX = 20;
const STARTER_PER_TOPIC = 3;

function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(date, locale) {
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// Step 2: the forgetting-curve toy
//
// It plays by itself first (a short demo with reviews on days 1, 3 and 7), then
// the person can try it: time keeps running and they just tap "Review".
// ---------------------------------------------------------------------------
const CHART = { w: 560, h: 240, left: 44, right: 12, top: 12, bottom: 34, days: 14 };
const DEMO_REVIEWS = [1, 3, 7];
const PLAY_SPEED = 0.8;
// The demo is a short script. Each beat sets a caption, runs time forward to a
// day (at `speed` days per second), optionally reviews there, then holds so the
// caption can be read. Nothing moves while a caption is being read.
const BEATS = [
  { cap: 'd1', to: 0, speed: 1, hold: 3800 },
  { cap: 'd2', to: 1, speed: 0.4, after: 'd3', hold: 4600 },
  { cap: 'd4', to: 1, speed: 1, review: true, hold: 4200 },
  { cap: 'd5', to: 3, speed: 0.45, review: true, after: 'd6', hold: 4600 },
  { cap: 'd7', to: 7, speed: 0.6, review: true, after: 'd8', hold: 5200 },
  { cap: 'd9', to: 14, speed: 0.9, hold: 0 },
];
const MIN_GAP_DAYS = 1; // a review button cooldown, so tapping repeatedly is not the whole game
const NUDGE_BELOW = 60; // "good moment to review" under this percentage

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function CurveToy() {
  const { t } = useI18n();
  const reduced = useMemo(prefersReducedMotion, []);
  // demo (playing by itself) -> demoDone -> play (their turn) -> ended
  const [mode, setMode] = useState(reduced ? 'demoDone' : 'intro');
  const [time, setTime] = useState(reduced ? CHART.days : 0);
  const [reviews, setReviews] = useState(reduced ? DEMO_REVIEWS : []);
  const [running, setRunning] = useState(false);
  const [demoCap, setDemoCap] = useState('d1');
  const beatRef = useRef({ i: 0, entered: false, arrived: false, holdUntil: 0, holdLeft: 0 });
  const timeRef = useRef(reduced ? CHART.days : 0);
  const reviewsRef = useRef(reduced ? DEMO_REVIEWS : []);

  const x = (d) => CHART.left + (d / CHART.days) * (CHART.w - CHART.left - CHART.right);
  const y = (pct) => CHART.top + ((100 - pct) / 100) * (CHART.h - CHART.top - CHART.bottom);

  function setAll(nextTime, nextReviews) {
    timeRef.current = nextTime;
    reviewsRef.current = nextReviews;
    setTime(nextTime);
    setReviews(nextReviews);
  }

  // The clock. One loop for the scripted demo and for the person's turn.
  useEffect(() => {
    if (!running) return undefined;

    const beat = beatRef.current;
    let frameId;
    let last = performance.now();

    // Resuming after a pause: give the current caption the time it had left.
    if (mode === 'demo' && beat.arrived) beat.holdUntil = last + beat.holdLeft;

    function frame(now) {
      const dt = Math.min(0.1, (now - last) / 1000);

      last = now;

      if (mode === 'demo') {
        const b = BEATS[beat.i];

        if (!beat.entered) {
          setDemoCap(b.cap);
          beat.entered = true;
        }

        if (!beat.arrived) {
          if (timeRef.current < b.to) {
            timeRef.current = Math.min(b.to, timeRef.current + dt * b.speed);
            setTime(timeRef.current);
          }

          if (timeRef.current >= b.to) {
            beat.arrived = true;

            if (b.review && !reviewsRef.current.includes(b.to)) {
              reviewsRef.current = [...reviewsRef.current, b.to];
              setReviews(reviewsRef.current);
            }

            if (b.after) setDemoCap(b.after);
            beat.holdUntil = now + b.hold;
          }
        } else if (now >= beat.holdUntil) {
          beat.i += 1;
          beat.entered = false;
          beat.arrived = false;

          if (beat.i >= BEATS.length) {
            setRunning(false);
            setMode('demoDone');
            return;
          }
        }

        frameId = requestAnimationFrame(frame);
        return;
      }

      // Their turn: time just keeps flowing.
      const next = timeRef.current + dt * PLAY_SPEED;

      if (next >= CHART.days) {
        timeRef.current = CHART.days;
        setTime(CHART.days);
        setRunning(false);
        setMode('ended');
        return;
      }

      timeRef.current = next;
      setTime(next);
      frameId = requestAnimationFrame(frame);
    }

    frameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameId);
      beat.holdLeft = Math.max(0, beat.holdUntil - performance.now());
    };
  }, [running, mode]);

  function startDemo() {
    beatRef.current = { i: 0, entered: false, arrived: false, holdUntil: 0, holdLeft: 0 };
    setDemoCap('d1');
    setAll(0, []);
    setMode('demo');
    setRunning(true);
  }

  function startPlay() {
    setAll(0, []);
    setMode('play');
    setRunning(!reduced);
  }

  function reviewNow() {
    const day = Math.round(timeRef.current * 10) / 10;
    const lastReview = reviewsRef.current[reviewsRef.current.length - 1];

    if (day < 0.3 || (lastReview !== undefined && day - lastReview < MIN_GAP_DAYS)) return;

    setAll(timeRef.current, [...reviewsRef.current, day]);
  }

  function scrub(value) {
    setRunning(false);
    setAll(value, reviewsRef.current.filter((day) => day <= value));
  }

  const withNow = retentionAt(time, reviews);
  const plainNow = retentionAt(time, []);

  const paths = useMemo(() => {
    function build(reviewDays) {
      const points = [];
      const stop = Math.round(time * 10) / 10;

      for (let d = 0; d <= stop + 0.0001; d += 0.1) {
        const rounded = Math.round(d * 10) / 10;

        // Draw each reset as a vertical jump at the review moment.
        if (reviewDays.includes(rounded)) {
          points.push([rounded, retentionAt(rounded - 0.0001, reviewDays.filter((r) => r < rounded))]);
        }

        points.push([rounded, retentionAt(rounded, reviewDays)]);
      }

      if (time > stop) points.push([time, retentionAt(time, reviewDays)]);

      return points
        .map(([d, pct], i) => `${i === 0 ? 'M' : 'L'}${x(d).toFixed(1)},${y(pct).toFixed(1)}`)
        .join(' ');
    }

    return { plain: build([]), withReviews: build(reviews) };
  }, [time, reviews]); // eslint-disable-line react-hooks/exhaustive-deps

  // What the caption says. It changes only at the key moments, so a screen
  // reader is not interrupted on every frame.
  const pct = (value) => (value < 1 ? '<1' : Math.round(value));
  const vars = { with: pct(withNow), without: pct(plainNow), n: reviews.length };
  let caption;

  if (mode === 'demo' || mode === 'demoDone') {
    caption = mode === 'demoDone' ? t('pilot.curve.s5', vars) : t(`pilot.curve.${demoCap}`);
  } else if (mode === 'ended') {
    caption =
      reviews.length === 0
        ? t('pilot.curve.endedNone', vars)
        : t(reviews.length === 1 ? 'pilot.curve.endedOne' : 'pilot.curve.endedSome', vars);
  } else if (!running && time > 0 && !reduced) {
    caption = t('pilot.curve.paused');
  } else if (running && withNow < NUDGE_BELOW) {
    caption = t('pilot.curve.playNudge');
  } else {
    caption = t('pilot.curve.play1');
  }

  const lastReviewDay = reviews[reviews.length - 1];
  const cooling = lastReviewDay !== undefined && time - lastReviewDay < MIN_GAP_DAYS;
  const nudge = mode === 'play' && withNow < NUDGE_BELOW;
  const demoLike = mode === 'demo' || mode === 'demoDone';
  const showExplain = mode === 'intro' || (reduced && mode === 'demoDone');

  return (
    <div className="pilot-curve">
      {showExplain && (
        <div className="pilot-explain">
          <p>{t('pilot.curve.introWho')}</p>
          <p>{t('pilot.curve.introFix')}</p>
          {mode === 'intro' && (
            <button type="button" className="primary-button" onClick={startDemo}>
              {t('pilot.curve.introGo')}
            </button>
          )}
        </div>
      )}

      <div className="pilot-readout" aria-hidden="true">
        <span className="pilot-readout-item">
          <i className="pilot-swatch pilot-swatch-plain" /> {t('pilot.curve.noReview')}
          <strong>{pct(plainNow)}%</strong>
        </span>
        <span className="pilot-readout-item">
          <i className="pilot-swatch pilot-swatch-review" /> {t('pilot.curve.withReview')}
          <strong className="pilot-readout-good">{pct(withNow)}%</strong>
        </span>
        <span className="pilot-readout-day">{t('pilot.curve.day', { n: Math.floor(time) })}</span>
      </div>

      <svg viewBox={`0 0 ${CHART.w} ${CHART.h}`} role="img" aria-label={t('pilot.curve.title')} className="pilot-curve-svg">
        {[0, 50, 100].map((pct) => (
          <g key={pct}>
            <line x1={CHART.left} x2={CHART.w - CHART.right} y1={y(pct)} y2={y(pct)} className="pilot-grid" />
            <text x={CHART.left - 6} y={y(pct) + 4} textAnchor="end" className="pilot-axis">{pct}%</text>
          </g>
        ))}
        {[0, 7, 14].map((d) => (
          <text key={d} x={x(d)} y={CHART.h - 12} textAnchor="middle" className="pilot-axis">{d}</text>
        ))}
        <text x={(CHART.left + CHART.w - CHART.right) / 2} y={CHART.h} textAnchor="middle" className="pilot-axis">
          {t('pilot.curve.axisX')}
        </text>

        <path d={paths.plain} className="pilot-line pilot-line-plain" />
        <path d={paths.withReviews} className="pilot-line pilot-line-review" />

        {reviews.filter((day) => day <= time).map((day) => (
          <g key={day}>
            <circle cx={x(day)} cy={y(100)} r="4" className="pilot-review-dot" />
            <circle cx={x(day)} cy={y(100)} r="4" className="pilot-ripple" />
          </g>
        ))}

        <circle cx={x(time)} cy={y(plainNow)} r="4" className="pilot-now-dot pilot-now-plain" />
        <circle cx={x(time)} cy={y(withNow)} r="5" className="pilot-now-dot" />
      </svg>

      {mode !== 'intro' && (
      <p className={`pilot-caption${nudge ? ' pilot-caption-nudge' : ''}`} role="status" aria-live="polite">
        {demoLike && <span className="pilot-badge-demo">{t('pilot.curve.demo')}</span>}
        {caption}
      </p>
      )}

      {mode === 'demo' && (
        <div className="pilot-curve-actions">
          <button type="button" className="pilot-link" onClick={() => setRunning((current) => !current)}>
            {running ? t('pilot.curve.pause') : t('pilot.curve.resume')}
          </button>
          <button type="button" className="pilot-link" onClick={() => { setRunning(false); setAll(CHART.days, DEMO_REVIEWS); setMode('demoDone'); }}>
            {t('pilot.curve.skip')}
          </button>
        </div>
      )}

      {mode === 'demoDone' && (
        <div className="pilot-curve-actions">
          <button type="button" className="primary-button" onClick={startPlay}>{t('pilot.curve.tryIt')}</button>
          {!reduced && (
            <button type="button" className="pilot-link" onClick={startDemo}>{t('pilot.curve.replay')}</button>
          )}
        </div>
      )}

      {(mode === 'play' || mode === 'ended') && (
        <>
          <div className="pilot-curve-actions">
            <button
              type="button"
              className={`primary-button pilot-review-btn${nudge ? ' nudge' : ''}`}
              disabled={mode === 'ended' || time < 0.3 || cooling}
              onClick={reviewNow}
            >
              {t('pilot.curve.review')}
            </button>
            {mode === 'play' && (
              <button type="button" className="pilot-link" onClick={() => setRunning((current) => !current)}>
                {running ? t('pilot.curve.pause') : t('pilot.curve.resume')}
              </button>
            )}
            <button type="button" className="pilot-link" onClick={startPlay}>{t('pilot.curve.reset')}</button>
            <span className="pilot-muted">{t('pilot.curve.reviews', { n: reviews.length })}</span>
          </div>

          <label className="pilot-slider-label" htmlFor="pilot-day">{t('pilot.curve.slider')}</label>
          <input
            id="pilot-day"
            type="range"
            min="0"
            max={CHART.days}
            step="0.1"
            value={time}
            onChange={(event) => scrub(Number(event.target.value))}
            className="pilot-slider"
          />
        </>
      )}

      <p className="pilot-muted">{t('pilot.curve.note')}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: log 3 to 5 mistakes
// ---------------------------------------------------------------------------
function LogStep({ cards, addCard, logged, setLogged, onDone }) {
  const { t } = useI18n();
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [category, setCategory] = useState(getCategories(DEFAULT_SUBJECT, cards)[0] || 'General');
  const [question, setQuestion] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [yourAnswer, setYourAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const subjectNames = getSubjectNames(cards);
  const categories = getCategories(subject, cards);
  const full = logged.length >= PILOT_MAX_CARDS;

  async function handleAdd(event) {
    event.preventDefault();
    if (saving || full) return;

    if (!question.trim() || !correctAnswer.trim()) {
      setError(t('pilot.log.required'));
      return;
    }

    setError('');
    setSaving(true);

    const result = await addCard({ subject, category, question, correctAnswer, yourAnswer, explanation });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setLogged((current) => [
      ...current,
      { id: result.id, question: question.trim(), correctAnswer: correctAnswer.trim(), yourAnswer: yourAnswer.trim() },
    ]);
    setQuestion('');
    setCorrectAnswer('');
    setYourAnswer('');
    setExplanation('');
  }

  return (
    <>
      <h2>{t('pilot.log.title')}</h2>
      <p className="subtitle">{t('pilot.log.sub')}</p>

      <p className="pilot-counter" aria-live="polite">
        <strong>{t('pilot.log.counter', { n: logged.length })}</strong>
        {logged.length < PILOT_MIN_CARDS && <span className="pilot-muted"> · {t('pilot.log.need')}</span>}
        {full && <span className="pilot-muted"> · {t('pilot.log.max')}</span>}
      </p>

      {logged.length > 0 && (
        <ol className="pilot-logged" aria-label={t('pilot.log.added')}>
          {logged.map((card) => (
            <li key={card.id}>
              <span>{card.question}</span>
              <strong>{card.correctAnswer}</strong>
            </li>
          ))}
        </ol>
      )}

      {!full && (
        <form onSubmit={handleAdd} className="pilot-form">
          <div className="pilot-row">
            <div>
              <label htmlFor="pilot-subject">{t('pilot.log.subject')}</label>
              <select
                id="pilot-subject"
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value);
                  setCategory(getCategories(event.target.value, cards)[0] || 'General');
                }}
              >
                {subjectNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pilot-category">{t('pilot.log.category')}</label>
              <select id="pilot-category" value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <label htmlFor="pilot-question">{t('pilot.log.question')}</label>
          <textarea
            id="pilot-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t('pilot.log.questionPh')}
            rows={2}
          />

          <label htmlFor="pilot-correct">{t('pilot.log.correct')}</label>
          <input
            id="pilot-correct"
            value={correctAnswer}
            onChange={(event) => setCorrectAnswer(event.target.value)}
            placeholder={t('pilot.log.correctPh')}
            autoComplete="off"
          />

          <label htmlFor="pilot-wrong">{t('pilot.log.wrong')}</label>
          <input
            id="pilot-wrong"
            value={yourAnswer}
            onChange={(event) => setYourAnswer(event.target.value)}
            placeholder={t('pilot.log.wrongPh')}
            autoComplete="off"
          />

          <label htmlFor="pilot-hook">{t('pilot.log.hook')}</label>
          <input
            id="pilot-hook"
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            placeholder={t('pilot.log.hookPh')}
            autoComplete="off"
          />

          {error && <p className="qa-message qa-error" role="alert">{error}</p>}

          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? t('pilot.log.saving') : t('pilot.log.add')}
          </button>
        </form>
      )}

      <div className="pilot-actions">
        <button
          type="button"
          className="primary-button"
          disabled={logged.length < PILOT_MIN_CARDS}
          onClick={onDone}
        >
          {t('pilot.log.done')}
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Exam-coming path (AI), step 2: say exactly what you want to practise
// ---------------------------------------------------------------------------
function AskStep({ cards, request, setRequest, examDate, setExamDate, onGenerate, onCurated }) {
  const { t } = useI18n();
  const [error, setError] = useState('');
  const subjectNames = getSubjectNames(cards);

  function update(field, value) {
    setRequest((current) => ({ ...current, [field]: value }));
    setError('');
  }

  function submit(event) {
    event.preventDefault();

    const subject = cleanName(request.subject);
    const topic = request.topic.trim();

    if (!subject || topic.length < 3) {
      setError(t('pilot.ai.need'));
      return;
    }

    if (isReservedName(subject)) {
      setError(t('pilot.ai.reserved'));
      return;
    }

    onGenerate();
  }

  return (
    <form onSubmit={submit} className="pilot-form">
      <h2>{t('pilot.ai.title')}</h2>
      <p className="subtitle">{t('pilot.ai.sub')}</p>

      <label htmlFor="pilot-ai-subject">{t('pilot.ai.subject')}</label>
      <input
        id="pilot-ai-subject"
        list="pilot-ai-subjects"
        value={request.subject}
        onChange={(event) => update('subject', event.target.value)}
        placeholder={t('pilot.ai.subjectPh')}
        maxLength={60}
        autoComplete="off"
      />
      <datalist id="pilot-ai-subjects">
        {subjectNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <label htmlFor="pilot-ai-topic">{t('pilot.ai.topic')}</label>
      <textarea
        id="pilot-ai-topic"
        rows={2}
        value={request.topic}
        onChange={(event) => update('topic', event.target.value)}
        placeholder={t('pilot.ai.topicPh')}
        maxLength={120}
      />

      <label htmlFor="pilot-ai-notes">{t('pilot.ai.notes')}</label>
      <input
        id="pilot-ai-notes"
        value={request.notes}
        onChange={(event) => update('notes', event.target.value)}
        placeholder={t('pilot.ai.notesPh')}
        maxLength={200}
        autoComplete="off"
      />

      <p className="pilot-topics-label" id="pilot-ai-count-label">{t('pilot.ai.count')}</p>
      <div className="pilot-chips" role="group" aria-labelledby="pilot-ai-count-label">
        {COUNT_CHOICES.map((n) => (
          <button
            key={n}
            type="button"
            className={`pilot-chip${request.count === n ? ' on' : ''}`}
            aria-pressed={request.count === n}
            onClick={() => update('count', n)}
          >
            {n}
          </button>
        ))}
      </div>

      <label htmlFor="pilot-exam-date">{t('pilot.up.date')}</label>
      <input
        id="pilot-exam-date"
        type="date"
        min={todayString()}
        value={examDate}
        onChange={(event) => setExamDate(event.target.value)}
      />
      <p className="pilot-muted">{t('pilot.up.dateHint')}</p>

      {error && <p className="qa-message qa-error" role="alert">{error}</p>}

      <div className="pilot-actions">
        <button type="submit" className="primary-button">{t('pilot.ai.generate')}</button>
        <button type="button" className="pilot-link" onClick={onCurated}>{t('pilot.ai.fallback')}</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Exam-coming path (AI), step 3: write, check, review, add
// ---------------------------------------------------------------------------
function SetStep({ cards, request, addCard, setLogged, onDone, onBack, onCurated }) {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState('loading'); // loading | done | error
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [progress, setProgress] = useState(null);
  const [addError, setAddError] = useState('');
  const [phase, setPhase] = useState(0);
  const startedRef = useRef(false);
  const controllerRef = useRef(null);

  async function run() {
    controllerRef.current?.abort();
    const controller = new AbortController();

    controllerRef.current = controller;
    setStatus('loading');
    setError(null);
    setAddError('');
    setPhase(0);

    try {
      const result = await requestStarterSet(
        {
          subject: cleanName(request.subject),
          topic: request.topic.trim(),
          notes: request.notes.trim(),
          count: request.count,
          language: lang,
        },
        controller.signal
      );

      setData(result);
      setSelected(result.cards.map((_, index) => index));
      setStatus('done');
    } catch (caught) {
      if (caught?.name === 'AbortError') return;
      setError({ message: caught?.message || 'Something went wrong.', code: caught?.code });
      setStatus('error');
    }
  }

  // One request per opening, even if React runs this effect twice in development.
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      run();
    }

    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Honest progress words while we wait: write, then double-check.
  useEffect(() => {
    if (status !== 'loading') return undefined;

    const timer = setInterval(() => setPhase((current) => Math.min(current + 1, 2)), 5000);

    return () => clearInterval(timer);
  }, [status]);

  function toggle(index) {
    setSelected((current) =>
      current.includes(index) ? current.filter((x) => x !== index) : [...current, index]
    );
  }

  async function addSelected() {
    const chosen = data.cards.filter((_, index) => selected.includes(index));

    if (chosen.length === 0 || progress) return;

    const subject = canonicalSubject(request.subject, cards);
    const category = canonicalCategory(
      subject,
      cleanName(data.category) || cleanName(request.topic) || 'General',
      cards
    );
    const added = [];

    setAddError('');

    for (let i = 0; i < chosen.length; i += 1) {
      setProgress({ done: i, n: chosen.length });
      const card = chosen[i];
      // eslint-disable-next-line no-await-in-loop
      const result = await addCard({
        subject,
        category,
        question: card.question,
        correctAnswer: card.correctAnswer,
        yourAnswer: '',
        explanation: card.hook || '',
        distractors: card.wrongAnswers,
      });

      if (result.error) {
        setAddError(result.error);
        setProgress(null);
        // Keep what was saved so it still counts if they carry on later.
        if (added.length > 0) setLogged(added);
        return;
      }

      added.push({ id: result.id, question: card.question, correctAnswer: card.correctAnswer, yourAnswer: '' });
    }

    setLogged(added);
    setProgress(null);
    onDone();
  }

  const canRetry = error && !['limit', 'config', 'auth', 'input'].includes(error.code);

  if (status === 'loading') {
    return (
      <div className="pilot-loading" role="status" aria-live="polite">
        <span className="ai-dots" aria-hidden="true"><i /><i /><i /></span>
        <h2>{t('pilot.ai.writing')}</h2>
        <p className="subtitle">{t(`pilot.ai.step${phase + 1}`)}</p>
        <p className="pilot-muted">{t('pilot.ai.writingHint')}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <>
        <h2>{t('pilot.ai.title')}</h2>
        <div className="pilot-result pilot-result-wrong" role="alert">
          <p>{error.message}</p>
        </div>
        <div className="pilot-actions">
          {canRetry && (
            <button type="button" className="primary-button" onClick={run}>{t('pilot.ai.retry')}</button>
          )}
          <button type="button" className={canRetry ? 'pilot-link' : 'primary-button'} onClick={onBack}>
            {t('pilot.aiset.back')}
          </button>
          <button type="button" className="pilot-link" onClick={onCurated}>{t('pilot.ai.fallback')}</button>
        </div>
      </>
    );
  }

  const list = data.cards;

  return (
    <>
      <h2>{t('pilot.aiset.title', { topic: request.topic.trim() })}</h2>
      <p className="subtitle">{t('pilot.aiset.sub')}</p>

      <p className={`pilot-note ${data.verified ? '' : 'pilot-note-warn'}`}>
        {data.verified ? t('pilot.aiset.verified') : t('pilot.aiset.unverified')}
        {list.length < data.requested && ` ${t('pilot.aiset.fewer', { asked: data.requested, got: list.length })}`}
      </p>

      <p className="pilot-counter" aria-live="polite">
        <strong>{t('pilot.aiset.chosen', { n: selected.length, total: list.length })}</strong>
      </p>

      <ul className="pilot-starter-list pilot-ai-list">
        {list.map((card, index) => {
          const on = selected.includes(index);

          return (
            <li key={card.question}>
              <label className="pilot-starter-item">
                <input type="checkbox" checked={on} onChange={() => toggle(index)} />
                <span>
                  <span>{card.question}</span>
                  <span className="pilot-ai-answer">
                    <small>{t('pilot.aiset.answer')}</small> ✓ {card.correctAnswer}
                  </span>
                  {card.hook && (
                    <span className="pilot-ai-hook">
                      <small>{t('pilot.aiset.hook')}</small> {card.hook}
                    </span>
                  )}
                  <span className="pilot-ai-wrong">
                    <small>{t('pilot.aiset.options')}</small> {card.wrongAnswers.join(' · ')}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {addError && <p className="qa-message qa-error" role="alert">{addError}</p>}

      <div className="pilot-actions">
        <button
          type="button"
          className="primary-button"
          disabled={selected.length === 0 || Boolean(progress)}
          onClick={addSelected}
        >
          {progress
            ? t('pilot.aiset.adding', { done: progress.done, n: progress.n })
            : t('pilot.aiset.add', { n: selected.length })}
        </button>
        <button type="button" className="pilot-link" disabled={Boolean(progress)} onClick={run}>
          {t('pilot.aiset.more')}
        </button>
        <button type="button" className="pilot-link" disabled={Boolean(progress)} onClick={onBack}>
          {t('pilot.aiset.back')}
        </button>
      </div>

      {typeof data.remaining === 'number' && (
        <p className="pilot-muted">{t('pilot.aiset.left', { n: data.remaining })}</p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Exam-coming path, step 2: exam date and weak topics
// ---------------------------------------------------------------------------
function TopicsStep({ topics, setTopics, examDate, setExamDate, onNext }) {
  const { t } = useI18n();

  function toggle(subject, category) {
    const id = `${subject}|${category}`;

    setTopics((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  return (
    <>
      <h2>{t('pilot.up.title')}</h2>
      <p className="subtitle">{t('pilot.up.sub')}</p>

      <label htmlFor="pilot-exam-date">{t('pilot.up.date')}</label>
      <input
        id="pilot-exam-date"
        type="date"
        min={todayString()}
        value={examDate}
        onChange={(event) => setExamDate(event.target.value)}
      />
      <p className="pilot-muted">{t('pilot.up.dateHint')}</p>

      <p className="pilot-topics-label">{t('pilot.up.topics')}</p>
      {STARTER_TOPICS.map(({ subject, categories }) => (
        <div key={subject} className="pilot-topic-group">
          <strong style={{ color: subjectAccent(subject) }}>{subject}</strong>
          <div className="pilot-chips">
            {categories.map((category) => {
              const on = topics.includes(`${subject}|${category}`);

              return (
                <button
                  key={category}
                  type="button"
                  className={`pilot-chip${on ? ' on' : ''}`}
                  aria-pressed={on}
                  onClick={() => toggle(subject, category)}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="pilot-actions">
        <button type="button" className="primary-button" disabled={topics.length === 0} onClick={onNext}>
          {t('pilot.up.cta')}
        </button>
        {topics.length === 0 && <span className="pilot-muted">{t('pilot.up.need')}</span>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Exam-coming path, step 3: pick from the curated starter set and add it
// ---------------------------------------------------------------------------
function StarterStep({ topics, addCard, setLogged, onDone }) {
  const { t } = useI18n();
  const available = useMemo(
    () => STARTER_CARDS.filter((card) => topics.includes(`${card.subject}|${card.category}`)),
    [topics]
  );

  // Start with a few from each topic, up to the cap.
  const [selected, setSelected] = useState(() => {
    const perTopic = {};
    const picked = [];

    for (const card of available) {
      const key = `${card.subject}|${card.category}`;
      perTopic[key] = (perTopic[key] || 0) + 1;
      if (perTopic[key] <= STARTER_PER_TOPIC && picked.length < STARTER_MAX) picked.push(card.id);
    }

    return picked;
  });
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  const atMax = selected.length >= STARTER_MAX;

  function toggle(id) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      return current.length >= STARTER_MAX ? current : [...current, id];
    });
  }

  async function addSelected() {
    const chosen = available.filter((card) => selected.includes(card.id));

    if (chosen.length === 0 || progress) return;

    setError('');
    const added = [];

    for (let i = 0; i < chosen.length; i += 1) {
      setProgress({ done: i, n: chosen.length });
      const card = chosen[i];
      // eslint-disable-next-line no-await-in-loop
      const result = await addCard({
        subject: card.subject,
        category: card.category,
        question: card.question,
        correctAnswer: card.correctAnswer,
        yourAnswer: '',
        explanation: card.explanation,
      });

      if (result.error) {
        setError(result.error);
        setProgress(null);
        // Keep what was already saved so it still counts.
        if (added.length > 0) setLogged(added);
        return;
      }

      added.push({ id: result.id, question: card.question, correctAnswer: card.correctAnswer, yourAnswer: '' });
    }

    setLogged(added);
    setProgress(null);
    onDone();
  }

  return (
    <>
      <h2>{t('pilot.starter.title')}</h2>
      <p className="subtitle">{t('pilot.starter.sub')}</p>
      <p className="pilot-counter" aria-live="polite">
        <strong>{t('pilot.starter.selected', { n: selected.length, max: STARTER_MAX })}</strong>
        {atMax && <span className="pilot-muted"> · {t('pilot.starter.max', { max: STARTER_MAX })}</span>}
      </p>

      <ul className="pilot-starter-list">
        {available.map((card) => {
          const on = selected.includes(card.id);

          return (
            <li key={card.id}>
              <label className="pilot-starter-item">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!on && atMax}
                  onChange={() => toggle(card.id)}
                />
                <span>
                  <small style={{ color: subjectAccent(card.subject) }}>{card.category}</small>
                  <span>{card.question}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {error && <p className="qa-message qa-error" role="alert">{error}</p>}

      <div className="pilot-actions">
        <button
          type="button"
          className="primary-button"
          disabled={selected.length === 0 || Boolean(progress)}
          onClick={addSelected}
        >
          {progress
            ? t('pilot.starter.adding', { done: progress.done, n: progress.n })
            : t('pilot.starter.add', { n: selected.length })}
        </button>
        {selected.length === 0 && <span className="pilot-muted">{t('pilot.starter.none')}</span>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 4: first recall win
// ---------------------------------------------------------------------------
function RecallStep({ card, onDone }) {
  const { t } = useI18n();
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState(null);

  function check(event) {
    event.preventDefault();
    const outcome = checkTypedAnswer(typed, card.correctAnswer, card.yourAnswer);
    if (outcome !== 'empty') setResult(outcome);
  }

  const won = result === 'correct' || result === 'close';

  return (
    <>
      <h2>{t('pilot.recall.title')}</h2>
      <p className="subtitle">{t('pilot.recall.sub')}</p>

      <div className="pilot-question-card">{card.question}</div>

      {!won && (
        <form onSubmit={check} className="pilot-form">
          <input
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
              setResult(null);
            }}
            placeholder={t('pilot.recall.placeholder')}
            aria-label={t('pilot.recall.placeholder')}
            autoComplete="off"
            autoFocus
          />
          <button type="submit" className="primary-button">{t('pilot.recall.check')}</button>
        </form>
      )}

      {result === 'wrong' && (
        <div className="pilot-result pilot-result-wrong" role="status">
          <p>{t('pilot.recall.wrong')}</p>
          <p><strong>{t('pilot.recall.answerWas', { a: card.correctAnswer })}</strong></p>
          <button
            type="button"
            className="pilot-link"
            onClick={() => {
              setTyped('');
              setResult(null);
            }}
          >
            {t('pilot.recall.retry')}
          </button>
        </div>
      )}

      {won && (
        <div className="pilot-result pilot-result-win" role="status">
          <p className="pilot-win">{result === 'close' ? t('pilot.recall.close') : t('pilot.recall.correct')}</p>
          <p className="pilot-badge">★ {t('pilot.recall.badge')}</p>
        </div>
      )}

      <div className="pilot-actions">
        <button type="button" className="primary-button" disabled={!won} onClick={onDone}>
          {t('pilot.recall.cta')}
        </button>
        {!won && (
          <button type="button" className="pilot-link" onClick={onDone}>
            {t('pilot.recall.skip')}
          </button>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 5: Recovery Plan
// ---------------------------------------------------------------------------
function PlanStep({ count, startIso, examDate, onFinish, onReviewNow }) {
  const { t, locale } = useI18n();
  const dates = planDates(startIso, examDate ? `${examDate}T00:00:00` : null);
  const last = dates[dates.length - 1];

  return (
    <>
      <h2>{t('pilot.plan.title')}</h2>
      <p className="subtitle">
        {examDate
          ? daysUntil(examDate) === 0
            ? t('pilot.plan.subExamToday')
            : t('pilot.plan.subExam', { days: daysUntil(examDate) })
          : t('pilot.plan.sub', { date: formatDate(last.date, locale), n: count })}
      </p>

      <ol className="pilot-timeline">
        {dates.map((item) => (
          <li key={item.key}>
            <span className="pilot-dot" />
            <strong>{t(item.label)}</strong>
            <span className="pilot-muted">{formatDate(item.date, locale)}</span>
          </li>
        ))}
      </ol>

      <p className="pilot-muted">{t('pilot.plan.note')}</p>

      <div className="pilot-actions">
        <button type="button" className="primary-button" onClick={onFinish}>
          {t('pilot.plan.cta')}
        </button>
        <button type="button" className="pilot-link" onClick={onReviewNow}>
          {t('pilot.plan.review')}
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// The whole first run
// ---------------------------------------------------------------------------
export default function Pilot({ cards, addCard, onSkip, onChooseOther, onFinish }) {
  const { t } = useI18n();
  const [step, setStep] = useState('story');
  const [path, setPath] = useState('exam');
  const [mode, setMode] = useState('ai'); // 'ai' | 'curated'
  const [request, setRequest] = useState({ subject: '', topic: '', notes: '', count: 8 });
  const [topics, setTopics] = useState([]);
  const [examDate, setExamDate] = useState('');
  const [logged, setLogged] = useState([]);
  const [startedAt] = useState(() => new Date().toISOString());

  const STEPS = path === 'upcoming' ? (mode === 'ai' ? AI_STEPS : UPCOMING_STEPS) : EXAM_STEPS;
  const stepNumber = STEPS.indexOf(step) + 1;

  function finish(thenReview) {
    onFinish(
      { cardIds: logged.map((card) => card.id), startedAt, examDate: path === 'upcoming' && examDate ? examDate : null },
      thenReview
    );
  }

  return (
    <main className="pilot-page">
      <div className="pilot-card">
        <header className="pilot-header">
          <MnemoqLogo size={32} />
          <LanguageToggle />
        </header>

        {step !== 'story' && (
          <p className="pilot-step">{t('pilot.step', { n: stepNumber, total: STEPS.length })}</p>
        )}

        {step === 'story' && (
          <>
            <p className="eyebrow">{t('pilot.story.eyebrow')}</p>
            <h1>{t('pilot.story.title')}</h1>
            <p className="subtitle">{t('pilot.story.sub')}</p>

            <div className="pilot-stories">
              <button type="button" className="pilot-story pilot-story-main" onClick={() => setStep('curve')}>
                <strong>{t('pilot.story.exam')}</strong>
                <span>{t('pilot.story.examHint')}</span>
              </button>
              <button
                type="button"
                className="pilot-story"
                onClick={() => {
                  setPath('upcoming');
                  setMode('ai');
                  setStep('ask');
                }}
              >
                <strong>{t('pilot.story.upcoming')}</strong>
                <span>{t('pilot.story.upcomingHint')}</span>
              </button>
              <button type="button" className="pilot-story" onClick={onChooseOther}>
                <strong>{t('pilot.story.learn')}</strong>
                <span>{t('pilot.story.learnHint')}</span>
              </button>
            </div>
          </>
        )}

        {step === 'curve' && (
          <>
            <h2>{t('pilot.curve.title')}</h2>
            <p className="subtitle">{t('pilot.curve.sub')}</p>
            <CurveToy />
            <div className="pilot-actions">
              <button type="button" className="primary-button" onClick={() => setStep('log')}>
                {t('pilot.curve.cta')}
              </button>
            </div>
          </>
        )}

        {step === 'ask' && (
          <AskStep
            cards={cards}
            request={request}
            setRequest={setRequest}
            examDate={examDate}
            setExamDate={setExamDate}
            onGenerate={() => setStep('set')}
            onCurated={() => {
              setMode('curated');
              setStep('topics');
            }}
          />
        )}

        {step === 'set' && (
          <SetStep
            cards={cards}
            request={request}
            addCard={addCard}
            setLogged={setLogged}
            onDone={() => setStep('recall')}
            onBack={() => setStep('ask')}
            onCurated={() => {
              setMode('curated');
              setStep('topics');
            }}
          />
        )}

        {step === 'topics' && (
          <TopicsStep
            topics={topics}
            setTopics={setTopics}
            examDate={examDate}
            setExamDate={setExamDate}
            onNext={() => setStep('starter')}
          />
        )}

        {step === 'starter' && (
          <StarterStep
            topics={topics}
            addCard={addCard}
            setLogged={setLogged}
            onDone={() => setStep('recall')}
          />
        )}

        {step === 'log' && (
          <LogStep
            cards={cards}
            addCard={addCard}
            logged={logged}
            setLogged={setLogged}
            onDone={() => setStep('recall')}
          />
        )}

        {step === 'recall' && logged[0] && <RecallStep card={logged[0]} onDone={() => setStep('plan')} />}

        {step === 'plan' && (
          <PlanStep
            count={logged.length}
            startIso={startedAt}
            examDate={path === 'upcoming' ? examDate : ''}
            onFinish={() => finish(false)}
            onReviewNow={() => finish(true)}
          />
        )}

        {step !== 'plan' && (
          <button type="button" className="pilot-link pilot-skip" onClick={onSkip}>
            {t('pilot.skip')}
          </button>
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Recovery Plan card for the dashboard (return checkpoints)
// ---------------------------------------------------------------------------
export function RecoveryPlan({ pilot, cards, onHide, onReview, dueCount }) {
  const { t, locale } = useI18n();
  const mine = pilot.cardIds
    .map((id) => cards.find((card) => card.id === id))
    .filter(Boolean);

  if (mine.length === 0) return null;

  const lockedIn = mine.filter(isLockedIn).length;
  const now = new Date();
  const dates = planDates(pilot.startedAt, pilot.examDate ? `${pilot.examDate}T00:00:00` : null);
  const complete = lockedIn === mine.length;

  return (
    <section className="recovery-plan" aria-labelledby="recovery-plan-title">
      <div className="recovery-plan-head">
        <div>
          <p className="eyebrow">{t('plan.eyebrow')}</p>
          <h2 id="recovery-plan-title">
            {complete ? t('plan.complete', { n: mine.length }) : t('plan.title', { k: lockedIn, n: mine.length })}
          </h2>
          <p className="pilot-muted">{t('plan.sub')}</p>
        </div>
        <button type="button" className="pilot-link" onClick={onHide}>{t('plan.hide')}</button>
      </div>

      <div className="recovery-bar" role="progressbar" aria-valuemin={0} aria-valuemax={mine.length} aria-valuenow={lockedIn}>
        <span style={{ width: `${(lockedIn / mine.length) * 100}%` }} />
      </div>

      <ol className="pilot-timeline pilot-timeline-compact" aria-label={t('plan.checkpoint')}>
        {dates.map((item, index) => {
          const next = dates[index + 1];
          const state = now >= item.date && (!next || now < next.date) ? 'current' : now >= item.date ? 'past' : 'future';

          return (
            <li key={item.key} className={`pilot-${state}`}>
              <span className="pilot-dot" />
              <strong>{t(item.label)}</strong>
              <span className="pilot-muted">{formatDate(item.date, locale)}</span>
            </li>
          );
        })}
      </ol>

      {dueCount > 0 && !complete && (
        <button type="button" className="primary-button" onClick={onReview}>
          {t('plan.reviewDue')}
        </button>
      )}
    </section>
  );
}

export { CHECKPOINTS };
