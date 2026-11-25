import { useEffect, useState } from 'react';
import { useNavT } from './strings';
import { takeMoved, MOVED_EVENT } from './moved';
import './nav.css';

// "Moved: this is now Exam." Shown once per old link (#/path, #/profile ...)
// when an old bookmark or saved link is rewritten to the new tabs
// (spec phase2-tabs.md §7, route.moved). Quiet: a status line, gone in 4 s.

const SHOW_MS = 4000;

export default function MovedToast() {
  const t = useNavT();
  const [to, setTo] = useState(() => takeMoved());

  useEffect(() => {
    const onMoved = () => setTo(takeMoved());

    window.addEventListener(MOVED_EVENT, onMoved);

    return () => window.removeEventListener(MOVED_EVENT, onMoved);
  }, []);

  useEffect(() => {
    if (!to) return undefined;

    const timer = setTimeout(() => setTo(null), SHOW_MS);

    return () => clearTimeout(timer);
  }, [to]);

  if (!to) return null;

  return (
    <p className="mq-moved fx-pop" role="status" onClick={() => setTo(null)}>
      {t('route.moved', { name: t(`nav.${to.split('/')[0]}`) })}
    </p>
  );
}
