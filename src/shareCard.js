// The share card: a story-sized (1080×1920) image of a diagnostic result that a
// student can post or send to friends, plus the personal link that brings the
// friend to the same free check. Drawn on a canvas in the browser, so nothing
// about the student leaves their phone unless they choose to share it.
//
// Links carry utm_source=friend and utm_campaign=f-<code>, so the Stats page
// shows how many visitors and sign-ups each student's card brought. The code is
// a short hash of the account id: stable for that person, and it reveals nothing.

export const SITE = 'https://mnemoq-two.vercel.app';

const W = 1080;
const H = 1920;

// Exams that have a free, no-sign-up check a friend can take.
const TRY_PATHS = { sat: 'sat', nsu: 'nsu', brac: 'brac' };

export function refCode(userId) {
  let h = 2166136261;

  for (const ch of String(userId || 'guest')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }

  return (h >>> 0).toString(36).padStart(6, '0').slice(0, 6);
}

export function shareLink(pathId, userId) {
  const slug = TRY_PATHS[pathId] || '';
  const params = new URLSearchParams({ utm_source: 'friend', utm_medium: 'share_card', utm_campaign: `f-${refCode(userId)}` });

  return `${SITE}/${slug}?${params}`;
}

// What the link looks like printed on the card (no tracking tags).
export const printedLink = (pathId) => `mnemoq-two.vercel.app/${TRY_PATHS[pathId] || ''}`.replace(/\/$/, '');

let markPromise = null;

function loadMark() {
  if (!markPromise) {
    markPromise = new Promise((resolve) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/mnemoq-mark.png';
    });
  }

  return markPromise;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Shrinks the font until the text fits the width.
function fitText(ctx, text, maxWidth, size, weight, family) {
  let s = size;

  do {
    ctx.font = `${weight} ${s}px ${family}`;
    s -= 2;
  } while (ctx.measureText(text).width > maxWidth && s > 12);
}

const DISPLAY = '"Bricolage Grotesque", "Sora", "Inter", sans-serif';
const BODY = '"Inter", "Noto Sans Bengali", sans-serif';
const BANGLA = '"Noto Sans Bengali", "Inter", sans-serif';
const WORDMARK = '"Sora", "Inter", sans-serif';

/**
 * data: { examName, short, isSat, score, scaleMin, scaleMax, sections: [{name, correct, total}], pathId }
 * Returns a canvas.
 */
export async function drawShareCard(data) {
  try {
    await Promise.all([
      document.fonts?.load(`800 200px ${DISPLAY}`),
      document.fonts?.load(`700 60px ${WORDMARK}`),
      document.fonts?.load(`600 40px ${BODY}`),
      document.fonts?.load(`700 80px ${BANGLA}`, 'আমাকে'),
    ]);
  } catch {
    // Fonts failed to load: the system fallback still reads fine.
  }

  const mark = await loadMark();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background: the brand's deep navy with blue and violet glows.
  ctx.fillStyle = '#070a1c';
  ctx.fillRect(0, 0, W, H);
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(7,10,28,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(140, 120, 900, 'rgba(59,130,246,0.38)');
  glow(1000, 1820, 1000, 'rgba(139,92,246,0.42)');

  // Logo row.
  if (mark) ctx.drawImage(mark, 90, 112, 112, 112 * (mark.height / mark.width));
  ctx.fillStyle = '#f8fafc';
  ctx.font = `700 64px ${WORDMARK}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Mnemoq', mark ? 228 : 90, 166);

  // Kicker.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#a5b4fc';
  ctx.font = `600 38px ${BODY}`;
  ctx.letterSpacing = '6px';
  ctx.fillText((data.isSat ? 'MY DIGITAL SAT ESTIMATE' : `MY ${data.short.toUpperCase()} READINESS`).slice(0, 34), 90, 400);
  ctx.letterSpacing = '0px';

  // The score, big, with a blue-to-violet fill.
  const scoreText = data.score === null || data.score === undefined ? '–' : String(data.score);
  const grad = ctx.createLinearGradient(90, 0, 990, 0);
  grad.addColorStop(0, '#60a5fa');
  grad.addColorStop(1, '#c4b5fd');
  ctx.fillStyle = grad;
  fitText(ctx, scoreText, data.isSat ? 760 : 520, data.isSat ? 330 : 400, 800, DISPLAY);
  ctx.fillText(scoreText, 82, data.isSat ? 720 : 760);
  const scoreWidth = ctx.measureText(scoreText).width;

  ctx.fillStyle = 'rgba(248,250,252,0.55)';
  ctx.font = `600 64px ${DISPLAY}`;
  ctx.fillText(data.isSat ? '/1600' : '/100', 82 + scoreWidth + 18, data.isSat ? 720 : 760);

  // Scale bar under the score.
  const barY = data.isSat ? 790 : 830;
  const pct = data.score === null || data.score === undefined ? 0 : Math.max(0, Math.min(1, (data.score - data.scaleMin) / (data.scaleMax - data.scaleMin)));
  ctx.fillStyle = 'rgba(248,250,252,0.12)';
  roundRect(ctx, 90, barY, 900, 22, 11);
  ctx.fill();
  const barGrad = ctx.createLinearGradient(90, 0, 990, 0);
  barGrad.addColorStop(0, '#3b82f6');
  barGrad.addColorStop(1, '#8b5cf6');
  ctx.fillStyle = barGrad;
  roundRect(ctx, 90, barY, Math.max(22, 900 * pct), 22, 11);
  ctx.fill();

  // Sections.
  const sections = (data.sections || []).slice(0, 4);
  let y = barY + 150;
  for (const s of sections) {
    const p = s.total ? s.correct / s.total : 0;
    ctx.fillStyle = '#e2e8f0';
    fitText(ctx, s.name, 640, 40, 600, BODY);
    ctx.fillText(s.name, 90, y);
    ctx.fillStyle = '#f8fafc';
    ctx.font = `700 40px ${BODY}`;
    const right = `${s.correct}/${s.total}`;
    ctx.fillText(right, 990 - ctx.measureText(right).width, y);
    ctx.fillStyle = 'rgba(248,250,252,0.12)';
    roundRect(ctx, 90, y + 26, 900, 14, 7);
    ctx.fill();
    ctx.fillStyle = p >= 0.7 ? '#34d399' : p >= 0.45 ? '#fbbf24' : '#fb7185';
    roundRect(ctx, 90, y + 26, Math.max(14, 900 * p), 14, 7);
    ctx.fill();
    y += 130;
  }

  // The challenge.
  const challengeY = Math.max(y + 90, 1440);
  ctx.fillStyle = '#f8fafc';
  ctx.font = `700 92px ${BANGLA}`;
  // A low score is still worth posting as a starting line, not a boast.
  const strong = pct >= 0.5;
  ctx.fillText(strong ? 'আমাকে হারাতে পারবে?' : 'এখান থেকে শুরু।', 90, challengeY);
  ctx.fillStyle = 'rgba(248,250,252,0.7)';
  ctx.font = `500 40px ${BODY}`;
  ctx.fillText(
    strong ? `Take the same free ${data.isSat ? '25' : '20'}-minute check.` : 'Watch me climb. Where do you start?',
    90,
    challengeY + 74,
  );

  // Link pill.
  const link = printedLink(data.pathId);
  ctx.font = `600 40px ${BODY}`;
  const pillW = Math.min(900, ctx.measureText(link).width + 96);
  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, 90, 1690, pillW, 100, 50);
  ctx.fill();
  ctx.fillStyle = '#1e1b4b';
  ctx.textBaseline = 'middle';
  ctx.fillText(link, 138, 1741);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(248,250,252,0.45)';
  ctx.font = `500 26px ${BODY}`;
  ctx.fillText(data.isSat ? 'Estimate from a Mnemoq practice diagnostic, not an official score.' : 'Estimate from a Mnemoq practice check, not an official result.', 90, 1856);

  return canvas;
}

export const canvasToBlob = (canvas) => new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
