import { useEffect, useMemo, useState } from 'react';
import '../../sat/sat.css';
import { accessFor } from '../../sat/access';
import { FREE_BANK, loadBank, lockedCount } from '../../sat/bank';
import { SECTIONS, SKILLS } from '../../sat/blueprint';
import { estimateScore } from '../../sat/score';
import { seenIds, skillMap } from '../../sat/skills';
import { Paywall } from '../Pro';
import SatDashboard, { describeResult } from './SatDashboard';
import SatReport from './SatReport';
import SatTest from './SatTest';

// The SAT path: decides what is on screen (the dashboard, a set in progress
// or a report), loads the question bank for this account, and applies the
// free-plan limits before anything starts.

const TITLES = {
  diag: () => 'SAT diagnostic',
  drill: (config) => `Drill: ${SKILLS[config.skill].name}`,
  module: (config) => `${SECTIONS[config.section].name}: timed module`,
  full: () => 'Full adaptive practice test',
};

export default function SatPath({
  state,
  plan,
  cards,
  reviews,
  onSavePath,
  onSwitchPath,
  onAddExam,
  onSaveDiagnostic,
  onSaveMock,
  onAnalyze,
  onAddCards,
  notice,
  onDismissNotice,
}) {
  const [view, setView] = useState({ name: 'home' }); // home | run | report
  const [paywall, setPaywall] = useState(null);
  const [bankState, setBankState] = useState({ bank: FREE_BANK, pro: false });
  const [analyzing, setAnalyzing] = useState(false);
  const [localNotice, setLocalNotice] = useState('');

  const { diagnostic } = state;
  const mocks = useMemo(() => state.mocks || [], [state.mocks]);

  // Ask the server which questions this account may have. The server decides;
  // an email listed as Pro on the server counts even without a plan row.
  useEffect(() => {
    let cancelled = false;

    loadBank(plan).then((next) => {
      if (!cancelled) setBankState(next);
    });

    return () => {
      cancelled = true;
    };
  }, [plan]);

  const livePlan = useMemo(() => ({ ...plan, pro: plan.pro || bankState.pro }), [plan, bankState.pro]);
  const access = useMemo(() => accessFor(livePlan, mocks), [livePlan, mocks]);
  const estimate = useMemo(() => estimateScore(diagnostic, mocks), [diagnostic, mocks]);
  const map = useMemo(() => skillMap(diagnostic, mocks), [diagnostic, mocks]);
  const seen = useMemo(() => seenIds(diagnostic, mocks), [diagnostic, mocks]);
  const upgrade = (feature, reason = '') => setPaywall({ feature, reason });

  function start(config) {
    const gate =
      config.kind === 'drill' ? access.drill : config.kind === 'module' ? access.module(config.section) : config.kind === 'full' ? access.fullTest : access.diagnostic;

    if (!gate.allowed) {
      upgrade(gate.feature, gate.reason);
      return;
    }

    setView({ name: 'run', config: { ...config, title: TITLES[config.kind](config) }, run: Date.now() });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  async function finish(result) {
    const before = estimate.overall;
    const record = { pathId: 'sat', sections: result.sections, correct: result.correct, total: result.total, seconds: result.seconds, limitSeconds: result.limitSeconds, source: result.source };
    const stamped = { ...record, createdAt: new Date() };
    let saved;
    let after;

    if (result.kind === 'diag') {
      saved = await onSaveDiagnostic({ kind: diagnostic ? 'retest' : 'initial', sections: result.sections, essay: null, analysis: null });
      after = estimateScore({ sections: result.sections, createdAt: new Date() }, mocks).overall;
    } else {
      saved = await onSaveMock(record);
      after = estimateScore(diagnostic, [stamped, ...mocks]).overall;
    }

    setView({ name: 'report', record: stamped, title: view.config.title, change: result.kind === 'drill' ? null : { before, after }, saveError: saved?.error || '' });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  async function logScore({ rw, math, takenOn }) {
    const section = (id, scaled) => ({ id, name: SECTIONS[id].name, scaled, takenOn });
    const saved = await onSaveMock({
      pathId: 'sat',
      sections: [section('rw', rw), section('math', math)],
      correct: rw + math,
      total: 1600,
      seconds: 0,
      limitSeconds: null,
      source: 'official:bluebook',
    });

    if (!saved?.error) setLocalNotice(`Score saved: ${rw + math}. Official scores count most towards your estimate.`);

    return saved;
  }

  const home = () => {
    setView({ name: 'home' });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const sheet = paywall && <Paywall prompt={paywall} onClose={() => setPaywall(null)} />;

  if (view.name === 'run') {
    return <SatTest key={view.run} config={view.config} bank={bankState.bank} seen={seen} onFinish={finish} onQuit={home} />;
  }

  if (view.name === 'report') {
    return (
      <section className="sat-test">
        <header className="sat-test-head">
          <div>
            <p className="eyebrow">DIGITAL SAT</p>
            <h2>{view.title}</h2>
          </div>
          <button type="button" className="text-link" onClick={home}>
            Back to my SAT path
          </button>
        </header>
        <SatReport
          title={view.title}
          record={view.record}
          access={access}
          change={view.change}
          saveError={view.saveError}
          onAddCards={onAddCards}
          onDrill={(skill) => start({ kind: 'drill', skill })}
          onUpgrade={upgrade}
        >
          <div className="sat-actions">
            <button type="button" className="qa-primary" onClick={home}>
              Back to my SAT path
            </button>
          </div>
        </SatReport>
        {sheet}
      </section>
    );
  }

  return (
    <>
      <SatDashboard
        pathCfg={state.path}
        paths={state.paths || []}
        plan={livePlan}
        access={access}
        estimate={estimate}
        map={map}
        diagnostic={diagnostic}
        mocks={mocks}
        cards={cards}
        reviews={reviews}
        bank={bankState.bank}
        lockedQuestions={lockedCount(bankState.bank)}
        notice={localNotice || notice}
        onDismissNotice={() => {
          setLocalNotice('');
          onDismissNotice?.();
        }}
        onSavePath={onSavePath}
        onSwitch={onSwitchPath}
        onAddExam={onAddExam}
        onStart={start}
        onLogScore={logScore}
        onOpenReport={(mock) => setView({ name: 'report', record: mock, title: describeResult(mock), change: null, saveError: '' })}
        onUpgrade={upgrade}
        onAddCards={onAddCards}
        analyzing={analyzing}
        onAnalyze={async () => {
          setAnalyzing(true);

          const result = await onAnalyze();

          setAnalyzing(false);
          if (result?.code === 'pro' || (result?.code === 'limit' && !livePlan.pro)) upgrade('coach', result.error);
          else if (result?.error) setLocalNotice(result.error);
        }}
      />
      {sheet}
    </>
  );
}
