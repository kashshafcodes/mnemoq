// Per-page link previews, written into copies of the built index.html at build
// time (vite.config.js, pageMetaFiles). Crawlers from Facebook, WhatsApp and
// Messenger don't run JavaScript, so the tags must be in the HTML itself.
// Copy rules: company/marketing/brand-voice.md.

const SITE = 'https://mnemoq-two.vercel.app';

export const DAILY_META = {
  title: 'Mnemoq Daily · Five lanterns, one night',
  ogTitle: 'Mnemoq Daily: five lanterns, one night · এক রাতে পাঁচটি লণ্ঠন',
  description: 'Same five questions for everyone tonight, in English and Bangla. Bet on how sure you are, then compare your lanterns with friends. Free, no sign-up.',
  image: `${SITE}/og-daily.png`,
  url: `${SITE}/daily`,
};

const escapeAttr = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Replace a tag's content="" (or add the tag before </head> if it's missing).
function setMeta(html, attr, key, value) {
  const pattern = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`);
  const safe = escapeAttr(value);

  if (pattern.test(html)) return html.replace(pattern, (_, start, end) => `${start}${safe}${end}`);

  return html.replace('</head>', `    <meta ${attr}="${key}" content="${safe}" />\n  </head>`);
}

export function pageWithMeta(html, meta) {
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(meta.title)}</title>`);

  out = setMeta(out, 'name', 'description', meta.description);
  out = setMeta(out, 'property', 'og:title', meta.ogTitle || meta.title);
  out = setMeta(out, 'property', 'og:description', meta.description);
  out = setMeta(out, 'property', 'og:image', meta.image);
  out = setMeta(out, 'property', 'og:url', meta.url);

  return out;
}
