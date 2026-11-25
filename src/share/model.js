// One share-card template, three variants (spec phase2-share-card §2): what
// each card says, in which language, and where its link goes. Pure, so the
// variants are unit tested; drawCard.js only paints this.
//
//   cardModel(variant, lang, data, userId) -> {
//     kicker, hero, rows, line, fine, printed, link, message, alt, fileName, subject }
//
// data by variant:
//   daily  { number, marks: [{ correct, bet }], score, max, rank }
//   diag   { pathId, short, isSat, score, scaleMin, scaleMax, sections: [{ name, correct, total }], kind }
//   recap  weeklyRecap() (src/share/recap.js)
// Never on a card: a name, email, user id or card text.

import { makeT } from '../daily/strings';
import { shareText } from '../daily/puzzle';
import { printedLink, shareLink } from '../shareCard';
import { num, shareT } from './strings';

const DAY = 86400000;
const LOCALE = { en: 'en-GB', bn: 'bn-BD' };

function fmtDay(key, lang, opts) {
  try {
    return new Date(`${key}T00:00:00Z`).toLocaleDateString(LOCALE[lang] || 'en-GB', { timeZone: 'UTC', ...opts });
  } catch {
    return key;
  }
}

export function recapRange(from, to, lang) {
  return `${fmtDay(from, lang, { day: 'numeric', month: 'short' })} – ${fmtDay(to, lang, { day: 'numeric', month: 'short' })}`;
}

// The recap's "card subject" for the share reward: one Dhaka week.
export const recapWeek = (to) => `w${Math.floor(Date.parse(`${to}T00:00:00Z`) / DAY / 7)}`;

function daily(lang, d, t, link) {
  const dt = makeT(lang);

  return {
    kicker: t('card.daily.kicker', { num: d.number }),
    hero: { kind: 'lanterns', score: num(lang, d.score), max: num(lang, d.max ?? 15), marks: d.marks || [] },
    rows: [{ kind: 'rank', name: dt(`rank_${d.rank}`), line: dt(`rankLine_${d.rank}`) }],
    line: t('card.daily.line'),
    fine: '',
    message: shareText({ number: d.number, marks: d.marks || [], lang, url: link }),
    alt: `${d.score}/${d.max ?? 15}`,
    fileName: `mnemoq-daily-${d.number}.png`,
    subject: String(d.number),
  };
}

function diag(lang, d, t, link) {
  const score = d.score === null || d.score === undefined ? null : d.score;
  const pct = score === null ? 0 : Math.max(0, Math.min(1, (score - d.scaleMin) / (d.scaleMax - d.scaleMin)));
  const short = d.short || '';

  return {
    kicker: d.isSat ? t('card.diag.kicker.sat') : t('card.diag.kicker.other', { short: lang === 'bn' ? short : short.toUpperCase() }),
    hero: { kind: 'score', score: score === null ? '–' : num(lang, score), scale: num(lang, d.isSat ? '/1600' : '/100'), pct },
    rows: (d.sections || []).slice(0, 4).map((s) => ({
      kind: 'bar',
      name: s.name,
      value: num(lang, `${s.correct}/${s.total}`),
      pct: s.total ? s.correct / s.total : 0,
    })),
    line: pct >= 0.5 ? t('card.diag.strong') : t('card.diag.start'),
    fine: d.isSat ? t('card.diag.fine.sat') : t('card.diag.fine.other'),
    message: d.isSat ? t('share.diag.sat', { score, link }) : t('share.diag.other', { short, score, link }),
    alt: `${score ?? '–'} ${d.isSat ? '/1600' : '/100'}`,
    fileName: `mnemoq-${d.pathId || 'result'}.png`,
    subject: `${d.pathId}:${d.kind || 'diagnostic'}`,
  };
}

function recap(lang, d, t, link) {
  const rows = [
    d.showRate
      ? { kind: 'stat', name: t('card.recap.recalled'), value: t('card.recap.of', { n: d.recalled, total: d.reviewed }) }
      : { kind: 'stat', name: t('card.recap.reviewed'), value: num(lang, d.reviewed) },
    { kind: 'stat', name: t('card.recap.kept'), value: num(lang, d.kept) },
    { kind: 'stat', name: t('card.recap.glow'), value: `+${num(lang, d.glow)}` },
  ];

  if (d.bestDay) rows.push({ kind: 'note', name: t('card.recap.best', { day: fmtDay(d.bestDay, lang, { weekday: 'long' }) }) });

  return {
    kicker: t('card.recap.kicker', { range: recapRange(d.from, d.to, lang) }),
    hero: { kind: 'week', score: num(lang, d.daysLit), label: t('card.recap.daysLit'), dots: d.dots },
    rows,
    line: t('card.recap.line'),
    fine: '',
    message: t('share.recap', { n: d.daysLit, link }),
    alt: `${num(lang, d.daysLit)} ${t('card.recap.daysLit')}`,
    fileName: `mnemoq-week-${d.to}.png`,
    subject: recapWeek(d.to),
  };
}

const BUILD = { daily, diag, recap };

export function cardModel(variant, lang, data, userId) {
  const t = shareT(lang);
  const pathId = variant === 'diag' ? data.pathId : null;
  const link = shareLink(variant, pathId, userId);
  const model = BUILD[variant](lang, data, t, link);

  return { variant, lang, ...model, link, printed: printedLink(variant, pathId), alt: t('share.alt', { summary: model.alt }) };
}
