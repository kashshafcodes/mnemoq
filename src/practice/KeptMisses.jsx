import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { track } from '../track';
import { MISS_CAP, missCard, missedInOrder } from './missCards';
import { usePracticeT } from './strings';
import './practice.css';

// The end of a practice set or the drill: the misses are already being kept
// as cards ("{n} will come back"), with one "Don't keep these" to take them
// back. Replaces the old optional "Save as review cards" button.
//
// onAddCards(cards) -> { added, ids, capped, error }  (App: addPracticeCards)
// onRemoveCards(ids) -> { error }                     (App: removePracticeCards)

export default function KeptMisses({ collection, n, questions, picked, onAddCards, onRemoveCards }) {
  const t = usePracticeT();
  const { lang } = useI18n();
  const [state, setState] = useState({ status: 'saving' });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const misses = missedInOrder(questions, picked);

    if (misses.length === 0) {
      setState({ status: 'none' });
      return;
    }

    const cards = misses.map((q) => missCard(q, picked, collection, lang));

    Promise.resolve(onAddCards(cards))
      .then((result) => {
        if (result?.error && !result.added) {
          setState({ status: 'error', error: result.error });
          return;
        }

        const ids = result?.ids || [];

        if (ids.length > 0) track('miss_kept', { collection: collection?.id, n, count: ids.length });
        setState({ status: ids.length > 0 ? 'kept' : 'already', ids, capped: misses.length > MISS_CAP });
      })
      .catch((caught) => setState({ status: 'error', error: caught?.message || 'failed' }));
    // Runs once, when the set ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function undo() {
    const { ids } = state;

    setState({ ...state, status: 'undoing' });

    const result = await onRemoveCards(ids);

    if (result?.error) {
      setState({ ...state, status: 'kept', undoError: result.error });
      return;
    }

    track('miss_undo', { collection: collection?.id, n, count: ids.length });
    setState({ status: 'undone' });
  }

  if (state.status === 'none') return null;

  return (
    <div className="pr-kept" role="status">
      {state.status === 'saving' && <p className="pr-muted">{t('kept.saving')}</p>}
      {(state.status === 'kept' || state.status === 'undoing') && (
        <>
          <p className="pr-kept-title">
            <b>{t('kept.n', { n: state.ids.length })}</b>
          </p>
          <p className="pr-muted">
            {t('kept.body')}
            {state.capped ? ` ${t('kept.capped', { n: MISS_CAP })}` : ''}
          </p>
          <p className="pr-kept-actions">
            <a href="#/review">{t('kept.review')}</a>
            <button type="button" className="text-link" disabled={state.status === 'undoing'} onClick={undo}>
              {state.status === 'undoing' ? t('kept.undoing') : t('kept.undo')}
            </button>
          </p>
          {state.undoError && <p className="pro-message">{state.undoError}</p>}
        </>
      )}
      {state.status === 'already' && <p className="pr-muted">{t('kept.already')}</p>}
      {state.status === 'undone' && <p className="pr-muted">{t('kept.undone')}</p>}
      {state.status === 'error' && <p className="pro-message">{t('kept.error', { error: state.error })}</p>}
    </div>
  );
}
