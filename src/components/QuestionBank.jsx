import { useState } from 'react';
import { CoachError, requestImport } from '../coachApi';
import { NO_SUGGEST } from '../noSuggest';
import { LETTERS, bankCount, sectionName } from '../mocks';
import AiBadge from './AiBadge';

// "My questions": the student pastes questions (from papers they own or
// their own notes), the AI reads them into clean multiple choice, and they are
// kept in a personal bank that mock tests can draw from.

const IMPORTABLE = ['english', 'quant'];

export default function QuestionBank({ pathId, bank, onAdd, onDelete }) {
  const [section, setSection] = useState('english');
  const [text, setText] = useState('');
  const [found, setFound] = useState(null); // parsed, not yet saved
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);

  async function read() {
    setBusy(true);
    setMessage('');
    setFound(null);

    try {
      const data = await requestImport(section, text);

      setFound(data.questions);
    } catch (caught) {
      setMessage(caught instanceof CoachError ? caught.message : 'Something went wrong. Try again.');
    }

    setBusy(false);
  }

  async function save() {
    setBusy(true);

    const result = await onAdd(section, found);

    setBusy(false);

    if (result?.error) {
      setMessage(result.error);
      return;
    }

    setMessage(`${found.length} ${found.length === 1 ? 'question' : 'questions'} saved to your bank.`);
    setFound(null);
    setText('');
  }

  const mine = bank.filter((q) => IMPORTABLE.includes(q.sectionId));

  return (
    <div className="bank">
      <button type="button" className="text-link" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide my questions' : `My questions (${bank.length})`}
      </button>

      {open && (
        <div className="bank-body">
          <p className="path-hint">
            Paste questions from papers you own or from your own notes. The AI <AiBadge /> reads them into multiple choice
            and solves any that have no answer key (those are marked, so check them). Questions that need a diagram or a
            reading passage are not supported yet.
          </p>

          <label htmlFor="bank-section">Section</label>
          <select id="bank-section" value={section} onChange={(e) => setSection(e.target.value)}>
            {IMPORTABLE.map((id) => (
              <option key={id} value={id}>
                {sectionName(pathId, id)} ({bankCount(bank, id)} saved)
              </option>
            ))}
          </select>

          <label htmlFor="bank-text">Questions</label>
          <textarea
            id="bank-text"
            rows={8}
            value={text}
            maxLength={8000}
            onChange={(e) => setText(e.target.value)}
            placeholder={'1. If x + 3 = 10, what is x?\nA) 5  B) 6  C) 7  D) 8  E) 9\nAnswer: C'}
            {...NO_SUGGEST}
          />
          <button type="button" className="qa-primary" disabled={busy || text.trim().length < 20} onClick={read}>
            {busy && !found ? 'The AI is reading...' : 'Read with AI'}
          </button>

          {message && (
            <p className="path-hint" role="status">
              {message}
            </p>
          )}

          {found && (
            <div className="bank-found">
              <p>
                <b>{found.length}</b> {found.length === 1 ? 'question' : 'questions'} found. Check them, then save.
              </p>
              <ol>
                {found.map((q) => (
                  <li key={q.question}>
                    <span>{q.question}</span>
                    <small>
                      Answer: {LETTERS[q.answer]}) {q.options[q.answer]} {q.aiKey ? '· chosen by the AI, please check' : '· from your text'}
                    </small>
                  </li>
                ))}
              </ol>
              <div className="diag-actions">
                <button type="button" className="qa-primary" disabled={busy} onClick={save}>
                  {busy ? 'Saving...' : 'Save to my bank'}
                </button>
                <button type="button" className="ghost-button" onClick={() => setFound(null)}>
                  Discard
                </button>
              </div>
            </div>
          )}

          {mine.length > 0 && (
            <ul className="bank-list">
              {mine.slice(-30).map((q) => (
                <li key={q.id}>
                  <span>
                    <small>{sectionName(pathId, q.sectionId)}</small> {q.question}
                  </span>
                  <button type="button" className="text-link" onClick={() => onDelete(q.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
