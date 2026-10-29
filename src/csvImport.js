// Tiny CSV reader for bulk-adding cards. No dependencies.
//
// Columns (header row required, any order, extra columns ignored):
//   question, answer        <- required
//   wrong, hook             <- optional (your wrong answer, memory hook)
//   subject, category       <- optional (fall back to where you're adding now)

// Handles quoted fields, commas/newlines inside quotes, "" escapes, CRLF and
// the BOM that Excel adds to UTF-8 files.
export function parseCsv(text) {
  const input = String(text).replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const c = input[i];

    if (inQuotes) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);

  return rows;
}

const HEADERS = {
  question: ['question', 'q'],
  answer: ['answer', 'correct answer', 'correct_answer', 'a'],
  wrong: ['wrong', 'wrong answer', 'wrong_answer', 'your answer', 'your_answer'],
  hook: ['hook', 'memory hook', 'memory_hook', 'explanation'],
  subject: ['subject'],
  category: ['category'],
};

// Returns { cards, skipped }. Throws a readable Error if the header is wrong.
export function csvToCards(text) {
  const [header, ...body] = parseCsv(text);

  if (!header) throw new Error('That file is empty.');

  const names = header.map((name) => name.trim().toLowerCase());
  const col = {};

  for (const [key, aliases] of Object.entries(HEADERS)) {
    const index = names.findIndex((name) => aliases.includes(name));
    if (index !== -1) col[key] = index;
  }

  if (col.question === undefined || col.answer === undefined) {
    throw new Error('The first row needs "question" and "answer" columns.');
  }

  const get = (row, key) =>
    col[key] === undefined ? '' : (row[col[key]] ?? '').trim();

  const cards = [];
  let skipped = 0;

  for (const row of body) {
    const question = get(row, 'question');
    const correctAnswer = get(row, 'answer');

    if (!question || !correctAnswer) {
      skipped++;
      continue;
    }

    cards.push({
      question,
      correctAnswer,
      yourAnswer: get(row, 'wrong'),
      explanation: get(row, 'hook'),
      subject: get(row, 'subject'),
      category: get(row, 'category'),
    });
  }

  return { cards, skipped };
}
