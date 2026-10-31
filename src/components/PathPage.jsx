import { useEffect, useMemo, useState } from 'react';
import { getPath } from '../paths';
import { missedAsCards } from '../diagnosticScore';
import { daysLeftFor } from '../readiness';
import Diagnostic from './Diagnostic';
import Mock from './Mock';
import PathDashboard from './PathDashboard';
import PathSetup from './PathSetup';

// The "My path" page. It decides what to show: loading, setup help, choosing a
// path, taking the diagnostic, or the dashboard.

const addedKey = (id) => `mnemoq-missed-added-${id}`;

function readAdded(id) {
  try {
    return Number(localStorage.getItem(addedKey(id))) || 0;
  } catch {
    return 0;
  }
}

export default function PathPage({
  state,
  cards,
  reviews,
  onSavePath,
  onSaveDiagnostic,
  onAnalyze,
  onAddCards,
  onReviewSubject,
  canReview,
  onReload,
  onSaveMock,
  onAddBank,
  onDeleteBank,
}) {
  const [view, setView] = useState('dashboard'); // dashboard | diagnostic | mock
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  const diagnostic = state.diagnostic;
  const diagId = diagnostic?.id;

  useEffect(() => {
    setAddedCount(diagId ? readAdded(diagId) : 0);
  }, [diagId]);

  const missed = useMemo(() => missedAsCards(diagnostic), [diagnostic]);

  if (state.status === 'loading') {
    return <p className="path-loading">Loading your exam path...</p>;
  }

  if (state.status === 'setup') {
    return (
      <section className="path-setup">
        <h2>Exam paths are almost ready</h2>
        <p className="subtitle">
          This feature needs a one-time update on the server before it can save your path. If you run this site, run
          <code> supabase/stage1.sql </code> in the Supabase SQL editor, then reload.
        </p>
        <button type="button" className="qa-primary" onClick={onReload}>
          Check again
        </button>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="path-setup">
        <h2>Could not load your exam path</h2>
        <p className="qa-message qa-error" role="alert">
          {state.message}
        </p>
        <button type="button" className="qa-primary" onClick={onReload}>
          Try again
        </button>
      </section>
    );
  }

  if (!state.path) {
    return (
      <PathSetup
        saving={saving}
        error={error}
        onSave={async (choice) => {
          setSaving(true);
          setError('');

          const result = await onSavePath(choice);

          setSaving(false);

          if (result?.error) setError(result.error);
          else setView('dashboard');
        }}
      />
    );
  }

  const path = getPath(state.path.pathId);

  if (view === 'diagnostic') {
    return (
      <Diagnostic
        pathId={state.path.pathId}
        pathName={path.name}
        hasEssay={path.subjects.some((s) => s.aiMarked)}
        kind={diagnostic ? 'retest' : 'initial'}
        daysLeft={daysLeftFor(state.path.examDate)}
        examDate={state.path.examDate}
        target={state.path.target}
        onCancel={() => setView('dashboard')}
        onFinish={async (result, note) => {
          const saved = await onSaveDiagnostic(result);

          setNotice(saved?.error ? `Your results could not be saved: ${saved.error}` : note);
          setView('dashboard');
        }}
      />
    );
  }

  if (view === 'mock') {
    return (
      <Mock
        pathId={state.path.pathId}
        path={path}
        diagnostic={diagnostic}
        reviews={reviews}
        mocks={state.mocks || []}
        bank={state.bank || []}
        setup={Boolean(state.mockSetup)}
        onSaveMock={onSaveMock}
        onAddBank={onAddBank}
        onDeleteBank={onDeleteBank}
        onAddCards={onAddCards}
        onClose={() => setView('dashboard')}
      />
    );
  }

  return (
    <PathDashboard
      pathCfg={state.path}
      diagnostic={diagnostic}
      cards={cards}
      reviews={reviews}
      notice={notice}
      onDismissNotice={() => setNotice('')}
      onSavePath={onSavePath}
      onStartDiagnostic={() => setView('diagnostic')}
      onStartMock={() => setView('mock')}
      mocks={state.mocks || []}
      analyzing={analyzing}
      onAnalyze={async () => {
        setAnalyzing(true);

        const result = await onAnalyze();

        setAnalyzing(false);
        if (result?.error) setNotice(result.error);
      }}
      missedCount={missed.length}
      addedCount={addedCount}
      adding={adding}
      onAddMissed={async () => {
        setAdding(true);

        const result = await onAddCards(missed.slice(addedCount));
        const total = addedCount + (result?.added || 0);

        setAddedCount(total);

        try {
          localStorage.setItem(addedKey(diagId), String(total));
        } catch {
          // Not critical: the button would just offer them again.
        }

        setAdding(false);
        if (result?.error) setNotice(`Some cards could not be added: ${result.error}`);
      }}
      canReview={canReview}
      onReviewSubject={onReviewSubject}
    />
  );
}
