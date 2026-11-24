import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { track } from '../track';
import { countVisit, detectPlatform, installOffer, isStandalone, loadInstallState, updateInstallState } from './installLogic';
import { clearDeferredPrompt, dailyReadyOffline, getDeferredPrompt, onRoundDone } from './runtime';
import { installText } from './strings';
import './install.css';

// "**Share**" -> <b>Share</b>
const bold = (text) => text.split(/\*\*(.+?)\*\*/).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="inst-share-icon">
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Lantern() {
  return (
    <svg viewBox="0 0 32 32" width="36" height="36" aria-hidden="true" className="inst-lantern">
      <circle cx="16" cy="16" r="10" fill="var(--highlight)" opacity="0.25" />
      <circle cx="16" cy="16" r="5.5" fill="var(--highlight)" />
    </svg>
  );
}

// The small "add to home screen" card. Mounted once for the whole app (and the
// Daily page) from main.jsx; it stays invisible until a round is finished on
// a later visit, and never shows inside the installed app.
export default function InstallPrompt() {
  const { lang } = useI18n();
  const t = installText(lang);
  const [offer, setOffer] = useState(null); // 'android' | 'ios' | null
  const [toast, setToast] = useState('');
  const platform = useRef('other');

  useEffect(() => {
    if (isStandalone()) return undefined;

    platform.current = detectPlatform(navigator.userAgent, navigator.maxTouchPoints || 0);
    countVisit();

    return onRoundDone(() => {
      const next = installOffer(loadInstallState(), {
        standalone: isStandalone(),
        platform: platform.current,
        canPrompt: Boolean(getDeferredPrompt()),
      });

      if (!next) return;

      // Let the end-of-round screen land first.
      setTimeout(() => {
        setOffer(next);
        track('install_prompt_shown', { platform: next });
      }, 1200);
    });
  }, []);

  function dismiss() {
    updateInstallState({ dismissedAt: Date.now() });
    track('install_dismissed', { platform: offer });
    setOffer(null);
  }

  async function install() {
    const prompt = getDeferredPrompt();

    if (!prompt) {
      setOffer(null);
      return;
    }

    clearDeferredPrompt();
    prompt.prompt();

    try {
      const choice = await prompt.userChoice;

      if (choice?.outcome === 'accepted') {
        updateInstallState({ installed: true });
        track('install_accepted', { platform: 'android' });
        setToast(t.done);
        setTimeout(() => setToast(''), 4000);
      } else {
        updateInstallState({ dismissedAt: Date.now() });
        track('install_dismissed', { platform: 'android', via: 'browser' });
      }
    } catch {
      // The browser refused to show it; nothing to do.
    }

    setOffer(null);
  }

  if (toast) {
    return (
      <div className="inst-toast" role="status">
        {toast}
      </div>
    );
  }

  if (offer === 'android') {
    return (
      <aside className="inst-card" role="dialog" aria-labelledby="inst-title">
        <Lantern />
        <div className="inst-text">
          <h3 id="inst-title">{t.androidTitle}</h3>
          <p>{dailyReadyOffline() ? t.androidBodyOffline : t.androidBody}</p>
        </div>
        <div className="inst-actions">
          <button type="button" className="mq-btn mq-btn-primary" onClick={install}>
            {t.install}
          </button>
          <button type="button" className="mq-btn mq-btn-ghost" onClick={dismiss}>
            {t.notNow}
          </button>
        </div>
      </aside>
    );
  }

  if (offer === 'ios') {
    return (
      <div className="inst-overlay" role="presentation" onClick={(e) => e.target === e.currentTarget && dismiss()}>
        <aside className="inst-sheet" role="dialog" aria-modal="true" aria-labelledby="inst-ios-title">
          <h3 id="inst-ios-title">{t.iosTitle}</h3>
          <p className="inst-intro">{t.iosIntro}</p>
          <ol className="inst-steps">
            <li>
              <ShareIcon /> <span>{bold(t.iosStep1)}</span>
            </li>
            <li>
              <span className="inst-plus" aria-hidden="true">
                +
              </span>{' '}
              <span>{bold(t.iosStep2)}</span>
            </li>
            <li>
              <img src="/icon-192.png" alt="" width="20" height="20" className="inst-app-icon" /> <span>{bold(t.iosStep3)}</span>
            </li>
          </ol>
          <p className="inst-why">{t.iosWhy}</p>
          <button type="button" className="mq-btn mq-btn-primary mq-btn-block" onClick={dismiss}>
            {t.iosClose}
          </button>
        </aside>
      </div>
    );
  }

  return null;
}
