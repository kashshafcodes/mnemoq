import { MnemoqMark } from './MnemoqLogo';

// Shown for a moment while a page's code loads (pages load on demand).
// Waits 150 ms before appearing, so fast loads do not flash.
export default function PageLoading() {
  return (
    <div className="mq-page-loading" role="status" aria-live="polite">
      <MnemoqMark size={32} />
      <span className="mq-visually-hidden">Loading…</span>
    </div>
  );
}
