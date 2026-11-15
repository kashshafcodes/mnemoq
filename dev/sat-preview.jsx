// A development-only page for trying the SAT path without logging in:
//   npm run dev, then open /dev/sat-preview.html
//     ?pro=1    preview as a Pro account
//     ?demo=1   start with some results already saved
//     ?page=pro show the Pro page
// Nothing here is saved anywhere, and this page is not part of the real build.

import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import '../src/App.css';
import ProPage from '../src/components/Pro';
import SatPath from '../src/components/sat/SatPath';
import { describePlan } from '../src/plan';
import { SKILLS } from '../src/sat/blueprint';

const params = new URLSearchParams(window.location.search);
const DAY = 86400000;
const ago = (days) => new Date(Date.now() - days * DAY);
const inDays = (days) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

const topic = (skill, correct, total) => ({ topic: SKILLS[skill].name, skill, domain: SKILLS[skill].domain, correct, total });

function demoState() {
  const diagnostic = {
    id: 'demo-diag',
    createdAt: ago(21),
    analysis: null,
    sections: [
      { id: 'rw', name: 'Reading and Writing', correct: 7, total: 12, scaled: 520, route: 'mixed', missed: [], ids: [], topics: [topic('wic', 2, 2), topic('tsp', 1, 1), topic('ctc', 0, 1), topic('cid', 1, 1), topic('coe', 1, 1), topic('inf', 1, 1), topic('bnd', 0, 2), topic('fss', 0, 1), topic('trn', 1, 1), topic('syn', 0, 1)] },
      { id: 'math', name: 'Math', correct: 10, total: 12, scaled: 670, route: 'mixed', missed: [], ids: [], topics: [topic('lin1', 1, 1), topic('lin2', 1, 1), topic('sys', 1, 1), topic('ineq', 1, 1), topic('eqx', 1, 1), topic('nleq', 1, 2), topic('nlf', 1, 1), topic('pct', 1, 1), topic('stat', 1, 1), topic('area', 1, 1), topic('circ', 0, 1)] },
    ],
  };
  const drill = (skill, correct, days) => ({
    id: `demo-${skill}-${days}`,
    source: `sat:drill:${SKILLS[skill].section}:${skill}`,
    createdAt: ago(days),
    correct,
    total: 10,
    seconds: 540,
    limitSeconds: null,
    sections: [{ id: SKILLS[skill].section, name: '', correct, total: 10, missed: [], ids: [], topics: [topic(skill, correct, 10)] }],
  });
  const official = (rw, math, days) => ({
    id: `demo-official-${days}`,
    source: 'official:bluebook',
    createdAt: ago(days),
    correct: rw + math,
    total: 1600,
    seconds: 0,
    limitSeconds: null,
    sections: [
      { id: 'rw', scaled: rw, takenOn: ago(days).toISOString().slice(0, 10) },
      { id: 'math', scaled: math, takenOn: ago(days).toISOString().slice(0, 10) },
    ],
  });

  return {
    diagnostic,
    mocks: [official(620, 700, 2), drill('bnd', 7, 3), drill('fss', 8, 5), drill('trn', 9, 6), drill('bnd', 4, 9), official(580, 680, 12), drill('circ', 5, 14), drill('wic', 9, 15), official(560, 690, 30)],
  };
}

function Preview() {
  const demo = params.get('demo') ? demoState() : { diagnostic: null, mocks: [] };
  const [state, setState] = useState({
    status: 'ready',
    path: { pathId: 'sat', examDate: inDays(118), target: 1500 },
    paths: [
      { pathId: 'sat', examDate: inDays(118), target: 1500 },
      { pathId: 'nsu', examDate: inDays(12), target: 75 },
    ],
    multi: true,
    ...demo,
  });
  const [plan, setPlan] = useState(params.get('pro') ? { ...describePlan(new Date(Date.now() + 64 * DAY)), setup: false } : { pro: false, proUntil: null, daysLeft: null, setup: false });
  const [notice, setNotice] = useState('');

  if (params.get('page') === 'pro') return <ProPage plan={plan} onPlan={setPlan} email="student@example.com" />;

  return (
    <SatPath
      state={state}
      plan={plan}
      cards={[]}
      reviews={[]}
      notice={notice}
      onDismissNotice={() => setNotice('')}
      onSavePath={async (choice) => {
        setState((current) => ({ ...current, path: { ...current.path, ...choice } }));
        return {};
      }}
      onSwitchPath={async () => setNotice('Preview only: switching exams needs a real account.')}
      onAddExam={() => setNotice('Preview only: adding an exam needs a real account.')}
      onSaveDiagnostic={async (result) => {
        setState((current) => ({ ...current, diagnostic: { id: 'preview', createdAt: new Date(), analysis: null, ...result } }));
        return {};
      }}
      onSaveMock={async (record) => {
        setState((current) => ({ ...current, mocks: [{ ...record, id: `m-${Date.now()}`, createdAt: new Date() }, ...current.mocks] }));
        return {};
      }}
      onAnalyze={async () => ({ error: 'Preview only: the AI coach needs a real account.' })}
      onAddCards={async (cards) => ({ added: cards.length })}
    />
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div className="app" style={{ display: 'block' }}>
      <main className="main-content" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        <Preview />
      </main>
    </div>
  </StrictMode>
);
