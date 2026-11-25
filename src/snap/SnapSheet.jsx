import { useEffect, useRef, useState } from 'react';
import Jonaki from '../components/Jonaki';
import QuickAdd from '../components/QuickAdd';
import { useI18n } from '../i18n';
import { track } from '../track';
import { haptic } from '../haptics';
import { PRO } from '../proConfig';
import { priceOf } from '../pricing';
import { canonicalCategory, canonicalSubject, getSubjectNames } from '../subjects';
import { useOnline } from '../loop/useRound';
import { recordActivity } from '../streak/activity';
import { MAX_BYTES, resizeImage } from './resizeImage';
import { requestSnap, snapAllowance, tomorrowMorningDhaka } from './snapClient';
import SnapCard from './SnapCard';
import ImportPanel from './ImportPanel';
import { useSnapT, waitText } from './strings';
import './snap.css';

// Snap a mistake (company/product/phase2-snap.md): one action, one card.
// Views: entry, photo (chosen, not sent), loading, card, unreadable, error,
// limit, manual (the old Quick add form), import.
// Events carry sizes and outcomes only, never text or the image.

const TEXT_MAX = 600;
const FIRST_KEY = 'mnemoq-snapped';
const REASON_KEY = { blurry: 'snap.err.unreadable', no_text: 'snap.err.unreadable', not_study: 'snap.err.notStudy', unsafe: 'snap.err.notStudy', no_answer: 'snap.err.noAnswer' };
const ERROR_KEY = { busy: 'snap.err.busy', network: 'snap.err.network', config: 'snap.err.config', too_long: 'snap.err.tooLong', too_big: 'snap.err.tooBig', auth: 'snap.err.auth', save: 'snap.err.save' };

const icon = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const CameraIcon = () => (
  <svg {...icon}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);
const PictureIcon = () => (
  <svg {...icon}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="M4 18l5-5 4 4 3-3 4 4" />
  </svg>
);

function firstSnap() {
  try {
    if (localStorage.getItem(FIRST_KEY)) return false;
    localStorage.setItem(FIRST_KEY, '1');
  } catch {
    return false;
  }

  return true;
}

export default function SnapSheet({ cards = [], from = 'tab', onSave, onUpdate, onRemove, onTryNow, onClose, onPro, onReviewNow }) {
  const t = useSnapT();
  const { lang } = useI18n();
  const online = useOnline();
  const [view, setView] = useState('entry');
  const [quota, setQuota] = useState(null); // { remaining, limit, pro, resetsAt }
  const [photo, setPhoto] = useState(null); // { base64, bytes, dataUrl, mode }
  const [text, setText] = useState('');
  const [offlineAnswer, setOfflineAnswer] = useState('');
  const [mode, setMode] = useState('text');
  const [slow, setSlow] = useState(false);
  const [result, setResult] = useState(null); // { card, sure, multi }
  const [savedId, setSavedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(false);
  const [problem, setProblem] = useState(null); // { key, retry: bool }
  const [toast, setToast] = useState('');
  const [limitKind, setLimitKind] = useState(null); // null | 'after' | 'blocked'
  const pasted = useRef(false);
  const controller = useRef(null);
  const savedAt = useRef(0);
  const opened = useRef(false);

  const subjects = getSubjectNames(cards).slice(0, 12);
  const isPro = Boolean(quota?.pro);
  const left = quota?.remaining ?? null;

  useEffect(() => {
    let live = true;

    snapAllowance().then((data) => {
      if (!live) return;
      if (data) setQuota(data);
      if (!opened.current) {
        opened.current = true;
        track('snap_open', { from, left: data?.remaining ?? null, pro: Boolean(data?.pro) });
      }
      if (data && data.remaining === 0) showLimit('blocked', data);
    });

    return () => {
      live = false;
      controller.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  function showLimit(kind, data = quota) {
    setLimitKind(kind);
    track('snap_limit_hit', { pro: Boolean(data?.pro), kind, limit: data?.limit ?? null });
    if (kind === 'blocked') setView('limit');
  }

  function reset() {
    controller.current?.abort();
    setPhoto(null);
    setText('');
    setOfflineAnswer('');
    setResult(null);
    setSavedId(null);
    setEditing(false);
    setEdited(false);
    setProblem(null);
    setLimitKind(null);
    setView(left === 0 ? 'limit' : 'entry');
  }

  async function pickPhoto(event, source) {
    const file = event.target.files?.[0];

    event.target.value = '';
    if (!file) return;

    try {
      const shrunk = await resizeImage(file);

      setPhoto({ ...shrunk, mode: source });
      setProblem(null);
      setView('photo');
    } catch (error) {
      setProblem({ key: error?.message === 'too_big' ? 'snap.err.tooBig' : 'snap.err.unreadable', retry: false });
      setView('entry');
    }
  }

  function toCard(raw) {
    const subject = canonicalSubject(raw.subject, cards) || raw.subject || 'General';

    return { ...raw, subject, category: canonicalCategory(subject, raw.category, cards) || raw.category || 'Snapped' };
  }

  async function save(card, auto) {
    const outcome = await onSave({
      subject: card.subject,
      category: card.category,
      question: card.question,
      correctAnswer: card.answer,
      yourAnswer: card.yourAnswer || '',
      explanation: card.hook || '',
      distractors: card.distractors || [],
      nextReviewAt: tomorrowMorningDhaka().toISOString(),
      method: 'snap',
    });

    if (outcome?.error) {
      setProblem({ key: 'snap.err.save', retry: false });
      haptic.error();
      track('snap_fail', { code: 'failed', mode });
      return null;
    }

    savedAt.current = Date.now();
    setSavedId(outcome.id);
    setToast(t('snap.saved'));
    recordActivity('snap');
    track('snap_saved', { auto, edited, first: firstSnap(), subject_changed: Boolean(result && card.subject !== result.card.subject) });

    return outcome.id;
  }

  async function send(kind) {
    const isPhoto = kind === 'photo';
    const body = isPhoto
      ? { mode: 'photo', image: photo.base64, subjects, language: lang }
      : { mode: 'text', text: text.trim(), subjects, language: lang };
    const inputMode = isPhoto ? photo.mode : pasted.current ? 'paste' : 'text';

    if (!isPhoto && text.trim().length > TEXT_MAX) {
      setProblem({ key: 'snap.err.tooLong', retry: false });
      return;
    }

    setMode(inputMode);
    track('snap_input', { mode: inputMode, kb: isPhoto ? Math.round(photo.bytes / 1024) : 0, chars: isPhoto ? 0 : text.trim().length });

    controller.current?.abort();
    controller.current = new AbortController();
    setProblem(null);
    setSlow(false);
    setView('loading');

    const started = Date.now();
    const slowTimer = setTimeout(() => setSlow(true), 8000);

    try {
      const data = await requestSnap(body, controller.current.signal);
      const ms = Date.now() - started;
      const next = { remaining: data.remaining ?? null, limit: data.limit ?? quota?.limit ?? null, pro: Boolean(data.pro), proLimit: data.proLimit ?? quota?.proLimit ?? null, resetsAt: data.resetsAt || null };

      setQuota(next);
      track('snap_result', {
        ok: true,
        mode: inputMode,
        readable: Boolean(data.readable),
        reason: data.reason || null,
        sure: Boolean(data.card?.sure),
        multi: Boolean(data.card?.multi),
        ms,
        tokens: data.tokens ?? null,
        model: data.model || null,
        lang,
        src_lang: data.card?.srcLang || null,
      });

      if (!data.readable) {
        setProblem({ key: REASON_KEY[data.reason] || 'snap.err.unreadable', retry: false, free: true });
        setView('unreadable');
        haptic.error();
        return;
      }

      const card = toCard(data.card);

      setResult({ card, sure: card.sure, multi: card.multi });
      setEdited(false);
      setView('card');

      if (card.sure) {
        haptic.correct();
        await save(card, true);
      }

      if (next.remaining === 0) showLimit('after', next);
    } catch (error) {
      if (error?.name === 'AbortError') return;

      const code = error?.code || 'failed';

      track('snap_result', { ok: false, mode: inputMode, ms: Date.now() - started, lang });

      if (code === 'limit') {
        const next = { remaining: 0, limit: error.limit ?? quota?.limit ?? null, pro: Boolean(error.pro ?? quota?.pro), proLimit: error.proLimit ?? quota?.proLimit ?? null, resetsAt: error.resetsAt || null };

        setQuota(next);
        showLimit('blocked', next);
        return;
      }

      track('snap_fail', { code: ['network', 'busy', 'config', 'input'].includes(code) ? code : 'failed', mode: inputMode });
      haptic.error();
      setProblem({ key: ERROR_KEY[code] || 'snap.err.failed', retry: code !== 'config' && code !== 'auth', free: true, config: code === 'config' });
      setView('error');
    } finally {
      clearTimeout(slowTimer);
    }
  }

  async function keep() {
    const id = await save(result.card, false);
    if (id) setResult({ ...result, sure: true });
  }

  async function finishEdit(draft) {
    const card = { ...result.card, ...draft, subject: canonicalSubject(draft.subject, cards) || draft.subject || 'General' };

    setEditing(false);
    setEdited(true);
    setResult({ ...result, card });

    if (savedId) {
      const outcome = await onUpdate(savedId, {
        subject: card.subject,
        category: card.category,
        question: card.question,
        correctAnswer: card.answer,
        yourAnswer: card.yourAnswer || '',
        explanation: card.hook || '',
        distractors: card.distractors,
      });

      if (outcome?.error) setProblem({ key: 'snap.err.save', retry: false });
    }
  }

  async function undo() {
    if (!savedId) return;

    track('snap_undo', { after_ms: Date.now() - savedAt.current });

    const outcome = await onRemove(savedId);

    if (outcome?.error) {
      setProblem({ key: 'snap.err.save', retry: false });
      return;
    }

    reset();
    setToast(t('snap.undone'));
  }

  async function saveOffline() {
    const card = { subject: subjects[0] || 'General', category: 'Snapped', question: text.trim(), answer: offlineAnswer.trim(), yourAnswer: '', hook: '', distractors: [] };

    const subject = canonicalSubject(card.subject, cards) || card.subject;
    const outcome = await onSave({
      subject,
      category: canonicalCategory(subject, card.category, cards) || card.category,
      question: card.question,
      correctAnswer: card.answer,
      yourAnswer: '',
      explanation: '',
      nextReviewAt: tomorrowMorningDhaka().toISOString(),
      method: 'snap_offline',
    });

    if (outcome?.error) {
      setProblem({ key: 'snap.err.save', retry: false });
      return;
    }

    setText('');
    setOfflineAnswer('');
    setToast(t('snap.saved'));
  }

  function limitChoice(choice) {
    track('snap_limit_choice', { choice });
    if (choice === 'pro') onPro();
    else if (choice === 'manual') setView('manual');
    else onClose();
  }

  // ---- pieces -----------------------------------------------------------------

  const wait = quota?.resetsAt ? waitText(t, quota.resetsAt) : null;
  const proPrice = priceOf(PRO.offers[0]).now;

  const limitPanel = (
    <section className="snap-limit" aria-labelledby="snap-limit-title">
      {limitKind === 'after' && <p className="snap-note">{t('snap.limit.after')}</p>}
      <h3 id="snap-limit-title">{t('snap.limit.title', { limit: quota?.limit ?? 5 })}</h3>
      <p>{wait ? t('snap.limit.body', { time: wait.text }) : t('snap.limit.bodyLater')}</p>
      <div className={`snap-limit-buttons${isPro ? ' is-single' : ''}`}>
        {!isPro && (
          <button type="button" className="snap-equal" onClick={() => limitChoice('pro')}>
            {t('snap.limit.pro')}
          </button>
        )}
        <button type="button" className="snap-equal" onClick={() => limitChoice('later')}>
          {wait?.soon ? t('snap.limit.laterSoon', { time: wait.text }) : t('snap.limit.later')}
        </button>
      </div>
      {!isPro && quota?.proLimit && <p className="snap-note">{t('snap.limit.proLine', { price: proPrice, n: quota.proLimit })}</p>}
      <button type="button" className="snap-secondary snap-wide" onClick={() => limitChoice('manual')}>
        {t('snap.limit.manual')}
      </button>
    </section>
  );

  const problemLine = problem && (
    <div className="snap-problem" role="alert">
      <p>{t(problem.key)}</p>
      {problem.free && <p className="snap-note">{t('snap.err.free')}</p>}
    </div>
  );

  // ---- views -----------------------------------------------------------------

  if (view === 'manual') {
    return (
      <div className="snap-sheet snap-sheet-manual">
        <button type="button" className="snap-link" onClick={reset}>
          ← {t('snap.back')}
        </button>
        <QuickAdd cards={cards} onSave={onSave} onClose={reset} onReviewNow={onReviewNow} />
      </div>
    );
  }

  if (view === 'import') {
    return (
      <div className="snap-sheet">
        <ImportPanel cards={cards} onSave={onSave} onManual={() => setView('manual')} onBack={reset} />
      </div>
    );
  }

  return (
    <div className="snap-sheet" data-view={view}>
      <header className="snap-head">
        <Jonaki mood={view === 'loading' ? 'think' : view === 'card' && result?.sure ? 'happy' : view === 'error' || view === 'unreadable' ? 'oops' : 'idle'} size={56} />
        <div>
          <h2>{t('snap.title')}</h2>
          {view === 'entry' && <p className="snap-sub">{t('snap.sub')}</p>}
        </div>
        <button type="button" className="snap-close" onClick={onClose} aria-label={t('snap.close')}>
          ×
        </button>
      </header>

      {toast && (
        <p className="snap-toast" role="status">
          {toast}
        </p>
      )}

      {view === 'limit' && limitPanel}

      {view === 'entry' && (
        <>
          {cards.length === 0 && <p className="snap-first">{t('snap.first')}</p>}
          {!isPro && left !== null && left < 3 && left > 0 && <span className="snap-quota">{t('snap.left', { n: left })}</span>}
          {problemLine}

          <div className="snap-choices">
            <label className={`snap-choice snap-choice-big${online ? '' : ' is-disabled'}`}>
              <input type="file" accept="image/*" capture="environment" disabled={!online} onChange={(e) => pickPhoto(e, 'camera')} />
              <CameraIcon /> {t('snap.camera')}
            </label>
            <label className={`snap-choice snap-choice-big${online ? '' : ' is-disabled'}`}>
              <input type="file" accept="image/*" disabled={!online} onChange={(e) => pickPhoto(e, 'gallery')} />
              <PictureIcon /> {t('snap.gallery')}
            </label>
          </div>
          {!online && <p className="snap-note snap-offline">{t('snap.offline.photo')}</p>}

          <form
            className="snap-type"
            onSubmit={(event) => {
              event.preventDefault();
              if (online) send('text');
              else if (offlineAnswer.trim()) saveOffline();
            }}
          >
            <label htmlFor="snap-text" className="snap-type-label">
              {t('snap.type.label')}
            </label>
            <textarea
              id="snap-text"
              rows={3}
              value={text}
              placeholder={t('snap.type.placeholder')}
              onPaste={() => {
                pasted.current = true;
              }}
              onChange={(e) => {
                if (!e.target.value) pasted.current = false;
                setText(e.target.value);
                if (problem?.key === 'snap.err.tooLong' && e.target.value.length <= TEXT_MAX) setProblem(null);
              }}
            />
            <span className={`snap-count${text.length > TEXT_MAX ? ' is-over' : ''}`}>{t('snap.type.count', { n: text.length })}</span>
            {!online && (
              <label className="snap-field">
                <span>{t('snap.offline.answer')}</span>
                <input value={offlineAnswer} onChange={(e) => setOfflineAnswer(e.target.value)} maxLength={300} />
              </label>
            )}
            <button type="submit" className="snap-primary" disabled={!text.trim() || (!online && !offlineAnswer.trim())}>
              {online ? t('snap.type.go') : t('snap.offline.save')}
            </button>
          </form>

          <div className="snap-links">
            <button type="button" className="snap-link" onClick={() => setView('manual')}>
              {t('snap.manual')}
            </button>
            <button type="button" className="snap-link" onClick={() => setView('import')}>
              {t('snap.import')}
            </button>
          </div>
          <p className="snap-privacy">{t('snap.privacy')}</p>
        </>
      )}

      {view === 'photo' && photo && (
        <div className="snap-photo">
          <img src={photo.dataUrl} alt={t('snap.photo.alt')} />
          <div className="snap-row">
            <button type="button" className="snap-primary" onClick={() => send('photo')} disabled={!online || photo.bytes > MAX_BYTES}>
              {t('snap.photo.use')}
            </button>
            <button type="button" className="snap-secondary" onClick={reset}>
              {t('snap.photo.retake')}
            </button>
          </div>
          <p className="snap-privacy">{t('snap.privacy')}</p>
        </div>
      )}

      {view === 'loading' && (
        <div className="snap-loading" aria-busy="true">
          <p className="snap-status" role="status">
            {mode === 'camera' || mode === 'gallery' ? t('snap.reading') : t('snap.making')}
          </p>
          <div className="snap-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          {slow && <p className="snap-note">{t('snap.slow')}</p>}
          <button type="button" className="snap-link" onClick={reset}>
            {t('snap.cancel')}
          </button>
        </div>
      )}

      {view === 'card' && result && (
        <div className="snap-result">
          {result.multi && <p className="snap-note">{t('snap.err.many')}</p>}
          {!result.sure && !savedId && <p className="snap-unsure">{t('snap.unsure')}</p>}
          {problemLine}
          <SnapCard
            key={edited ? 'edited' : 'fresh'}
            card={result.card}
            sure={result.sure}
            saved={Boolean(savedId)}
            editing={editing}
            onEditDone={finishEdit}
            onEditCancel={() => setEditing(false)}
          />
          {!editing && savedId && (
            <div className="snap-actions">
              <button type="button" className="snap-primary" onClick={reset}>
                {t('snap.another')}
              </button>
              <button
                type="button"
                className="snap-secondary"
                onClick={() => {
                  track('snap_try_now');
                  onTryNow(savedId);
                }}
              >
                {t('snap.tryNow')}
              </button>
              <button
                type="button"
                className="snap-secondary"
                onClick={() => {
                  track('snap_edit', { field: 'card' });
                  setEditing(true);
                }}
              >
                {t('snap.edit')}
              </button>
              <button type="button" className="snap-secondary" onClick={undo}>
                {t('snap.undo')}
              </button>
            </div>
          )}
          {!editing && !savedId && (
            <div className="snap-actions">
              <button type="button" className="snap-primary" onClick={keep}>
                {t('snap.keep')}
              </button>
              <button
                type="button"
                className="snap-secondary"
                onClick={() => {
                  track('snap_edit', { field: 'card' });
                  setEditing(true);
                }}
              >
                {t('snap.edit')}
              </button>
            </div>
          )}
          {limitKind === 'after' && savedId && limitPanel}
        </div>
      )}

      {(view === 'unreadable' || view === 'error') && (
        <div className="snap-failed">
          {problemLine}
          {photo && view === 'unreadable' && <img className="snap-photo-small" src={photo.dataUrl} alt={t('snap.photo.alt')} />}
          <div className="snap-row">
            {problem?.retry && (
              <button type="button" className="snap-primary" onClick={() => send(photo && mode !== 'text' && mode !== 'paste' ? 'photo' : 'text')}>
                {t('snap.err.retry')}
              </button>
            )}
            {problem?.config ? (
              <button type="button" className="snap-primary" onClick={() => setView('manual')}>
                {t('snap.manual')}
              </button>
            ) : (
              <>
                {photo && (
                  <button type="button" className="snap-secondary" onClick={() => { setPhoto(null); setView('entry'); setProblem(null); }}>
                    {t('snap.photo.retake')}
                  </button>
                )}
                <button type="button" className="snap-secondary" onClick={() => { setPhoto(null); setView('entry'); setProblem(null); }}>
                  {t('snap.err.typeInstead')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
