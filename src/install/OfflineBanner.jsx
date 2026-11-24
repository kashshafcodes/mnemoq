import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { dailyReadyOffline } from './runtime';
import { installText } from './strings';
import './install.css';

// A thin, honest banner while the device is offline: what still works and
// what needs a connection. Says "Back online." for a moment when it returns.
export default function OfflineBanner() {
  const { lang } = useI18n();
  const t = installText(lang);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const [back, setBack] = useState(false);

  useEffect(() => {
    let timer = null;
    const goOffline = () => {
      clearTimeout(timer);
      setBack(false);
      setOnline(false);
    };
    const goOnline = () => {
      setOnline(true);
      setBack(true);
      timer = setTimeout(() => setBack(false), 3000);
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (online && !back) return null;

  // On the Daily page the round is already loaded, so it plays either way.
  const onDaily = window.location.pathname.replace(/\/+$/, '') === '/daily';
  const text = online ? t.back : onDaily || dailyReadyOffline() ? t.offline : t.offlineNoDaily;

  return (
    <div className={online ? 'offline-banner is-back' : 'offline-banner'} role="status" aria-live="polite">
      {text}
    </div>
  );
}
