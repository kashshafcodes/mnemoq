import { useEffect, useMemo, useState } from 'react';
import Auth from '../Auth';
import { scoreSections } from '../diagnosticScore';
import { saveGuestResult } from '../guestResult';
import { LanguageToggle } from '../i18n';
import { NSU_ENGLISH } from '../mockBank/nsuEnglish.js';
import { NSU_QUANT } from '../mockBank/nsuQuant.js';
import { NSU_READING } from '../mockBank/nsuReading.js';
import { preparedFor } from '../mockBank';
import { SUBJECT_CATALOG } from '../paths';
import { FREE_BANK } from '../sat/bank';
import '../sat/sat.css';
import { track } from '../track';
import MnemoqLogo from './MnemoqLogo';
import SatTest from './sat/SatTest';

// A diagnostic anyone can take before signing up (mnemoq.../sat, .../nsu).
// The result is kept in the browser; signing up reveals the score and saves it
// to the new account (App.jsx imports it on first load).

const EXAMS = {
  sat: {
    name: 'Digital SAT',
    kicker: 'Free SAT diagnostic',
    title: 'Find your SAT score in 25 minutes',
    lead: 'Answer 24 questions from Reading and Writing and Math, the same skills as the real Digital SAT. No sign-up to start.',
    gets: ['A 400–1600 score estimate', 'Your strongest and weakest of the 27 skills', 'A plan for what to fix first'],
    minutes: 25,
    resultLabel: 'Your SAT estimate',
    resultLower: 'your 400–1600 SAT estimate',
  },
  brac: {
    name: 'BRAC University admission',
    kicker: 'Free BRAC admission check',
    title: 'How ready are you for BRAC University?',
    lead: 'Answer 24 questions in English, Mathematics, and Higher Maths & Physics, in the style of the BRAC admission test (four options, like the real paper). No sign-up to start.',
    gets: ['A readiness score out of 100', 'Your score in each section', 'The topics to fix first, as review cards'],
    minutes: 20,
    resultLabel: 'Your BRAC readiness',
    resultLower: 'your BRAC readiness score',
  },
  nsu: {
    name: 'NSU admission',
    kicker: 'Free NSU admission check',
    title: 'How ready are you for NSU?',
    lead: 'Answer 25 questions in English, Math and Reading, written in the style of the NSU admission test. No sign-up to start.',
    gets: ['A readiness score out of 100', 'Your score in each section', 'The topics to fix first, as review cards'],
    minutes: 20,
    resultLabel: 'Your NSU readiness',
    resultLower: 'your NSU readiness score',
  },
};

// 10 English, 10 Math, and a reading passage with 5 questions, spread across topics.
function nsuSections() {
  const every = (list, n) => list.filter((_, i) => i % Math.ceil(list.length / n) === 0).slice(0, n);
  const reading = NSU_READING[0];

  return [
    { id: 'english', name: SUBJECT_CATALOG.english?.name || 'English', questions: every(NSU_ENGLISH[0].questions, 10) },
    { id: 'quant', name: SUBJECT_CATALOG.quant?.name || 'Math', questions: every(NSU_QUANT[0].questions, 10) },
    { id: 'reading', name: SUBJECT_CATALOG.reading?.name || 'Reading', passage: reading.passage, title: reading.title, questions: reading.questions.slice(0, 5) },
  ];
}

// 8 English, 8 Mathematics and 8 Higher Maths & Physics from the BRAC sets
// that the mock tests use last, so the free check does not spoil mock 1.
function bracSections() {
  const bank = preparedFor('brac').sections;
  const lastOf = (list) => list[list.length - 1].questions;

  return [
    { id: 'english', name: 'English Language', questions: lastOf(bank.english).slice(0, 8) },
    { id: 'bmath', name: SUBJECT_CATALOG.bmath.name, questions: lastOf(bank.bmath).slice(0, 8) },
    { id: 'hmphys', name: SUBJECT_CATALOG.hmphys.name, questions: lastOf(bank.hmphys).slice(0, 8) },
  ];
}

function QuickQuiz({ build, onFinish, onQuit }) {
  const sections = useMemo(build, [build]);
  const flat = useMemo(() => sections.flatMap((s) => s.questions.map((q) => ({ ...q, section: s }))), [sections]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [startedAt] = useState(() => Date.now());
  const q = flat[index];
  const last = index === flat.length - 1;

  function finish() {
    const scored = scoreSections(sections, answers);
    const correct = scored.reduce((sum, s) => sum + s.correct, 0);

    onFinish({ kind: 'initial', sections: scored, correct, total: flat.length, seconds: Math.round((Date.now() - startedAt) / 1000) });
  }

  return (
    <section className="try-quiz">
      <header className="try-quiz-head">
        <span>
          {q.section.name} · Question {index + 1} of {flat.length}
        </span>
        <button type="button" className="text-link" onClick={onQuit}>
          Leave
        </button>
      </header>
      <div className="try-progress" aria-hidden="true">
        <span style={{ width: `${((index + 1) / flat.length) * 100}%` }} />
      </div>

      {q.section.passage && (
        <details className="try-passage" open={q.section.questions[0].id === q.id}>
          <summary>{q.section.title || 'Passage'}</summary>
          <p>{q.section.passage}</p>
        </details>
      )}

      <h2 className="try-question">{q.question}</h2>
      <div className="try-options" role="radiogroup" aria-label="Answers">
        {q.options.map((option, i) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={answers[q.id] === i}
            className={answers[q.id] === i ? 'try-option picked' : 'try-option'}
            onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
          >
            <span className="try-letter">{String.fromCharCode(65 + i)}</span>
            {option}
          </button>
        ))}
      </div>

      <footer className="try-nav">
        <button type="button" className="mq-btn mq-btn-ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Back
        </button>
        {last ? (
          <button type="button" className="mq-btn mq-btn-primary" onClick={finish}>
            See my result
          </button>
        ) : (
          <button type="button" className="mq-btn mq-btn-primary" onClick={() => setIndex(index + 1)}>
            {Number.isInteger(answers[q.id]) ? 'Next' : 'Skip'}
          </button>
        )}
      </footer>
    </section>
  );
}

export default function TryDiagnostic({ exam }) {
  const info = EXAMS[exam] || EXAMS.sat;
  const [phase, setPhase] = useState('intro'); // intro | run | gate
  const [result, setResult] = useState(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    track('landing_view', { page: `try-${exam}` });
  }, [exam]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [phase]);

  function start() {
    track('guest_diag_start', { exam });
    setRun(Date.now());
    setPhase('run');
  }

  function finish(next) {
    saveGuestResult(exam, next);
    track('guest_diag_done', { exam, correct: next.correct, total: next.total });
    setResult(next);
    setPhase('gate');
  }

  if (phase === 'run') {
    return (
      <div className="try-run">
        {exam === 'sat' ? (
          <div className="try-sat">
            <SatTest key={run} config={{ kind: 'diag', title: 'SAT diagnostic' }} bank={FREE_BANK} seen={new Set()} onFinish={finish} onQuit={() => setPhase('intro')} />
          </div>
        ) : (
          <QuickQuiz key={run} build={exam === 'brac' ? bracSections : nsuSections} onFinish={finish} onQuit={() => setPhase('intro')} />
        )}
      </div>
    );
  }

  const minutes = Math.max(1, Math.round((result?.seconds || 0) / 60));

  return (
    <div className="lp try">
      <header className="lp-nav">
        <MnemoqLogo size={30} href="/" />
        <div className="lp-nav-right">
          <LanguageToggle />
        </div>
      </header>

      {phase === 'intro' ? (
        <section className="try-intro">
          <p className="lp-kicker">{info.kicker}</p>
          <h1>{info.title}</h1>
          <p className="lp-lead">{info.lead}</p>
          <ul className="try-gets">
            {info.gets.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          <div className="lp-ctas">
            <button type="button" className="mq-btn mq-btn-primary mq-btn-lg" onClick={start}>
              Start now <span aria-hidden="true">→</span>
            </button>
          </div>
          <p className="try-fine">About {info.minutes} minutes. Free. Questions are original, written to match the real test.</p>
        </section>
      ) : (
        <section className="try-gate">
          <div className="try-result">
            <p className="lp-kicker">Done. Well done!</p>
            <h1>Your result is ready</h1>
            <p className="lp-lead">
              You answered {result.correct} of {result.total} correctly in {minutes} {minutes === 1 ? 'minute' : 'minutes'}. Create a free
              account to see {info.resultLower}, your section scores and what to fix first.
            </p>
            <div className="try-locked" aria-hidden="true">
              <span>{info.resultLabel}</span>
              <b>{exam === 'sat' ? '1•••' : '••'}</b>
              <i>Unlocks when you sign up</i>
            </div>
          </div>
          <Auth compact title="See my result" subtitle="Free account. Your result is saved to it straight away." />
        </section>
      )}
    </div>
  );
}
