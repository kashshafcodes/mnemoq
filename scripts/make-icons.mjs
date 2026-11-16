// Renders the app icons (phone home screen, browser tab) from the original
// Mnemoq mark in public/mnemoq-logo.png, using headless Chrome.
//
//   node scripts/make-icons.mjs
//
// Writes public/icon-192.png, icon-512.png, icon-maskable-512.png and
// apple-touch-icon.png (180). Needs Google Chrome installed.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));

if (!CHROME) throw new Error('Chrome or Edge is needed to render the icons.');

const PUBLIC = resolve('public');
const work = mkdtempSync(join(tmpdir(), 'mnemoq-icons-'));

copyFileSync(join(PUBLIC, 'mnemoq-logo.png'), join(work, 'logo.png'));

// Where the ribbon mark sits inside mnemoq-logo.png (2079 x 756).
const LOGO = { w: 2079, h: 756, markX: 108, markY: 205, markW: 624, markH: 405 };

function page(size, markShare) {
  const markW = size * markShare;
  const scale = markW / LOGO.markW;
  const markH = LOGO.markH * scale;

  // A window exactly the size of the mark, centred; the image moves inside it,
  // so nothing outside the mark (the wordmark) can show.
  return `<!doctype html><html><head><style>
    html, body { margin: 0; background: transparent; }
    .icon { width: ${size}px; height: ${size}px; position: relative; overflow: hidden;
      background: radial-gradient(circle at 30% 20%, #2a2850 0%, #16161f 55%, #0f0f14 100%); }
    .mark { position: absolute; left: ${(size - markW) / 2}px; top: ${(size - markH) / 2}px; width: ${markW}px; height: ${markH}px; overflow: hidden; }
    .mark img { position: absolute; left: ${-LOGO.markX * scale}px; top: ${-LOGO.markY * scale}px; width: ${LOGO.w * scale}px; height: ${LOGO.h * scale}px; }
  </style></head><body><div class="icon"><div class="mark"><img src="logo.png"></div></div></body></html>`;
}

const jobs = [
  ['icon-192.png', 192, 0.72],
  ['icon-512.png', 512, 0.72],
  ['apple-touch-icon.png', 180, 0.7],
  // Android may crop to a circle: keep the mark inside the middle 80%.
  ['icon-maskable-512.png', 512, 0.56],
];

for (const [name, size, share] of jobs) {
  const html = join(work, `${name}.html`);

  writeFileSync(html, page(size, share));
  execFileSync(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--window-size=${size},${size}`,
    `--screenshot=${join(PUBLIC, name)}`,
    `file:///${html.replace(/\\/g, '/')}`,
  ], { stdio: 'ignore' });
  console.log('wrote', name);
}
