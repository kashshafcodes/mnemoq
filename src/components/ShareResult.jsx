import { useEffect, useRef, useState } from 'react';
import { canvasToBlob, drawShareCard, shareLink } from '../shareCard';
import { track } from '../track';

// "Challenge your friends" on the diagnostic report: a preview of the story
// card, a Share button (phone share sheet with the image), Download, Copy link
// and WhatsApp. Every link is personal, so a friend's visit and sign-up are
// credited to this student on the Stats page (utm_source=friend).

export default function ShareResult({ data, userId }) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const blobRef = useRef(null);
  const link = shareLink(data.pathId, userId);
  const strong = (data.score - data.scaleMin) / (data.scaleMax - data.scaleMin) >= 0.5;
  const message = `${data.isSat ? `My SAT estimate on Mnemoq: ${data.score}.` : `My ${data.short} readiness on Mnemoq: ${data.score}/100.`} ${strong ? 'আমাকে হারাতে পারবে?' : 'এখান থেকে শুরু। তুমি কোথা থেকে শুরু করবে?'} Free ${data.isSat ? 25 : 20}-minute check: ${link}`;
  const dataKey = JSON.stringify(data);

  useEffect(() => {
    let alive = true;
    let objectUrl = '';

    drawShareCard(JSON.parse(dataKey))
      .then(canvasToBlob)
      .then((blob) => {
        if (!alive || !blob) return;
        blobRef.current = blob;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      });

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [dataKey]);

  const fileName = `mnemoq-${data.pathId || 'result'}.png`;

  async function share() {
    const blob = blobRef.current;
    const file = blob ? new File([blob], fileName, { type: 'image/png' }) : null;

    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: message });
        track('share_card', { path: data.pathId, how: 'image' });
        return;
      }
      if (navigator.share) {
        await navigator.share({ text: message, url: link });
        track('share_card', { path: data.pathId, how: 'link' });
        return;
      }
      download();
    } catch (err) {
      if (err?.name !== 'AbortError') setStatus('Sharing did not work here. Download the image or copy the link instead.');
    }
  }

  function download() {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    track('share_card', { path: data.pathId, how: 'download' });
    setStatus('Image saved. Post it to your story and add your link with the link sticker.');
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setStatus('Link copied.');
    } catch {
      setStatus(link);
    }
    track('share_card', { path: data.pathId, how: 'copy' });
  }

  return (
    <section className="rp-card rp-share" aria-labelledby="share-title">
      <div className="rp-share-text">
        <p className="lp-kicker">Challenge your friends</p>
        <h2 id="share-title">{strong ? 'আমাকে হারাতে পারবে?' : 'এখান থেকে শুরু। বন্ধুরা কোথা থেকে শুরু করবে?'}</h2>
        <p className="rp-muted">
          Post your result to your story or send it to your batch. Your friends take the same free check, with no sign-up needed to start.
        </p>
        <div className="rp-share-actions">
          <button type="button" className="mq-btn mq-btn-primary" onClick={share} disabled={!url}>
            Share my result
          </button>
          <button type="button" className="mq-btn mq-btn-ghost" onClick={download} disabled={!url}>
            Download image
          </button>
          <button type="button" className="mq-btn mq-btn-ghost" onClick={copy}>
            Copy link
          </button>
          <a
            className="mq-btn mq-btn-ghost"
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('share_card', { path: data.pathId, how: 'whatsapp' })}
          >
            WhatsApp
          </a>
        </div>
        {status && (
          <p className="rp-share-status" role="status">
            {status}
          </p>
        )}
      </div>
      <div className="rp-share-preview">
        {url ? <img src={url} alt={`Share card: ${data.score} ${data.isSat ? 'estimated SAT score' : 'readiness out of 100'}`} /> : <div className="rp-share-skeleton" aria-hidden="true" />}
      </div>
    </section>
  );
}
