import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { jonakiGlow } from '../glow/glow';
import { earn, useGlow } from '../glow/store';
import { useOnline } from '../loop/useRound';
import { feel } from '../sensory';
import { canvasToBlob } from '../shareCard';
import { track } from '../track';
import { drawCard } from './drawCard';
import { cardModel } from './model';
import { shareT } from './strings';
import './share.css';

// The one share sheet (spec phase2-share-card §3, §5, §6) for the Daily card,
// the diagnostic card and the weekly recap: a preview, the card language,
// then Share (the phone's share sheet with the image), Save image, Copy link
// and WhatsApp. A real share (not Save, not a cancelled sheet) can pay +3 Glow
// once per card subject, 1 a day and 3 a week (perks spec §1, glow.js).

const REWARDED = new Set(['image', 'link', 'whatsapp', 'copy']);

export default function ShareSheet({ variant, data, lang = 'en', userId = null, onClose }) {
  const t = useMemo(() => shareT(lang), [lang]);
  const [cardLang, setCardLang] = useState(lang);
  const model = useMemo(() => cardModel(variant, cardLang, data, userId), [variant, cardLang, data, userId]);
  const { total } = useGlow();
  const glowRef = useRef(jonakiGlow(total));
  const online = useOnline();
  const [img, setImg] = useState({ state: 'drawing', url: '' });
  const [note, setNote] = useState('');
  const blobRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    track('share_card_open', { variant });
    dialogRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose?.();

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variant, onClose]);

  // Draw the card on the device whenever the card language changes.
  useEffect(() => {
    let alive = true;
    let objectUrl = '';

    setImg({ state: 'drawing', url: '' });
    blobRef.current = null;
    drawCard(model, { glow: glowRef.current })
      .then(canvasToBlob)
      .then((blob) => {
        if (!alive) return;
        if (!blob) throw new Error('export');
        blobRef.current = blob;
        objectUrl = URL.createObjectURL(blob);
        setImg({ state: 'ready', url: objectUrl });
      })
      .catch(() => {
        if (!alive) return;
        setImg({ state: 'error', url: '' });
        track('share_card_error', { variant, stage: 'draw' });
      });

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [model, variant]);

  // After a share resolves: the event, the Daily's old event, and the Glow perk.
  function shared(how) {
    const reward = REWARDED.has(how) ? earn({ type: 'share', variant, subject: model.subject, how }, { quiet: true }) : null;
    const rewarded = Boolean(reward && reward.amount > 0);

    track('share_card', { variant, how, lang: cardLang, rewarded, ...(variant === 'diag' ? { path: data.pathId } : {}) });
    if (variant === 'daily') track('daily_share', { page: 'daily', number: data.number, score: data.score, how });

    if (rewarded) {
      track('share_reward', { variant, glow: reward.amount, capped: false });
      feel('glow.gain', { n: reward.amount });
      setNote(t('perk.share.earned'));
    } else if (reward && (reward.reason === 'shareDay' || reward.reason === 'shareWeek' || reward.reason === 'cap')) {
      track('share_reward', { variant, glow: 0, capped: true });
      setNote(t('perk.share.capped'));
    }
  }

  async function share() {
    feel('tap.primary');
    const blob = blobRef.current;
    const file = blob ? new File([blob], model.fileName, { type: 'image/png' }) : null;

    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: model.message });
        shared('image');
        return;
      }
      if (navigator.share) {
        await navigator.share({ text: model.message });
        shared('link');
        return;
      }
      await copy(true);
    } catch (err) {
      if (err?.name === 'AbortError') return; // cancelled: silent, and no Glow
      track('share_card_error', { variant, stage: 'share' });
      setNote(t('share.err.share'));
    }
  }

  function save() {
    feel('tap.secondary');
    if (!img.url) return;
    const a = document.createElement('a');

    a.href = img.url;
    a.download = model.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    shared('download');
    setNote(t('share.saved'));
  }

  async function copy(quietTap = false) {
    if (!quietTap) feel('tap.secondary');
    try {
      await navigator.clipboard.writeText(variant === 'daily' ? model.message : model.link);
      setNote(t('share.copied'));
      shared('copy');
    } catch {
      setNote(model.link);
    }
  }

  function toggleLang(to) {
    if (to === cardLang) return;
    feel('tap.secondary');
    track('share_lang_toggle', { variant, to });
    setCardLang(to);
  }

  // A portal, so no screen's stacking (the Daily's sparks layer) sits on top.
  return createPortal(
    <div className="shs-backdrop fx-scrim" onClick={onClose}>
      <div
        className="shs fx-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shs-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shs-head">
          <h2 id="shs-title">{t(`share.title.${variant}`)}</h2>
          <button type="button" className="shs-close" onClick={onClose} aria-label={t('share.button.close')}>
            ×
          </button>
        </div>

        <div className="shs-preview">
          {img.state === 'ready' ? (
            <img src={img.url} alt={model.alt} />
          ) : img.state === 'drawing' ? (
            <div className="shs-skeleton fx-skeleton" role="status" aria-label={t('share.drawing')} />
          ) : (
            <p className="shs-err">{t('share.err.image')}</p>
          )}
        </div>

        <div className="shs-lang" role="group" aria-label={t('share.lang')}>
          <span>{t('share.lang')}</span>
          {['en', 'bn'].map((l) => (
            <button key={l} type="button" className={`shs-chip${cardLang === l ? ' is-on' : ''}`} aria-pressed={cardLang === l} onClick={() => toggleLang(l)}>
              {l === 'en' ? 'English' : 'বাংলা'}
            </button>
          ))}
        </div>

        <div className="shs-actions">
          <button type="button" className="shs-btn shs-primary" onClick={share} disabled={img.state === 'drawing'}>
            {t('share.button.share')}
          </button>
          <button type="button" className="shs-btn" onClick={save} disabled={img.state !== 'ready'}>
            {t('share.button.save')}
          </button>
          <button type="button" className="shs-btn" onClick={() => copy()}>
            {t('share.button.copy')}
          </button>
          <a
            className="shs-btn"
            href={`https://wa.me/?text=${encodeURIComponent(model.message)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              feel('tap.secondary');
              shared('whatsapp');
            }}
          >
            {t('share.button.whatsapp')}
          </a>
        </div>

        {!online && <p className="shs-note">{t('share.offline')}</p>}
        {note && (
          <p className="shs-note fx-toast" role="status">
            {note}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
