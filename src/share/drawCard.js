// Paints one share card (spec phase2-share-card §2) from cardModel(): a
// 1080x1920 story with everything a viewer must read inside the 4:5 safe zone
// (y 285 to 1635), so a feed crop loses nothing. One look for all variants:
// the Daily's night river, cream numerals, gold for lanterns and Glow, Jonaki
// glowing at the person's Glow level. Drawn on the device: nothing leaves the
// phone unless the person shares it.

const W = 1080;
const H = 1920;
const CX = W / 2;

const DISPLAY = '"Bricolage Grotesque", "Inter", "Noto Sans Bengali", sans-serif';
const BODY_EN = '"Inter", "Noto Sans Bengali", sans-serif';
const BODY_BN = '"Noto Sans Bengali", "Inter", sans-serif';
const WORDMARK = '"Sora", "Inter", sans-serif';

const CREAM = '#fff7e0';
const CREAM_2 = 'rgba(255, 247, 224, 0.72)';
const GOLD = '#ffd54a';

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

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Shrinks the font until the text fits the width.
function fit(g, text, maxWidth, size, weight, family) {
  let s = size;

  do {
    g.font = `${weight} ${s}px ${family}`;
    s -= 2;
  } while (g.measureText(text).width > maxWidth && s > 14);
}

// Splits text into at most `max` lines that fit the width.
function wrap(g, text, maxWidth, max = 3) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;

    if (g.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);

  return lines.slice(0, max);
}

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
  body.addColorStop(0.5, lit ? GOLD : `rgba(${color}, 0.55)`);
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

// Jonaki the firefly, painted (no SVG, so the canvas always exports).
// glow 0.3..1 from jonakiGlow(G).
function jonaki(g, cx, cy, size, glow) {
  const s = size / 200;
  const halo = g.createRadialGradient(cx, cy + 30 * s, 0, cx, cy + 30 * s, 170 * s);

  halo.addColorStop(0, `rgba(255, 200, 70, ${0.55 * glow})`);
  halo.addColorStop(1, 'rgba(255, 200, 70, 0)');
  g.fillStyle = halo;
  g.fillRect(cx - 180 * s, cy - 150 * s, 360 * s, 360 * s);

  // Wings
  g.fillStyle = 'rgba(200, 220, 255, 0.35)';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + side * 42 * s, cy - 34 * s, 46 * s, 26 * s, side * -0.6, 0, Math.PI * 2);
    g.fill();
  }

  // Lantern tail
  const tail = g.createRadialGradient(cx, cy + 50 * s, 2, cx, cy + 50 * s, 42 * s);

  tail.addColorStop(0, '#fffbe6');
  tail.addColorStop(0.5, GOLD);
  tail.addColorStop(1, '#f08a00');
  g.fillStyle = tail;
  g.beginPath();
  g.ellipse(cx, cy + 50 * s, 38 * s, 42 * s, 0, 0, Math.PI * 2);
  g.fill();

  // Body and head
  g.fillStyle = '#3a2f6b';
  g.beginPath();
  g.ellipse(cx, cy, 34 * s, 30 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(cx, cy - 36 * s, 30 * s, 0, Math.PI * 2);
  g.fill();

  // Eyes and smile
  g.fillStyle = CREAM;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.arc(cx + side * 11 * s, cy - 40 * s, 6 * s, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = CREAM;
  g.lineWidth = 3 * s;
  g.beginPath();
  g.arc(cx, cy - 30 * s, 9 * s, 0.2 * Math.PI, 0.8 * Math.PI);
  g.stroke();

  // Antennae
  g.strokeStyle = '#3a2f6b';
  g.lineWidth = 4 * s;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + side * 10 * s, cy - 62 * s);
    g.quadraticCurveTo(cx + side * 22 * s, cy - 92 * s, cx + side * 34 * s, cy - 96 * s);
    g.stroke();
  }
}

function sky(g) {
  const grad = g.createLinearGradient(0, 0, 0, H);

  grad.addColorStop(0, '#0b0a1f');
  grad.addColorStop(0.55, '#1a1640');
  grad.addColorStop(1, '#2a1f4d');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  for (let i = 0; i < 90; i += 1) {
    const x = (((Math.sin(i * 12.99) * 43758.5) % 1) + 1) % 1;
    const y = (((Math.sin(i * 78.23) * 12345.6) % 1) + 1) % 1;

    g.fillStyle = `rgba(255,255,255,${0.2 + (i % 5) * 0.12})`;
    g.fillRect(x * W, y * H * 0.62, i % 7 === 0 ? 3 : 2, i % 7 === 0 ? 3 : 2);
  }

  const moon = g.createRadialGradient(880, 170, 10, 880, 170, 220);

  moon.addColorStop(0, 'rgba(255, 236, 180, 0.9)');
  moon.addColorStop(0.18, 'rgba(255, 220, 140, 0.5)');
  moon.addColorStop(1, 'rgba(255, 200, 100, 0)');
  g.fillStyle = moon;
  g.beginPath();
  g.arc(880, 170, 220, 0, Math.PI * 2);
  g.fill();

  // The river, below the safe zone.
  g.fillStyle = '#120f2c';
  g.fillRect(0, 1680, W, H - 1680);
  g.fillStyle = 'rgba(255, 213, 74, 0.10)';
  for (let i = 0; i < 6; i += 1) g.fillRect(140 + i * 150, 1720 + (i % 3) * 40, 90, 4);
}

function heroLanterns(g, hero) {
  g.textAlign = 'center';
  g.fillStyle = CREAM;
  g.font = `800 240px ${DISPLAY}`;
  g.fillText(hero.score, CX, 590);
  g.fillStyle = CREAM_2;
  g.font = `500 48px ${DISPLAY}`;
  g.fillText(`/ ${hero.max}`, CX, 660);

  const gap = 170;
  const start = CX - gap * 2;

  hero.marks.slice(0, 5).forEach((m, i) => lantern(g, start + i * gap, 740, 46, m));
}

function heroScore(g, hero) {
  g.textAlign = 'left';
  g.fillStyle = CREAM;
  fit(g, hero.score, 640, 280, 800, DISPLAY);
  const w = g.measureText(hero.score).width;
  const x = CX - (w + 20 + 200) / 2;

  g.fillText(hero.score, x, 640);
  g.fillStyle = CREAM_2;
  g.font = `600 64px ${DISPLAY}`;
  g.fillText(hero.scale, x + w + 20, 640);

  g.fillStyle = 'rgba(255, 247, 224, 0.14)';
  roundRect(g, 120, 710, 840, 22, 11);
  g.fill();
  g.fillStyle = GOLD;
  roundRect(g, 120, 710, Math.max(22, 840 * hero.pct), 22, 11);
  g.fill();
}

function heroWeek(g, hero, body) {
  g.textAlign = 'center';
  g.fillStyle = CREAM;
  g.font = `800 240px ${DISPLAY}`;
  g.fillText(hero.score, CX, 590);
  g.fillStyle = GOLD;
  fit(g, hero.label, 840, 54, 700, body);
  g.fillText(hero.label, CX, 660);

  const gap = 120;
  const start = CX - gap * 3;

  hero.dots.forEach((state, i) => {
    const x = start + i * gap;
    const y = 745;

    if (state === 'lit') {
      lantern(g, x, y, 26, { correct: true, bet: 'safe' });
    } else if (state === 'rest') {
      // A small moon: a rest day kept the streak.
      g.fillStyle = 'rgba(255, 236, 180, 0.8)';
      g.beginPath();
      g.arc(x, y, 16, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1a1640';
      g.beginPath();
      g.arc(x + 7, y - 5, 14, 0, Math.PI * 2);
      g.fill();
    } else {
      g.strokeStyle = 'rgba(255, 247, 224, 0.4)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, y, 18, 0, Math.PI * 2);
      g.stroke();
    }
  });
}

function body(g, rows, family) {
  let y = 880;

  for (const row of rows) {
    if (row.kind === 'rank') {
      g.textAlign = 'center';
      g.fillStyle = GOLD;
      fit(g, row.name, 900, 96, 800, DISPLAY);
      g.fillText(row.name, CX, 920);
      g.fillStyle = CREAM_2;
      fit(g, row.line, 900, 44, 500, family);
      g.fillText(row.line, CX, 1000);
      return;
    }

    if (row.kind === 'bar') {
      g.textAlign = 'left';
      g.fillStyle = CREAM;
      fit(g, row.name, 640, 40, 600, family);
      g.fillText(row.name, 120, y);
      g.textAlign = 'right';
      g.font = `700 40px ${family}`;
      g.fillText(row.value, 960, y);
      g.fillStyle = 'rgba(255, 247, 224, 0.14)';
      roundRect(g, 120, y + 22, 840, 14, 7);
      g.fill();
      g.fillStyle = row.pct >= 0.7 ? '#34d399' : row.pct >= 0.45 ? '#fbbf24' : '#fb7185';
      roundRect(g, 120, y + 22, Math.max(14, 840 * row.pct), 14, 7);
      g.fill();
      y += 80;
    } else if (row.kind === 'stat') {
      g.textAlign = 'left';
      g.fillStyle = CREAM_2;
      fit(g, row.name, 560, 46, 500, family);
      g.fillText(row.name, 120, y);
      g.textAlign = 'right';
      g.fillStyle = row.value.startsWith('+') ? GOLD : CREAM;
      fit(g, row.value, 360, 56, 800, family);
      g.fillText(row.value, 960, y);
      g.fillStyle = 'rgba(255, 247, 224, 0.12)';
      g.fillRect(120, y + 28, 840, 2);
      y += 92;
    } else if (row.kind === 'note') {
      g.textAlign = 'center';
      g.fillStyle = CREAM_2;
      fit(g, row.name, 840, 38, 500, family);
      g.fillText(row.name, CX, y + 6);
      y += 70;
    }
  }
}

/**
 * model: cardModel() output. glow: 0.3..1 (Jonaki's brightness).
 * Returns a 1080x1920 canvas.
 */
export async function drawCard(model, { glow = 0.6 } = {}) {
  const family = model.lang === 'bn' ? BODY_BN : BODY_EN;

  try {
    await Promise.all([
      document.fonts?.load(`800 200px ${DISPLAY}`),
      document.fonts?.load(`700 60px ${WORDMARK}`),
      document.fonts?.load(`600 40px ${BODY_EN}`),
      document.fonts?.load(`700 60px ${BODY_BN}`, 'আমার সপ্তাহ'),
    ]);
  } catch {
    // Fonts failed to load: the system fallback still reads fine.
  }

  const mark = await loadMark();
  const canvas = document.createElement('canvas');

  canvas.width = W;
  canvas.height = H;

  const g = canvas.getContext('2d');

  sky(g);

  // Logo row (may be cropped in a feed).
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  if (mark) g.drawImage(mark, 90, 115, 104, 104 * (mark.height / mark.width));
  g.fillStyle = CREAM;
  g.font = `700 60px ${WORDMARK}`;
  g.fillText('Mnemoq', mark ? 214 : 90, 168);
  g.textBaseline = 'alphabetic';

  // Kicker
  g.textAlign = 'center';
  g.fillStyle = 'rgba(255, 231, 163, 0.9)';
  g.letterSpacing = model.lang === 'bn' ? '0px' : '5px';
  fit(g, model.kicker, 900, 38, 600, family);
  g.fillText(model.kicker, CX, 340);
  g.letterSpacing = '0px';

  if (model.hero.kind === 'lanterns') heroLanterns(g, model.hero);
  else if (model.hero.kind === 'score') heroScore(g, model.hero);
  else heroWeek(g, model.hero, family);

  body(g, model.rows, family);

  // Jonaki and the challenge line.
  jonaki(g, 230, 1320, 200, glow);
  g.textAlign = 'left';
  g.fillStyle = CREAM;
  g.font = `700 50px ${model.lang === 'bn' ? BODY_BN : DISPLAY}`;
  const lines = wrap(g, model.line, 600, 3);
  const top = 1320 - ((lines.length - 1) * 66) / 2 + 16;

  lines.forEach((line, i) => g.fillText(line, 380, top + i * 66));

  // Link pill
  g.font = `600 40px ${BODY_EN}`;
  const pillW = Math.min(900, g.measureText(model.printed).width + 110);

  g.fillStyle = CREAM;
  roundRect(g, CX - pillW / 2, 1450, pillW, 100, 50);
  g.fill();
  g.fillStyle = '#1e1b4b';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(model.printed, CX, 1501);
  g.textBaseline = 'alphabetic';

  if (model.fine) {
    g.fillStyle = 'rgba(255, 247, 224, 0.5)';
    fit(g, model.fine, 920, 28, 500, family);
    g.fillText(model.fine, CX, 1606);
  }

  return canvas;
}
