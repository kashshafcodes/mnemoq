import { useState } from 'react';
import RichText from '../components/RichText';
import { useSnapT } from './strings';

// The card Jonaki made: subject chip, question, right answer, "you answered",
// the memory hook and the "ready now" line. Edit turns it into a small
// form in place. Only text: the photo is never part of a card.

const FIELDS = ['question', 'answer', 'yourAnswer', 'hook', 'subject'];

export default function SnapCard({ card, sure, saved, editing, onEditDone, onEditCancel }) {
  const t = useSnapT();
  const [draft, setDraft] = useState(card);

  if (editing) {
    const label = { question: 'snap.card.question', answer: 'snap.card.answer', yourAnswer: 'snap.card.yours', hook: 'snap.card.hook', subject: 'snap.card.subject' };

    return (
      <form
        className="snap-card snap-card-edit"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.question.trim() && draft.answer.trim()) onEditDone(draft);
        }}
      >
        {FIELDS.map((field) => (
          <label key={field} className="snap-field">
            <span>{t(label[field])}</span>
            {field === 'question' || field === 'hook' ? (
              <textarea rows={field === 'question' ? 3 : 2} value={draft[field] || ''} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} />
            ) : (
              <input value={draft[field] || ''} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} />
            )}
          </label>
        ))}
        <div className="snap-row">
          <button type="submit" className="snap-primary" disabled={!draft.question.trim() || !draft.answer.trim()}>
            {t('snap.editDone')}
          </button>
          <button type="button" className="snap-secondary" onClick={onEditCancel}>
            {t('snap.cancel')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <article className={`snap-card${sure ? ' is-sure' : ' is-unsure'}${saved ? ' is-saved' : ''}`} aria-live="polite">
      {sure && saved && <span className="snap-sparks" aria-hidden="true" />}
      <span className="snap-chip">{card.subject}</span>
      <div className="snap-q">
        <RichText text={card.question} />
      </div>
      <dl className="snap-facts">
        <div className="snap-fact snap-fact-right">
          <dt>{t('snap.card.answer')}</dt>
          <dd>
            <RichText text={card.answer} />
          </dd>
        </div>
        {card.yourAnswer && (
          <div className="snap-fact snap-fact-yours">
            <dt>{t('snap.card.yours')}</dt>
            <dd>
              <RichText text={card.yourAnswer} />
            </dd>
          </div>
        )}
        {card.hook && (
          <div className="snap-fact snap-fact-hook">
            <dt>{t('snap.card.hook')}</dt>
            <dd>{card.hook}</dd>
          </div>
        )}
      </dl>
      <p className="snap-due">{t('snap.card.due')}</p>
    </article>
  );
}
