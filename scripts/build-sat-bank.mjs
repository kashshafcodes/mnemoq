// Builds the SAT question bank from its sources in content/sat/ and checks it.
//
//   content/sat/rwReading.js, rwWriting.js   hand-written Reading and Writing
//   content/sat/math.js                       written by scripts/gen-sat-math.py
//
// It writes two files:
//   src/sat/bank/free.js   the free questions, shipped inside the app
//   api/_satBank.js        every question; only the server reads this file and
//                          it sends the Pro questions to Pro accounts only
//
// Keeping the Pro questions out of the app bundle is what makes the paywall
// real: they are not in the browser unless the server has checked the plan.
//
// Run: node scripts/build-sat-bank.mjs   (after python scripts/gen-sat-math.py)

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAT_MATH } from '../content/sat/math.js';
import { READING } from '../content/sat/rwReading.js';
import { WRITING } from '../content/sat/rwWriting.js';
import { DIAGNOSTIC_MIX, SECTIONS, SKILLS } from '../src/sat/blueprint.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Free questions per skill, by level [easier, medium, harder].
const FREE_PER_SKILL = { rw: [2, 2, 1], math: [2, 2, 1] };

// The same shuffle every build, so a question's options never move around.
function shuffleOptions(options, seed) {
  let state = (seed * 2654435761) % 4294967296;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  const order = options.map((_, i) => i);

  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return { options: order.map((i) => options[i]), answer: order.indexOf(0) };
}

function readingAndWriting() {
  const items = [];
  let seed = 1;

  for (const [skill, rows] of Object.entries({ ...READING, ...WRITING })) {
    rows.forEach(([level, passage, question, correct, wrong, explain, table], index) => {
      const mixed = shuffleOptions([correct, ...wrong], seed);

      seed += 1;
      items.push({
        id: `rw-${skill}-${index + 1}`,
        section: 'rw',
        domain: SKILLS[skill]?.domain,
        skill,
        level,
        type: 'mc',
        passage,
        ...(table ? { table } : {}),
        question,
        options: mixed.options,
        answer: mixed.answer,
        explain,
      });
    });
  }

  return items;
}

function check(bank) {
  const problems = [];
  const ids = new Set();

  for (const q of bank) {
    const fail = (why) => problems.push(`${q.id}: ${why}`);

    if (ids.has(q.id)) fail('duplicate id');
    ids.add(q.id);

    const skill = SKILLS[q.skill];

    if (!skill) fail(`unknown skill "${q.skill}"`);
    else if (skill.section !== q.section || skill.domain !== q.domain) fail('skill does not match its section or domain');
    if (![1, 2, 3].includes(q.level)) fail('level must be 1, 2 or 3');
    if (!q.question || !q.explain) fail('needs a question and an explanation');
    if (q.section === 'rw' && !q.passage) fail('Reading and Writing questions need a passage');
    if (q.passage && q.section === 'rw' && q.passage.split(/\s+/).length > 160) fail('passage is longer than 160 words');

    if (q.type === 'mc') {
      if (!Array.isArray(q.options) || q.options.length !== 4) fail('needs exactly four options');
      else if (new Set(q.options.map((o) => String(o).trim().toLowerCase())).size !== 4) fail('options must all differ');
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) fail('answer must be 0 to 3');
    } else if (q.type === 'spr') {
      if (!Array.isArray(q.values) || q.values.length === 0 || q.values.some((v) => !Number.isFinite(v))) fail('typed answers need numeric values');
      if (!Array.isArray(q.accept) || q.accept.length === 0) fail('typed answers need a shown answer');
    } else fail('type must be mc or spr');

    if (q.table && (!Array.isArray(q.table.head) || !q.table.rows?.every((row) => row.length === q.table.head.length))) fail('table rows must match the header');
  }

  return problems;
}

function pickFree(bank) {
  const taken = new Map();

  return bank.filter((q) => {
    const key = `${q.skill}|${q.level}`;
    const count = taken.get(key) || 0;

    if (count >= FREE_PER_SKILL[q.section][q.level - 1]) return false;

    taken.set(key, count + 1);

    return true;
  });
}

// The free bank must be able to fill the diagnostic and one module per section.
function checkFreeCoverage(free) {
  const problems = [];

  for (const section of Object.values(SECTIONS)) {
    for (const domain of section.domains) {
      const have = free.filter((q) => q.domain === domain.id).length;
      const want = domain.perModule + DIAGNOSTIC_MIX[section.id][domain.id];

      if (have < want) problems.push(`free ${section.id}/${domain.id}: ${have} questions, needs ${want}`);
    }
  }

  return problems;
}

const bank = [...readingAndWriting(), ...SAT_MATH];
const free = pickFree(bank);
const problems = [...check(bank), ...checkFreeCoverage(free)];

if (problems.length > 0) {
  console.error(`The SAT bank has ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

const counts = (list) => {
  const out = {};

  for (const q of list) out[q.skill] = (out[q.skill] || 0) + 1;

  return out;
};

const freeIds = new Set(free.map((q) => q.id));
const totals = { rw: bank.filter((q) => q.section === 'rw').length, math: bank.filter((q) => q.section === 'math').length, bySkill: counts(bank) };
const note = '// Written by scripts/build-sat-bank.mjs. Do not edit by hand.\n';

mkdirSync(resolve(root, 'src/sat/bank'), { recursive: true });
writeFileSync(
  resolve(root, 'src/sat/bank/free.js'),
  `${note}// The free SAT questions. The rest are sent by the server to Pro accounts.\n` +
    `export const FREE_BANK = ${JSON.stringify(free)};\n\n` +
    `// How many questions the whole bank holds, for "Pro has N more" messages.\n` +
    `export const BANK_TOTALS = ${JSON.stringify(totals)};\n`
);
writeFileSync(
  resolve(root, 'api/_satBank.js'),
  `${note}// Every SAT question. Read only by api/sat-bank.js; never import this from src/.\n` +
    `export const PRO_BANK = ${JSON.stringify(bank.filter((q) => !freeIds.has(q.id)))};\n`
);

console.log(`SAT bank: ${bank.length} questions (${totals.rw} Reading and Writing, ${totals.math} Math). Free: ${free.length}. Pro: ${bank.length - free.length}.`);
