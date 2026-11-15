import { useEffect, useMemo, useRef, useState } from 'react';
import { isAnswered, isCorrect, correctText, parseTyped, scoreItems } from '../../sat/answers';
import { buildDiagnostic, buildDrill, buildModule, routeFor } from '../../sat/assemble';
import { BANK_TOTALS } from '../../sat/bank/free';
import { BREAK_MINUTES, DRILL_LENGTH, LEVEL_NAMES, SECTIONS, SKILLS } from '../../sat/blueprint';
import { scaledFrom } from '../../sat/score';
import { formatClock } from '../../mocks';
import { NO_SUGGEST } from '../../noSuggest';

// Sitting a SAT set: the diagnostic, a drill, one timed module or a full
// adaptive test. The screen follows the real test app: the passage beside the
// question, a countdown for each module, mark for review, crossing out
// options, typed answers for Math, and no going back to a finished module.
//
//   config: { kind: 'diag' | 'drill' | 'module' | 'full', section?, skill?, title }
//   onFinish({ kind, sections, correct, total, seconds, limitSeconds, source })

const LETTERS = ['A', 'B', 'C', 'D'];
const DESMOS = 'https://www.desmos.com/testing/cb-digital-sat/graphing';

const FORMULAS = [
  ['Circle', 'Area = πr²   ·   Circumference = 2πr'],
  ['Rectangle', 'Area = length × width'],
  ['Triangle', 'Area = ½ × base × height'],
  ['Right triangle', 'a² + b² = c²'],
  ['Special right triangles', '30-60-90: sides x, x√3, 2x   ·   45-45-90: sides x, x, x√2'],
  ['Box', 'Volume = length × width × height'],
  ['Cylinder', 'Volume = πr²h'],
  ['Sphere', 'Volume = (4/3)πr³'],
  ['Cone', 'Volume = (1/3)πr²h'],
  ['Pyramid', 'Volume = (1/3) × length × width × height'],
  ['Angles', 'A circle has 360° (2π radians). The angles of a triangle add up to 180°.'],
];

// The stages of each kind of set. A stage is one screenful of questions with its own clock.
function stagesFor(config) {
  if (config.kind === 'diag') {
    return [
      { section: 'rw', build: 'diag', label: 'Reading and Writing', seconds: null },
      { section: 'math', build: 'diag', label: 'Math', seconds: null },
    ];
  }

  if (config.kind === 'drill') {
    return [{ section: SKILLS[config.skill].section, build: 'drill', label: SKILLS[config.skill].name, seconds: null }];
  }

  const timed = (section, module) => ({
    section,
    build: 'module',
    module,
    label: `${SECTIONS[section].name} · Module ${module}`,
    seconds: SECTIONS[section].moduleMinutes * 60,
  });

  if (config.kind === 'module') return [{ ...timed(config.section, 1), label: `${SECTIONS[config.section].name} · Timed module` }];

  return [timed('rw', 1), timed('rw', 2), { break: true, seconds: BREAK_MINUTES * 60 }, timed('math', 1), timed('math', 2)];
}

function introFor(config, bank, seen) {
  if (config.kind === 'diag') {
    return {
      title: 'Find your starting point',
      points: [
        '24 questions: 12 Reading and Writing, then 12 Math. About 25 minutes.',
        'There is no timer. Work carefully, and do not look anything up.',
        'It is not a grade. It gives you a first score estimate and shows which skills to work on.',
        'For Math you may use a calculator, as on the real test.',
      ],
    };
  }

  if (config.kind === 'drill') {
    const pool = bank.filter((q) => q.skill === config.skill);
    const fresh = pool.filter((q) => !seen.has(q.id)).length;
    const count = Math.min(DRILL_LENGTH, pool.length);
    const more = (BANK_TOTALS.bySkill[config.skill] || 0) - pool.length;
    const points = [
      `${count} questions on one skill, from easier to harder.`,
      'No timer. Check each answer and read the explanation before moving on.',
      'Your skill map updates when you finish.',
    ];

    if (fresh < count) {
      points.push(
        more > 0
          ? `You have already seen ${fresh === 0 ? 'all' : 'most'} of the free questions for this skill, so some will repeat. Pro has ${more} more.`
          : 'You have seen most of the questions for this skill, so some will repeat. Repeats still build recall.'
      );
    } else if (more > 0) {
      points.push(`This is the free starter set. Pro drills are ${DRILL_LENGTH} questions long, drawn from ${more} more in this skill.`);
    }

    return { title: `Drill: ${SKILLS[config.skill].name}`, points };
  }

  if (config.kind === 'module') {
    const s = SECTIONS[config.section];

    return {
      title: `${s.name}: one timed module`,
      points: [`${s.moduleQuestions} questions in ${s.moduleMinutes} minutes, the same as one module of the real test.`, 'You can move between questions and mark any to come back to.', 'When the time runs out, your answers are submitted.'],
    };
  }

  return {
    title: 'Full adaptive practice test',
    points: [
      'Four modules: two Reading and Writing (32 minutes each), a 10-minute break, then two Math (35 minutes each). About 2 hours 15 minutes.',
      'Like the real test, your second module in each section is harder or easier depending on your first.',
      'You cannot return to a module once it is finished. Sit it in one go, somewhere quiet.',
      'Open the calculator in another tab for the Math modules.',
    ],
  };
}

function Table({ table }) {
  return (
    <div className="sat-table-wrap">
      <table className="sat-table">
        <thead>
          <tr>
            {table.head.map((cell, i) => (
              <th key={i} scope="col">{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SatTest({ config, bank, seen, onFinish, onQuit }) {
  const stages = useMemo(() => stagesFor(config), [config]);
  const seed = useRef(Math.floor(Math.random() * 2147483647) + 1).current;
  const drill = config.kind === 'drill';

  const [phase, setPhase] = useState('intro'); // intro | run | review | break | saving
  const [stageIndex, setStageIndex] = useState(0);
  const [items, setItems] = useState([]);
  const [cur, setCur] = useState(0);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState({});
  const [crossed, setCrossed] = useState({});
  const [checked, setChecked] = useState({}); // drills: questions whose answer has been revealed
  const [crossMode, setCrossMode] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [hideClock, setHideClock] = useState(false);
  const [now, setNow] = useState(Date.now());

  const startedRef = useRef(Date.now());
  const stageStartRef = useRef(Date.now());
  const doneRef = useRef([]); // finished stages: { section, items, seconds, route }
  const usedRef = useRef(new Set(seen));
  const answersRef = useRef({});
  const advancingRef = useRef(false);
  const routeRef = useRef('mixed'); // the current stage's route
  const topRef = useRef(null);

  answersRef.current = answers;

  const stage = stages[stageIndex];
  const limit = stage?.seconds ?? null;
  const elapsed = (now - stageStartRef.current) / 1000;
  const remaining = limit === null ? null : Math.max(0, limit - elapsed);

  function toTop() {
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function buildStage(index) {
    const next = stages[index];
    const opts = { seen: usedRef.current, seed: seed + index * 7919 };
    let built;
    let route = 'mixed';

    if (next.build === 'diag') built = buildDiagnostic(bank, next.section, opts);
    else if (next.build === 'drill') built = buildDrill(bank, { skill: config.skill, ...opts });
    else {
      if (next.module === 2) {
        const first = doneRef.current.find((d) => d.section === next.section);
        const correct = first.items.filter((q) => isCorrect(q, answersRef.current[q.id])).length;

        route = routeFor(correct, first.items.length);
      }

      built = buildModule(bank, next.section, { ...opts, route });
    }

    for (const q of built) usedRef.current.add(q.id);

    return { built, route };
  }

  function enterStage(index) {
    const next = stages[index];

    advancingRef.current = false;
    setStageIndex(index);
    stageStartRef.current = Date.now();
    setNow(Date.now());
    setShowNav(false);
    setShowSheet(false);

    if (next.break) {
      setPhase('break');
      toTop();
      return;
    }

    const { built, route } = buildStage(index);

    routeRef.current = route;
    setItems(built);
    setCur(0);
    setPhase('run');
    toTop();
  }

  function finishAll() {
    setPhase('saving');

    const all = answersRef.current;
    const sections = [];

    for (const sectionId of ['rw', 'math']) {
      const parts = doneRef.current.filter((d) => d.section === sectionId);

      if (parts.length === 0) continue;

      const sectionItems = parts.flatMap((p) => p.items);
      const route = parts.length > 1 ? parts[1].route : 'mixed';
      const correct = sectionItems.filter((q) => isCorrect(q, all[q.id])).length;
      const extra = { seconds: parts.reduce((sum, p) => sum + p.seconds, 0) };

      // A drill is practice on one skill, so it does not carry a section score.
      if (!drill) {
        extra.route = route;
        extra.scaled = scaledFrom(correct, sectionItems.length, route);
      }

      if (parts.length > 1) {
        extra.modules = parts.map((p) => ({ correct: p.items.filter((q) => isCorrect(q, all[q.id])).length, total: p.items.length, route: p.route }));
      }

      sections.push(scoreItems(sectionId, sectionItems, all, extra));
    }

    const limits = stages.filter((s) => !s.break && s.seconds).reduce((sum, s) => sum + s.seconds, 0);
    const source =
      config.kind === 'drill'
        ? `sat:drill:${SKILLS[config.skill].section}:${config.skill}`
        : config.kind === 'module'
          ? `sat:module:${config.section}`
          : config.kind === 'full'
            ? 'sat:full'
            : 'sat:diag';

    onFinish({
      kind: config.kind,
      sections,
      correct: sections.reduce((sum, s) => sum + s.correct, 0),
      total: sections.reduce((sum, s) => sum + s.total, 0),
      seconds: doneRef.current.reduce((sum, d) => sum + d.seconds, 0),
      limitSeconds: limits || null,
      source,
    });
  }

  function finishStage() {
    if (advancingRef.current) return;

    advancingRef.current = true;

    if (!stage.break) {
      doneRef.current.push({
        section: stage.section,
        items,
        seconds: Math.round((Date.now() - stageStartRef.current) / 1000),
        route: routeRef.current,
      });
    }

    if (stageIndex + 1 < stages.length) enterStage(stageIndex + 1);
    else finishAll();
  }

  // The clock. When a timed stage runs out, it is submitted as it stands.
  useEffect(() => {
    if (phase !== 'run' && phase !== 'review' && phase !== 'break') return undefined;

    const timer = setInterval(() => {
      setNow(Date.now());

      const stageLimit = stages[stageIndex]?.seconds;

      if (stageLimit && (Date.now() - stageStartRef.current) / 1000 >= stageLimit) finishStage();
    }, 500);

    return () => clearInterval(timer);
    // finishStage reads everything it needs from refs and the current stage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stageIndex, items]);

  // Warn before the tab is closed or reloaded in the middle of a set.
  useEffect(() => {
    if (phase === 'intro' || phase === 'saving') return undefined;

    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warn);

    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  const head = (
    <header className="sat-test-head" ref={topRef}>
      <div>
        <p className="eyebrow">{config.kind === 'diag' ? 'SAT DIAGNOSTIC' : config.kind === 'drill' ? 'SKILL DRILL' : config.kind === 'module' ? 'TIMED MODULE' : 'FULL ADAPTIVE TEST'}</p>
        <h2>{config.title}</h2>
      </div>
      {phase !== 'saving' && (
        <button
          type="button"
          className="text-link"
          onClick={() => {
            if (phase === 'intro' || window.confirm('Leave now? Your answers will not be saved.')) onQuit();
          }}
        >
          {phase === 'intro' ? 'Back' : 'Quit'}
        </button>
      )}
    </header>
  );

  if (phase === 'intro') {
    const intro = introFor(config, bank, seen);

    return (
      <section className="sat-test">
        {head}
        <div className="sat-panel sat-intro">
          <h3>{intro.title}</h3>
          <ul>
            {intro.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <button type="button" className="qa-primary" onClick={() => { startedRef.current = Date.now(); enterStage(0); }}>
            {config.kind === 'full' ? 'Begin Module 1' : 'Begin'}
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'saving') {
    return (
      <section className="sat-test">
        {head}
        <div className="sat-panel sat-wait" role="status">
          <span className="ai-dots" aria-hidden="true"><i /><i /><i /></span>
          <h3>Marking your answers...</h3>
        </div>
      </section>
    );
  }

  if (phase === 'break') {
    return (
      <section className="sat-test">
        {head}
        <div className="sat-panel sat-wait">
          <p className="eyebrow">BREAK</p>
          <b className="sat-break-clock" role="timer">{formatClock(remaining)}</b>
          <h3>Reading and Writing is done. Math is next.</h3>
          <p>Stand up, drink some water, look away from the screen. The Math section starts when the break ends, or when you choose.</p>
          <button type="button" className="qa-primary" onClick={finishStage}>
            Start Math now
          </button>
        </div>
      </section>
    );
  }

  const item = items[cur];

  if (!item) {
    return (
      <section className="sat-test">
        {head}
        <div className="sat-panel sat-wait">
          <h3>No questions are available for this set.</h3>
          <button type="button" className="qa-primary" onClick={onQuit}>Back</button>
        </div>
      </section>
    );
  }

  const answer = answers[item.id];
  const answeredCount = items.filter((q) => isAnswered(q, answers[q.id])).length;
  const revealed = Boolean(checked[item.id]);
  const right = revealed && isCorrect(item, answer);
  const low = remaining !== null && remaining <= 300;
  const last = cur + 1 === items.length;
  const stageWord = stageIndex + 1 < stages.length ? 'module' : config.kind === 'drill' ? 'drill' : config.kind === 'diag' && stage.section === 'rw' ? 'section' : 'test';

  const setAnswer = (value) => {
    if (!revealed) setAnswers((current) => ({ ...current, [item.id]: value }));
  };

  const toggleCross = (index) => {
    setCrossed((current) => {
      const mine = new Set(current[item.id] || []);

      if (mine.has(index)) mine.delete(index);
      else mine.add(index);

      return { ...current, [item.id]: [...mine] };
    });
    // Crossing out the chosen answer clears the choice.
    if (answer === index) setAnswers((current) => ({ ...current, [item.id]: null }));
  };

  const navigator = (
    <div className="sat-nav-grid" role="group" aria-label="Jump to a question">
      {items.map((q, i) => {
        const cls = ['sat-dot', isAnswered(q, answers[q.id]) ? 'answered' : '', marked[q.id] ? 'marked' : '', i === cur && phase === 'run' ? 'current' : '']
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={q.id}
            type="button"
            className={cls}
            aria-label={`Question ${i + 1}${marked[q.id] ? ', marked for review' : ''}${isAnswered(q, answers[q.id]) ? ', answered' : ', unanswered'}`}
            onClick={() => {
              setCur(i);
              setShowNav(false);
              setPhase('run');
              toTop();
            }}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );

  const bar = (
    <div className="sat-bar">
      <span className="sat-bar-where">
        {stage.label}
        {config.kind === 'full' && <small> · part {stages.filter((s, i) => !s.break && i <= stageIndex).length} of 4</small>}
      </span>
      <span className="sat-bar-clock">
        {hideClock ? (
          <span className="sat-clock-hidden">Clock hidden</span>
        ) : (
          <b className={low ? 'sat-clock low' : 'sat-clock'} role="timer" aria-label={remaining === null ? 'Time spent' : 'Time left'}>
            {formatClock(remaining ?? elapsed)}
          </b>
        )}
        <button type="button" className="sat-chip" onClick={() => setHideClock(!hideClock)}>
          {hideClock ? 'Show' : 'Hide'}
        </button>
      </span>
      <span className="sat-bar-tools">
        {stage.section === 'math' && (
          <>
            <a className="sat-chip" href={DESMOS} target="_blank" rel="noreferrer">
              Calculator
            </a>
            <button type="button" className={showSheet ? 'sat-chip on' : 'sat-chip'} aria-expanded={showSheet} onClick={() => setShowSheet(!showSheet)}>
              Formulas
            </button>
          </>
        )}
      </span>
    </div>
  );

  if (phase === 'review') {
    const unanswered = items.length - answeredCount;
    const markedCount = items.filter((q) => marked[q.id]).length;

    return (
      <section className="sat-test">
        {head}
        {bar}
        <div className="sat-panel">
          <h3>Check your work</h3>
          <p className="sat-muted">
            {unanswered === 0 ? 'Every question is answered.' : `${unanswered} unanswered.`}
            {markedCount > 0 && ` ${markedCount} marked for review.`} Tap a number to go back to it.
            {unanswered > 0 && ' There is no penalty for a wrong answer, so never leave a blank.'}
          </p>
          {navigator}
          <p className="sat-legend">
            <span><i className="sat-dot answered" /> Answered</span>
            <span><i className="sat-dot" /> Unanswered</span>
            <span><i className="sat-dot marked" /> Marked</span>
          </p>
          <div className="sat-actions">
            <button type="button" className="ghost-button" onClick={() => { setPhase('run'); toTop(); }}>
              Keep working
            </button>
            <button type="button" className="qa-primary" onClick={finishStage}>
              {stageIndex + 1 < stages.length ? `Finish this ${stageWord} and continue` : `Finish the ${stageWord}`}
            </button>
          </div>
          {stageIndex + 1 < stages.length && config.kind === 'full' && <p className="sat-muted">You cannot come back to this module after you continue.</p>}
        </div>
      </section>
    );
  }

  const split = Boolean(item.passage);

  return (
    <section className="sat-test">
      {head}
      {bar}

      {showSheet && (
        <div className="sat-panel sat-sheet">
          <h3>Reference</h3>
          <dl>
            {FORMULAS.map(([name, formula]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{formula}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className={split ? 'sat-stage split' : 'sat-stage'}>
        {split && (
          <div className="sat-panel sat-passage">
            <p>{item.passage}</p>
            {item.table && <Table table={item.table} />}
          </div>
        )}

        <div className="sat-panel sat-question">
          <div className="sat-q-head">
            <span className="sat-q-num">{cur + 1}</span>
            {!drill && (
              <button type="button" className={marked[item.id] ? 'sat-chip on' : 'sat-chip'} aria-pressed={Boolean(marked[item.id])} onClick={() => setMarked({ ...marked, [item.id]: !marked[item.id] })}>
                {marked[item.id] ? 'Marked for review' : 'Mark for review'}
              </button>
            )}
            {drill && <span className="sat-level">{LEVEL_NAMES[item.level]}</span>}
            {item.type === 'mc' && !revealed && (
              <button type="button" className={crossMode ? 'sat-chip on' : 'sat-chip'} aria-pressed={crossMode} onClick={() => setCrossMode(!crossMode)} title="Cross out answers you have ruled out">
                <s>ABC</s>
              </button>
            )}
          </div>

          {!split && item.table && <Table table={item.table} />}
          <p className="sat-stem">{item.question}</p>

          {item.type === 'mc' ? (
            <div className="sat-options" role="radiogroup" aria-label={`Question ${cur + 1}`}>
              {item.options.map((option, oi) => {
                const out = (crossed[item.id] || []).includes(oi);
                const state = revealed ? (oi === item.answer ? 'correct' : answer === oi ? 'wrong' : '') : answer === oi ? 'selected' : '';

                return (
                  <div key={oi} className={`sat-option-row ${out && !revealed ? 'out' : ''}`}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={answer === oi}
                      disabled={revealed}
                      className={`sat-option ${state}`}
                      onClick={() => (crossMode ? toggleCross(oi) : setAnswer(oi))}
                    >
                      <span className="sat-letter" aria-hidden="true">{LETTERS[oi]}</span>
                      <span className="sat-option-text">{option}</span>
                    </button>
                    {crossMode && !revealed && (
                      <button type="button" className="sat-cross" aria-label={out ? `Restore option ${LETTERS[oi]}` : `Cross out option ${LETTERS[oi]}`} onClick={() => toggleCross(oi)}>
                        {out ? 'Undo' : <s>{LETTERS[oi]}</s>}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="sat-typed">
              <label htmlFor="sat-typed-input">Your answer</label>
              <input
                id="sat-typed-input"
                type="text"
                inputMode="decimal"
                maxLength={7}
                value={answer ?? ''}
                disabled={revealed}
                onChange={(event) => setAnswer(event.target.value.replace(/[^0-9./-]/g, ''))}
                placeholder="e.g. 12, 3/4 or 0.75"
                className={revealed ? (right ? 'correct' : 'wrong') : ''}
                {...NO_SUGGEST}
              />
              <small>
                {answer && parseTyped(answer) === null
                  ? 'That is not a number yet.'
                  : 'Type a whole number, a decimal or a fraction. Do not type units or commas.'}
              </small>
            </div>
          )}

          {revealed && (
            <div className={right ? 'sat-feedback right' : 'sat-feedback'} role="status">
              <strong>{right ? 'Correct.' : `Not quite. The answer is ${item.type === 'mc' ? `${LETTERS[item.answer]}: ` : ''}${correctText(item)}.`}</strong>
              <p>{item.explain}</p>
            </div>
          )}
        </div>
      </div>

      <div className="sat-foot">
        <button type="button" className="sat-chip sat-count" aria-expanded={showNav} onClick={() => setShowNav(!showNav)}>
          Question {cur + 1} of {items.length} {showNav ? '▴' : '▾'}
        </button>
        <div className="sat-actions">
          {!drill && (
            <button type="button" className="ghost-button" disabled={cur === 0} onClick={() => { setCur(cur - 1); toTop(); }}>
              Back
            </button>
          )}
          {drill && !revealed ? (
            <button type="button" className="qa-primary" disabled={!isAnswered(item, answer)} onClick={() => setChecked({ ...checked, [item.id]: true })}>
              Check
            </button>
          ) : last ? (
            <button type="button" className="qa-primary" onClick={() => (drill ? finishStage() : (setPhase('review'), toTop()))}>
              {drill ? 'Finish the drill' : 'Review answers'}
            </button>
          ) : (
            <button type="button" className="qa-primary" onClick={() => { setCur(cur + 1); toTop(); }}>
              Next
            </button>
          )}
        </div>
      </div>

      {showNav && !drill && (
        <div className="sat-panel">
          {navigator}
          <p className="sat-muted">
            {answeredCount} of {items.length} answered.{' '}
            <button type="button" className="text-link" onClick={() => { setPhase('review'); setShowNav(false); toTop(); }}>
              Go to the review screen
            </button>
          </p>
        </div>
      )}
    </section>
  );
}
