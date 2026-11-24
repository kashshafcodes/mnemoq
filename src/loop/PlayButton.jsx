import { SESSION_SIZE } from '../quiz';
import { useLoopT } from './strings';
import './loop.css';

// The one big button on Today (Home). Its state comes from playState():
// review the cards that are fading, else tonight's Daily, else "Done".
// On phones it floats just above the tab bar, where the thumb rests.

function PlayIcon({ done }) {
  return done ? (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor" />
    </svg>
  );
}

export default function PlayButton({ state, onPlay, floating = true, className = '' }) {
  const t = useLoopT();
  const { kind, n } = state;
  const vars = { n, size: SESSION_SIZE };
  const done = kind === 'done';

  return (
    <div className={`mq-play mq-play-${kind}${floating ? ' mq-play-float' : ''} ${className}`.trim()}>
      <button type="button" className="mq-play-btn" onClick={onPlay} aria-label={t(`play.aria.${kind}`, vars)}>
        <span className="mq-play-icon">
          <PlayIcon done={done} />
        </span>
        <span className="mq-play-text">
          <b>{done ? t('play.doneLabel') : t('play.title')}</b>
          <small>{t(`play.${kind}`, vars)}</small>
        </span>
      </button>
    </div>
  );
}
