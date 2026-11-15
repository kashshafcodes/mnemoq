// Builds the practice library (library/) from openly licensed question sets.
//
//   node scripts/build-library.mjs <raw-data-folder> <wordnet-dict-folder>
//
// Sources (all allow commercial use; credits in library/SOURCES.md):
//   MMLU      MIT          school maths, physics, chemistry, biology, CS, economics...
//   AQuA-RAT  Apache-2.0   algebra and quantitative word problems with worked solutions
//   GSM8K     MIT          maths word problems with step-by-step solutions
//   WordNet   WordNet licence (permissive; notice kept in library/WORDNET_LICENSE.txt)
//
// Output: library/catalog.json (what exists) and library/sets/<collection>/<n>.json
// (20 questions each). Set 1 of every collection is free; the server
// (api/library.js) only sends the others to Pro accounts.

import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [rawDir, wordnetDir] = process.argv.slice(2).map((p) => resolve(p));
const OUT = resolve('library');
const SET_SIZE = 20;

const read = (name) => (existsSync(join(rawDir, `${name}.json`)) ? JSON.parse(readFileSync(join(rawDir, `${name}.json`), 'utf8')) : []);

// Deterministic shuffle, so rebuilding gives the same sets.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function shuffle(list, seed) {
  const rand = seeded(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const clean = (text) =>
  String(text ?? '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const valid = (q) =>
  q.question.length >= 8 &&
  q.question.length <= 900 &&
  q.options.length >= 4 &&
  q.options.every((o) => o.length > 0 && o.length <= 220) &&
  new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length &&
  Number.isInteger(q.answer) &&
  q.answer >= 0 &&
  q.answer < q.options.length;

// ---- MMLU ------------------------------------------------------------------

function mmlu(configs, topicOf) {
  const out = [];

  for (const config of configs) {
    for (const split of ['test', 'validation', 'dev']) {
      for (const row of read(`mmlu-${config}-${split}`)) {
        // Questions that need a picture or table we do not have are left out.
        if (/\b(figure|diagram|graph shown|shown below|shown above|table below|image)\b/i.test(row.question)) continue;

        out.push({
          question: clean(row.question),
          options: (row.choices || []).map(clean),
          answer: Number(row.answer),
          topic: topicOf(config),
          explain: '',
        });
      }
    }
  }

  return out;
}

const pretty = (config) => config.replace(/^(high_school|college)_/, '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

// ---- AQuA-RAT --------------------------------------------------------------

function aqua() {
  const out = [];

  for (const row of [...read('aqua-train'), ...read('aqua-test')]) {
    const options = (row.options || []).map((o) => clean(String(o).replace(/^[A-E]\s*\)\s*/, '')));
    const answer = 'ABCDE'.indexOf(String(row.correct || '').trim());
    // Drop the trailing "Answer: E" / lone letter the dataset adds after each solution.
    const rationale = clean(row.rationale)
      .replace(/\n\s*(?:the\s+)?(?:correct\s+)?(?:answer|ans|option)?\s*(?:is|:)?\s*(?:option\s*)?\(?[A-E]\)?\s*\.?\s*$/i, '')
      .trim();

    if (rationale.length < 20 || rationale.length > 900 || options.length !== 5) continue;

    out.push({ question: clean(row.question), options, answer, topic: 'Quantitative reasoning', explain: rationale });
  }

  return out;
}

// ---- GSM8K: numeric answers turned into four choices -----------------------

function gsm() {
  const out = [];

  for (const [i, row] of [...read('gsm8k-test'), ...read('gsm8k-train')].entries()) {
    const parts = String(row.answer || '').split('####');
    const answer = Number(String(parts[1] || '').replace(/,/g, '').trim());

    if (!Number.isFinite(answer) || parts.length !== 2) continue;

    const steps = clean(parts[0].replace(/<<[^>]*>>/g, ''));
    const numbers = [...steps.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0])).filter((n) => Number.isFinite(n) && n !== answer && n > 0);
    const rand = seeded(i + 7);
    const candidates = [
      ...numbers.slice(-3),
      Math.round(answer * 1.5),
      answer + (answer >= 10 ? 10 : 2),
      Math.max(1, answer - (answer >= 10 ? 10 : 1)),
      answer * 2,
      Math.round(answer / 2),
    ];
    const wrong = [...new Set(candidates.filter((n) => n !== answer && n > 0 && Number.isFinite(n)))];
    const picked = shuffle(wrong, Math.floor(rand() * 1e6)).slice(0, 3);

    if (picked.length < 3) continue;

    const order = shuffle([answer, ...picked], i + 13);
    const fmt = (n) => (Number.isInteger(n) ? n.toLocaleString('en-US') : String(Math.round(n * 100) / 100));

    out.push({
      question: clean(row.question),
      options: order.map(fmt),
      answer: order.indexOf(answer),
      topic: 'Word problems',
      explain: steps,
    });
  }

  return out;
}

// ---- Vocabulary from WordNet -----------------------------------------------

// Words students meet in SAT, IELTS, admission tests and serious reading.
const WORDS = `abate aberrant abhor abstain abundant accolade acquiesce acrimony acumen adamant adept admonish adversity advocate aesthetic affable aggregate alacrity alleviate aloof altruism ambiguous ambivalent ameliorate amiable anachronism analogous anomaly antagonize antipathy apathy appease arbitrary arcane ardent arduous articulate ascertain assiduous astute atrophy audacious austere authoritarian autonomy avarice benevolent benign bolster bombastic brevity buttress cacophony callous candid capricious castigate catalyst caustic censure chronic circumspect coalesce cogent coherent collaborate commensurate compelling complacent comprehensive concede concise condone conducive confound congenial conjecture conscientious consensus contemplate contentious contrite conventional convoluted copious corroborate credible culpable cursory curtail daunting dearth debacle debilitate decorum deference deleterious delineate demure denounce deplete deride despondent deter detrimental devious didactic diffident diligent discern discord disdain disparage disparate disseminate divergent dogmatic dormant dubious duplicity eclectic efficacious elated elicit eloquent elusive embellish emulate endorse enervate enhance enigma ephemeral equanimity equivocal eradicate erratic erroneous erudite esoteric euphemism evanescent exacerbate exasperate exemplary exhaustive exonerate expedient explicit exploit extol extraneous facetious facilitate fallacy fastidious feasible fervent fickle flagrant flourish fluctuate foster frivolous frugal futile garrulous gratuitous gregarious gullible hackneyed hamper haughty hedonist heresy hinder hypocrisy hypothesis iconoclast idiosyncrasy ignominious illicit immutable impartial impeccable impede imperative impetuous implausible implicit impudent inadvertent incessant incisive incoherent incongruous incorrigible indifferent indigenous indolent indulgent inept inevitable infamous inherent innate innocuous innovative insipid insolent instigate integrity intrepid intricate intrinsic inundate invincible irascible jeopardize jovial judicious laconic lament languid laudable lavish lethargic lucid magnanimous malevolent malleable mandatory meticulous mitigate mollify morose mundane munificent myriad naive negligent nonchalant notorious novice nuance obdurate obscure obsolete obstinate ominous onerous opaque opulent ostentatious ostracize paradigm paradox paragon partisan paucity pedantic penchant perfunctory pernicious perseverance pervasive pessimist philanthropy placate plausible plethora poignant pragmatic precarious precocious predicament prevalent pristine proclivity prodigal prodigious proficient profound prolific propensity prosaic prudent pugnacious quandary querulous quintessential rancor rebuke recalcitrant reciprocate reclusive reconcile redundant refute relegate relinquish remorse renounce replete reprehensible repudiate resilient resolute reticent reverence rhetoric robust sagacious salient sanction scrupulous scrutinize sedentary serene skeptical solicitous sporadic spurious squander stagnant staunch stoic stringent subjugate substantiate subtle succinct superfluous surreptitious sycophant tacit tangible temperate tenacious tentative terse thwart torpid tranquil transient trepidation trivial ubiquitous unprecedented unscrupulous urbane vacillate validate venerate verbose viable vigilant vindicate virtuoso volatile voracious wary whimsical zealous`.split(/\s+/);

function wordnet() {
  if (!wordnetDir || !existsSync(join(wordnetDir, 'index.adj'))) return [];

  const pos = { adj: 'adjective', noun: 'noun', verb: 'verb', adv: 'adverb' };
  const index = {};
  const data = {};

  for (const p of Object.keys(pos)) {
    index[p] = new Map();
    for (const line of readFileSync(join(wordnetDir, `index.${p}`), 'utf8').split('\n')) {
      if (!line || line.startsWith(' ')) continue;
      const f = line.trim().split(' ');
      const pCnt = Number(f[3]);
      const offsets = f.slice(4 + pCnt + 2);
      index[p].set(f[0], offsets);
    }
    data[p] = readFileSync(join(wordnetDir, `data.${p}`), 'latin1');
  }

  const glossAt = (p, offset) => {
    const start = Number(offset);
    const line = data[p].slice(start, data[p].indexOf('\n', start));
    const gloss = line.split('|')[1] || '';

    return clean(gloss.split(/;\s*"/)[0]).replace(/;\s*$/, '');
  };

  const entries = [];

  for (const word of WORDS) {
    for (const p of ['adj', 'verb', 'noun', 'adv']) {
      const offsets = index[p].get(word);

      if (!offsets) continue;

      const def = glossAt(p, offsets[0]);

      if (def && !new RegExp(`\\b${word.slice(0, Math.max(4, word.length - 3))}`, 'i').test(def)) {
        entries.push({ word, pos: p, def });
        break;
      }
    }
  }

  return entries.map((e, i) => {
    const same = shuffle(
      entries.filter((o) => o.pos === e.pos && o.word !== e.word),
      i + 101
    ).slice(0, 3);
    const order = shuffle([e.def, ...same.map((s) => s.def)], i + 202);

    return {
      question: `What does "${e.word}" (${pos[e.pos]}) mean?`,
      options: order,
      answer: order.indexOf(e.def),
      topic: 'Vocabulary',
      explain: `${e.word}: ${e.def}.`,
      card: { question: `What does "${e.word}" mean?`, answer: e.def },
    };
  });
}

// ---- collections -----------------------------------------------------------

const MMLU = { name: 'MMLU (Hendrycks et al.)', url: 'https://huggingface.co/datasets/cais/mmlu', license: 'MIT' };

const COLLECTIONS = [
  { id: 'vocab', title: 'Vocabulary builder', group: 'English', blurb: 'Words that turn up in SAT, IELTS and admission tests. Learn the meaning, then keep it with review cards.', source: { name: 'Princeton WordNet', url: 'https://wordnet.princeton.edu/', license: 'WordNet licence' }, make: wordnet },
  { id: 'word-problems', title: 'Maths word problems', group: 'Maths', blurb: 'Everyday problems solved step by step: money, time, rates, percentages.', source: { name: 'GSM8K (OpenAI)', url: 'https://huggingface.co/datasets/openai/gsm8k', license: 'MIT' }, make: gsm },
  { id: 'quant', title: 'Quantitative reasoning', group: 'Maths', blurb: 'Algebra, ratios, speed, profit and probability, with a worked solution for each. Great for NSU, BRAC and IBA-style tests.', source: { name: 'AQuA-RAT (DeepMind)', url: 'https://huggingface.co/datasets/deepmind/aqua_rat', license: 'Apache-2.0' }, make: aqua },
  { id: 'school-maths', title: 'School mathematics', group: 'Maths', blurb: 'Arithmetic, algebra, geometry and statistics at SSC/HSC level.', source: MMLU, make: () => mmlu(['elementary_mathematics', 'high_school_mathematics', 'high_school_statistics'], pretty) },
  { id: 'higher-maths', title: 'Higher mathematics', group: 'Maths', blurb: 'University-entry calculus, linear algebra and harder problem solving.', source: MMLU, make: () => mmlu(['college_mathematics'], () => 'Higher mathematics') },
  { id: 'physics', title: 'Physics', group: 'Science', blurb: 'Mechanics, electricity, waves, heat and modern physics, from concepts to calculation.', source: MMLU, make: () => mmlu(['conceptual_physics', 'high_school_physics', 'college_physics', 'astronomy'], pretty) },
  { id: 'chemistry', title: 'Chemistry', group: 'Science', blurb: 'Atoms, bonding, reactions, equilibrium, acids and organic chemistry.', source: MMLU, make: () => mmlu(['high_school_chemistry', 'college_chemistry'], pretty) },
  { id: 'biology', title: 'Biology', group: 'Science', blurb: 'Cells, genetics, physiology, anatomy and nutrition. Useful for medical admission.', source: MMLU, make: () => mmlu(['high_school_biology', 'college_biology', 'anatomy', 'nutrition'], pretty) },
  { id: 'computer-science', title: 'Computer science', group: 'More subjects', blurb: 'Programming logic, algorithms and how computers work.', source: MMLU, make: () => mmlu(['high_school_computer_science'], () => 'Computer science') },
  { id: 'economics', title: 'Economics', group: 'More subjects', blurb: 'Demand and supply, markets, money and the wider economy. Handy for BBA and economics.', source: MMLU, make: () => mmlu(['high_school_microeconomics', 'high_school_macroeconomics'], pretty) },
  { id: 'geography', title: 'Geography', group: 'More subjects', blurb: 'People, places, climate and the world map.', source: MMLU, make: () => mmlu(['high_school_geography'], () => 'Geography') },
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'sets'), { recursive: true });

const catalog = [];
let total = 0;

for (const [ci, c] of COLLECTIONS.entries()) {
  const all = c.make().filter(valid);
  const seen = new Set();
  const unique = all.filter((q) => {
    const key = q.question.toLowerCase().slice(0, 160);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const questions = shuffle(unique, 1000 + ci).map((q, i) => ({ id: `${c.id}-${i + 1}`, ...q }));
  const sets = Math.floor(questions.length / SET_SIZE);

  if (sets === 0) {
    console.warn(`skipped ${c.id}: no questions`);
    continue;
  }

  mkdirSync(join(OUT, 'sets', c.id), { recursive: true });

  for (let n = 1; n <= sets; n += 1) {
    writeFileSync(join(OUT, 'sets', c.id, `${n}.json`), JSON.stringify(questions.slice((n - 1) * SET_SIZE, n * SET_SIZE)));
  }

  const topics = [...new Set(questions.map((q) => q.topic))];

  catalog.push({ id: c.id, title: c.title, group: c.group, blurb: c.blurb, source: c.source, sets, questions: sets * SET_SIZE, topics: topics.slice(0, 8), worked: questions.some((q) => q.explain) });
  total += sets * SET_SIZE;
  console.log(c.id.padEnd(18), String(sets * SET_SIZE).padStart(5), 'questions in', sets, 'sets');
}

writeFileSync(join(OUT, 'catalog.json'), JSON.stringify({ setSize: SET_SIZE, total, collections: catalog }, null, 1));

if (wordnetDir && existsSync(join(wordnetDir, '..', 'LICENSE'))) copyFileSync(join(wordnetDir, '..', 'LICENSE'), join(OUT, 'WORDNET_LICENSE.txt'));

writeFileSync(
  join(OUT, 'SOURCES.md'),
  `# Practice library sources\n\nBuilt by scripts/build-library.mjs. Questions are reused under their licences; Mnemoq adds the sets, choices for numeric answers, and review cards.\n\n${catalog
    .map((c) => `- **${c.title}**: ${c.source.name}, ${c.source.license}, ${c.source.url}`)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join('\n')}\n\nMMLU: Hendrycks et al., "Measuring Massive Multitask Language Understanding" (ICLR 2021), MIT licence.\nAQuA-RAT: Ling et al., "Program Induction by Rationale Generation" (ACL 2017), Apache License 2.0.\nGSM8K: Cobbe et al., "Training Verifiers to Solve Math Word Problems" (2021), MIT licence.\nWordNet 3.0 Copyright 2006 by Princeton University. All rights reserved. See WORDNET_LICENSE.txt.\n`
);

console.log('total', total);
