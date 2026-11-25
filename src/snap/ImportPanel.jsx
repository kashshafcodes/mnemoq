import { useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { track } from '../track';
import { requestStarterSet } from '../aiGenerate';
import { csvToCards } from '../csvImport';
import { canonicalCategory, canonicalSubject, cleanName, getSubjectNames } from '../subjects';
import { useSnapT } from './strings';

// Snap > Import cards: the old AI set maker (/api/generate, unchanged) and the
// CSV import, in one quiet sheet. "Write several cards" opens the manual form.
// None of this is in the main nav.

export default function ImportPanel({ cards, onSave, onManual, onBack }) {
  const t = useSnapT();
  const { lang } = useI18n();
  const [kind, setKind] = useState(null); // null | 'set' | 'csv'
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState(() => getSubjectNames(cards)[0] || '');
  const [status, setStatus] = useState('idle'); // idle | loading | ready | adding | done | error
  const [found, setFound] = useState(null); // { cards, category, skipped }
  const [message, setMessage] = useState('');
  const fileRef = useRef(null);

  function open(next) {
    track('snap_import_open', { kind: next });

    if (next === 'several') {
      onManual();
      return;
    }

    setKind(next);
    setStatus('idle');
    setFound(null);
    setMessage('');
  }

  async function makeSet(event) {
    event.preventDefault();
    if (!topic.trim() || status === 'loading') return;

    setStatus('loading');
    setMessage('');

    try {
      const result = await requestStarterSet({ subject: cleanName(subject) || 'General', topic: topic.trim(), notes: '', count: 10, language: lang });

      setFound({ cards: result.cards || [], category: result.category, skipped: 0 });
      setStatus('ready');
    } catch (error) {
      setMessage(error?.message || 'Something went wrong.');
      setStatus('error');
    }
  }

  async function readFile(event) {
    const file = event.target.files?.[0];

    event.target.value = '';
    if (!file) return;

    try {
      const { cards: rows, skipped } = csvToCards(await file.text());

      setFound({ cards: rows.map((row) => ({ ...row, hook: row.explanation })), skipped });
      setStatus('ready');
      setMessage('');
    } catch (error) {
      setMessage(error?.message || 'Could not read that file.');
      setStatus('error');
    }
  }

  async function addAll() {
    if (!found?.cards.length || status === 'adding') return;

    setStatus('adding');

    let added = 0;

    for (const card of found.cards) {
      const name = canonicalSubject(card.subject || subject || 'General', cards) || 'General';
      const category = canonicalCategory(name, card.category || found.category || topic || 'General', cards) || 'General';
      // eslint-disable-next-line no-await-in-loop
      const result = await onSave({
        subject: name,
        category,
        question: card.question,
        correctAnswer: card.correctAnswer,
        yourAnswer: card.yourAnswer || '',
        explanation: card.hook || '',
        distractors: card.wrongAnswers || [],
        method: kind === 'csv' ? 'csv_import' : 'ai_set',
      });

      if (result?.error) {
        setMessage(result.error);
        setStatus('error');
        return;
      }

      added += 1;
    }

    setMessage(t('snap.import.added', { n: added }));
    setStatus('done');
    setFound(null);
  }

  return (
    <section className="snap-import" aria-labelledby="snap-import-title">
      <div className="snap-head">
        <button type="button" className="snap-link" onClick={kind ? () => setKind(null) : onBack}>
          ← {t('snap.back')}
        </button>
      </div>
      <h2 id="snap-import-title">{t('snap.import.title')}</h2>

      {!kind && (
        <div className="snap-import-rows">
          <button type="button" className="snap-choice" onClick={() => open('set')}>
            {t('snap.import.set')}
          </button>
          <button type="button" className="snap-choice" onClick={() => open('csv')}>
            {t('snap.import.csv')}
          </button>
          <button type="button" className="snap-choice" onClick={() => open('several')}>
            {t('snap.import.several')}
          </button>
        </div>
      )}

      {kind === 'set' && status !== 'ready' && status !== 'adding' && (
        <form className="snap-import-form" onSubmit={makeSet}>
          <label className="snap-field">
            <span>{t('snap.import.subject')}</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={40} />
          </label>
          <label className="snap-field">
            <span>{t('snap.import.topic')}</span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={80} />
          </label>
          <button type="submit" className="snap-primary" disabled={!topic.trim() || status === 'loading'}>
            {status === 'loading' ? t('snap.import.making') : t('snap.import.make')}
          </button>
        </form>
      )}

      {kind === 'csv' && status !== 'ready' && status !== 'adding' && (
        <div className="snap-import-form">
          <p className="snap-note">{t('snap.import.csvHint')}</p>
          <button type="button" className="snap-primary" onClick={() => fileRef.current?.click()}>
            {t('snap.import.csv')}
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={readFile} />
        </div>
      )}

      {found && (status === 'ready' || status === 'adding') && (
        <div className="snap-import-found">
          <ol>
            {found.cards.slice(0, 20).map((card, i) => (
              <li key={i}>{card.question}</li>
            ))}
          </ol>
          {found.skipped > 0 && <p className="snap-note">{t('snap.import.skipped', { n: found.skipped })}</p>}
          <button type="button" className="snap-primary" onClick={addAll} disabled={status === 'adding' || found.cards.length === 0}>
            {t('snap.import.add', { n: found.cards.length })}
          </button>
        </div>
      )}

      {message && (
        <p className={status === 'error' ? 'snap-error' : 'snap-note'} role={status === 'error' ? 'alert' : 'status'}>
          {message}
        </p>
      )}
    </section>
  );
}
