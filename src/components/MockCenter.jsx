import { useMemo, useState } from 'react';
import { getPath } from '../paths';
import { preparedFor } from '../mockBank';
import { mockProgress, pctOf, preparedKey, sectionName } from '../mocks';
import { computeReadiness, daysLeftFor, describeProgress } from '../readiness';
import { pageHref } from '../useRoute';
import AiBadge from './AiBadge';
import EssayMock from './EssayMock';
import Mock from './Mock';
import MockReport from './MockReport';
import MockSession from './MockSession';

// The Mock Tests page: prepared mocks for each section (unlocked one by one),
// your own custom mocks, and every past report.

const ORDER = ['english', 'quant', 'reading', 'essay'];

export default function MockCenter({ state, cards, reviews, onSaveMock, onAddBank, onDeleteBank, onAddCards, onReload }) {
  const [view, setView] = useState({ name: 'home' }); // home | prepared | essay | custom | report
  const pathId = state.path?.pathId;
  const path = pathId ? getPath(pathId) : null;
  const bank = preparedFor(pathId);
  const mocks = state.mocks || [];
  const readiness = useMemo(
    () => (path ? computeReadiness(pathId, state.diagnostic, reviews, new Date(), mocks) : null),
    [path, pathId, state.diagnostic, reviews, mocks]
  );

  if (state.status === 'loading') return <p className="path-loading">Loading your mock tests...</p>;

  if (state.status !== 'ready' || !path || !bank) {
    return (
      <section className="path-setup">
        <h2>Mock tests</h2>
        <p className="subtitle">
          Mock tests are built around your exam path. Choose one first.{' '}
          <a href={pageHref('path')}>Go to my exam path</a>
        </p>
        {state.status === 'error' && (
          <button type="button" className="qa-primary" onClick={onReload}>
            Try again
          </button>
        )}
      </section>
    );
  }

  const common = {
    pathId,
    diagnostic: state.diagnostic,
    reviews,
    mocks,
    onSaveMock,
  };
  const home = () => setView({ name: 'home' });

  if (view.name === 'prepared') {
    const mock = bank.sections[view.sectionId].find((m) => m.n === view.n);
    const section = { id: view.sectionId, name: sectionName(pathId, view.sectionId), passage: mock.passage || '', questions: mock.questions };

    return (
      <MockSession
        key={`${view.sectionId}-${view.n}-${view.run}`}
        {...common}
        title={mock.title}
        paper={[section]}
        limitSeconds={bank.times[view.sectionId] * 60}
        source={preparedKey(view.sectionId, view.n)}
        onAddCards={onAddCards}
        onQuit={home}
      >
        <div className="diag-actions">
          <button type="button" className="qa-primary" onClick={home}>
            Back to mock tests
          </button>
        </div>
      </MockSession>
    );
  }

  if (view.name === 'essay') {
    const mock = bank.sections.essay.find((m) => m.n === view.n);

    return (
      <EssayMock
        key={`essay-${view.n}-${view.run}`}
        {...common}
        title={mock.title}
        prompts={mock.prompts}
        minutes={bank.times.essay}
        source={preparedKey('essay', view.n)}
        onQuit={home}
      >
        <div className="diag-actions">
          <button type="button" className="qa-primary" onClick={home}>
            Back to mock tests
          </button>
        </div>
      </EssayMock>
    );
  }

  if (view.name === 'custom') {
    return (
      <Mock
        {...common}
        path={path}
        bank={state.bank || []}
        setup={Boolean(state.mockSetup)}
        onAddBank={onAddBank}
        onDeleteBank={onDeleteBank}
        onAddCards={onAddCards}
        onClose={home}
      />
    );
  }

  if (view.name === 'report') {
    const record = mocks.find((m) => m.id === view.id);

    return (
      <section className="diag mock">
        <header className="diag-head">
          <div>
            <p className="eyebrow">MOCK TEST REPORT</p>
            <h2>{view.title}</h2>
          </div>
          <button type="button" className="text-link" onClick={home}>
            Back
          </button>
        </header>
        {record && <MockReport title={view.title} record={record} onAddCards={onAddCards} />}
      </section>
    );
  }

  const daysLeft = daysLeftFor(state.path.examDate);
  const progress = describeProgress(readiness.overall, state.path.target, daysLeft);
  const titleFor = (source) => {
    const [, sectionId, n] = String(source || '').split(':');
    const found = bank.sections[sectionId]?.find((m) => String(m.n) === n);

    return found ? found.title : 'Custom mock test';
  };

  return (
    <div className="path mock-center">
      <section className="path-hero">
        <div className="path-hero-main">
          <p className="eyebrow">MOCK TESTS</p>
          <h2>
            {path.name} <AiBadge>Practice papers</AiBadge>
          </h2>
          <p className="path-status">
            <span className={`path-pill ${progress.band}`}>{progress.label}</span>
            {readiness.overall !== null && (
              <span>
                Exam readiness {readiness.overall} of your target {state.path.target}
              </span>
            )}
          </p>
          <p className="path-hint">
            Each section has its own timed papers. Finish one to unlock the next. Every result is added to your exam readiness
            and comes with a full report.
          </p>
          <div className="path-hero-actions">
            <a className="ghost-button" href={pageHref('path')}>
              Back to my exam path
            </a>
          </div>
          {state.mockSetup && (
            <p className="path-notice" role="status">
              Run <code>supabase/stage3.sql</code> in Supabase so your results are saved and unlock the next mock.
            </p>
          )}
        </div>
        <div className="mock-sections-mini">
          {readiness.sections.map((s) => (
            <div key={s.id}>
              <b>{s.score === null ? '–' : s.score}</b>
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mock-grid">
        {ORDER.filter((id) => bank.sections[id]?.length > 0).map((id) => {
          const list = mockProgress(id, bank.sections[id], mocks);
          const mins = bank.times[id];

          return (
            <section key={id} className="path-card mock-section-card">
              <header>
                <h3>{sectionName(pathId, id)}</h3>
                <p>
                  {mins} minutes
                  {id === 'essay' ? ' · AI-marked' : ` · ${bank.sections[id][0].questions.length} questions`}
                </p>
              </header>
              <ul className="mock-list">
                {list.map((m) => (
                  <li key={m.n} className={`mock-item ${m.status}`}>
                    <div>
                      <strong>{m.title}</strong>
                      <small>
                        {m.status === 'locked' && 'Finish the mock before this one to unlock it'}
                        {m.status === 'ready' && 'Ready to start'}
                        {m.status === 'done' && `Best ${m.best}% · taken ${m.attempts} ${m.attempts === 1 ? 'time' : 'times'}`}
                      </small>
                    </div>
                    {m.status === 'locked' ? (
                      <span className="mock-lock" aria-label="Locked">
                        Locked
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={m.status === 'ready' ? 'qa-primary' : 'ghost-button'}
                        onClick={() => setView({ name: id === 'essay' ? 'essay' : 'prepared', sectionId: id, n: m.n, run: Date.now() })}
                      >
                        {m.status === 'ready' ? 'Start' : 'Retake'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="path-card">
        <header>
          <h3>
            Build your own mock <AiBadge />
          </h3>
          <p>Choose sections, length and timer, mix in your own questions, or let the AI write a fresh paper.</p>
        </header>
        <button type="button" className="qa-primary" onClick={() => setView({ name: 'custom' })}>
          Open the mock builder
        </button>
      </section>

      <section className="path-card">
        <header>
          <h3>Your reports</h3>
          <p>{mocks.length === 0 ? 'Your reports appear here after your first mock.' : 'Open any past result.'}</p>
        </header>
        {mocks.length > 0 && (
          <ul className="mock-history">
            {mocks.slice(0, 12).map((m) => (
              <li key={m.id}>
                <span>{new Date(m.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                <strong>{titleFor(m.source)}</strong>
                <span>{pctOf(m)}%</span>
                <button type="button" className="text-link" onClick={() => setView({ name: 'report', id: m.id, title: titleFor(m.source) })}>
                  Report
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
