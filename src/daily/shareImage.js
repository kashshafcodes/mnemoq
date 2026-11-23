// Draws the shareable result card (1080 × 1350, Instagram portrait) on a
// canvas: the night sky, five lanterns lit or dim, the score and rank.

const W = 1080;
const H = 1350;

function lantern(g, x, y, r, mark) {
  const lit = mark.correct;
  const strength = lit ? (mark.bet === 'sure' ? 1 : 0.75) : mark.bet === 'guess' ? 0.12 : 0.3;
  const color = lit ? '255, 200, 70' : '232, 92, 110';

  const halo = g.createRadialGradient(x, y, 0, x, y, r * 2.6);
  halo.addColorStop(0, `rgba(${color}, ${0.55 * strength})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = halo;
  g.beginPath();
  g.arc(x, y, r * 2.6, 0, Math.PI * 2);
  g.fill();

  const body = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
  body.addColorStop(0, lit ? '#fffbe6' : 'rgba(255, 210, 220, 0.6)');
  body.addColorStop(0.5, lit ? '#ffd54a' : `rgba(${color}, 0.55)`);
  body.addColorStop(1, lit ? '#f08a00' : 'rgba(80, 30, 60, 0.9)');
  g.fillStyle = body;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();

  if (lit && mark.bet === 'sure') {
    g.strokeStyle = 'rgba(255, 240, 200, 0.9)';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(x, y, r + 12, 0, Math.PI * 2);
    g.stroke();
  }
}

// An inline <svg> (serialised) as an image the canvas can draw.
function svgImage(markup) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function drawShareCard({ number, marks, score, max, rankName, rankLine, title, url, fontFamily, mascotSvg }) {
  const canvas = document.createElement('canvas');

  canvas.width = W;
  canvas.height = H;

  const g = canvas.getContext('2d');

  if (document.fonts?.ready) await document.fonts.ready.catch(() => {});

  // Sky
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0b0a1f');
  sky.addColorStop(0.55, '#1a1640');
  sky.addColorStop(1, '#2a1f4d');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // Stars
  for (let i = 0; i < 70; i += 1) {
    const x = ((Math.sin(i * 12.99) * 43758.5) % 1 + 1) % 1;
    const y = ((Math.sin(i * 78.23) * 12345.6) % 1 + 1) % 1;
    g.fillStyle = `rgba(255,255,255,${0.2 + (i % 5) * 0.12})`;
    g.fillRect(x * W, y * H * 0.5, i % 7 === 0 ? 3 : 2, i % 7 === 0 ? 3 : 2);
  }

  // Moon
  const moon = g.createRadialGradient(860, 200, 10, 860, 200, 220);
  moon.addColorStop(0, 'rgba(255, 236, 180, 0.95)');
  moon.addColorStop(0.18, 'rgba(255, 220, 140, 0.55)');
  moon.addColorStop(1, 'rgba(255, 200, 100, 0)');
  g.fillStyle = moon;
  g.beginPath();
  g.arc(860, 200, 220, 0, Math.PI * 2);
  g.fill();

  // River
  g.fillStyle = '#120f2c';
  g.fillRect(0, H - 230, W, 230);

  const display = `"Bricolage Grotesque", ${fontFamily}`;

  g.textAlign = 'center';
  g.fillStyle = 'rgba(255, 231, 163, 0.9)';
  g.font = `600 40px ${display}`;
  g.fillText(`${title} · #${number}`, W / 2, 150);

  // Score
  g.fillStyle = '#fff7e0';
  g.font = `800 260px ${display}`;
  g.fillText(String(score), W / 2, 470);
  g.fillStyle = 'rgba(255, 247, 224, 0.6)';
  g.font = `500 46px ${display}`;
  g.fillText(`/ ${max}`, W / 2, 545);

  // Lanterns
  const gap = 180;
  const start = W / 2 - gap * 2;

  marks.forEach((m, i) => lantern(g, start + i * gap, 760, 54, m));

  // Rank
  g.fillStyle = '#ffd54a';
  g.font = `800 92px ${display}`;
  g.fillText(rankName, W / 2, 990);
  g.fillStyle = 'rgba(255, 247, 224, 0.75)';
  g.font = `500 40px ${fontFamily}`;
  g.fillText(rankLine, W / 2, 1060);

  // Jonaki, resting by the river
  if (mascotSvg) {
    const mascot = await svgImage(mascotSvg);

    if (mascot) {
      const glow = g.createRadialGradient(170, H - 170, 0, 170, H - 170, 170);
      glow.addColorStop(0, 'rgba(255, 200, 70, 0.35)');
      glow.addColorStop(1, 'rgba(255, 200, 70, 0)');
      g.fillStyle = glow;
      g.fillRect(0, H - 340, 340, 340);
      g.drawImage(mascot, 70, H - 290, 200, 200);
    }
  }

  // Footer
  g.fillStyle = 'rgba(255, 247, 224, 0.85)';
  g.font = `600 38px ${display}`;
  g.fillText(url.replace(/^https?:\/\//, ''), W / 2, H - 100);

  try {
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
  } catch {
    // Some browsers refuse to export a canvas with an SVG drawn on it: draw it again without Jonaki.
    return mascotSvg ? drawShareCard({ number, marks, score, max, rankName, rankLine, title, url, fontFamily, mascotSvg: null }) : null;
  }
}
