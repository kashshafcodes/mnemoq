import { lazy, Suspense, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { feel } from '../sensory';
import { shareT } from './strings';

const ShareSheet = lazy(() => import('./ShareSheet'));

// "Challenge your friends" on the diagnostic report: one button that opens
// the share sheet with the diagnostic card. data: see model.js (diag).
export default function DiagShare({ data, userId }) {
  const { lang } = useI18n();
  const t = shareT(lang);
  const [open, setOpen] = useState(false);
  const key = JSON.stringify(data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useMemo(() => data, [key]);

  return (
    <section className="rp-card rp-share" aria-labelledby="share-title">
      <div className="rp-share-text">
        <p className="lp-kicker">{t('share.title.diag')}</p>
        <h2 id="share-title">{stable.score >= (stable.scaleMin + stable.scaleMax) / 2 ? t('card.diag.strong') : t('card.diag.start')}</h2>
        <p className="rp-muted">{t('share.diag.body')}</p>
        <div className="rp-share-actions">
          <button
            type="button"
            className="mq-btn mq-btn-primary"
            onClick={() => {
              feel('tap.primary');
              setOpen(true);
            }}
          >
            {t('share.diag.open')}
          </button>
        </div>
      </div>
      {open && (
        <Suspense fallback={null}>
          <ShareSheet variant="diag" data={stable} lang={lang} userId={userId} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </section>
  );
}
