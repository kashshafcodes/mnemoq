import { supabase } from './supabaseClient';

// Mock test results and the student's own questions (supabase/stage3.sql).

function missingTable(error) {
  return Boolean(
    error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || ''))
  );
}

const toMock = (row) => ({
  id: row.id,
  pathId: row.path_id,
  sections: Array.isArray(row.sections) ? row.sections : [],
  correct: row.correct,
  total: row.total,
  seconds: row.seconds,
  limitSeconds: row.limit_seconds ?? null,
  source: row.source,
  createdAt: row.created_at ? new Date(row.created_at) : new Date(),
});

const toQuestion = (row) => ({
  id: row.id,
  pathId: row.path_id,
  sectionId: row.section_id,
  question: row.question,
  options: Array.isArray(row.options) ? row.options : [],
  answer: row.answer,
  aiKey: Boolean(row.ai_key),
});

// -> { setup: boolean, mocks, bank }. A missing table means stage3.sql has not been run.
export async function loadMockData(userId, pathId) {
  const [mockResult, bankResult] = await Promise.all([
    supabase.from('mock_results').select('*').eq('user_id', userId).eq('path_id', pathId).order('created_at', { ascending: false }).limit(30),
    supabase.from('my_questions').select('*').eq('user_id', userId).eq('path_id', pathId).order('created_at', { ascending: true }).limit(500),
  ]);

  if (missingTable(mockResult.error) || missingTable(bankResult.error)) return { setup: true, mocks: [], bank: [] };

  return {
    setup: false,
    mocks: (mockResult.data || []).map(toMock),
    bank: (bankResult.data || []).map(toQuestion),
  };
}

export async function saveMock(userId, { pathId, sections, correct, total, seconds, limitSeconds, source }) {
  const { data, error } = await supabase
    .from('mock_results')
    .insert({
      user_id: userId,
      path_id: pathId,
      sections,
      correct,
      total,
      seconds,
      limit_seconds: limitSeconds,
      source,
    })
    .select()
    .single();

  if (error) return { error: missingTable(error) ? 'The mock test tables are not set up yet.' : error.message };

  return { mock: toMock(data) };
}

export async function saveQuestions(userId, pathId, sectionId, questions) {
  const rows = questions.map((q) => ({
    user_id: userId,
    path_id: pathId,
    section_id: sectionId,
    question: q.question,
    options: q.options,
    answer: q.answer,
    ai_key: Boolean(q.aiKey),
  }));
  const { data, error } = await supabase.from('my_questions').insert(rows).select();

  if (error) return { error: missingTable(error) ? 'The mock test tables are not set up yet.' : error.message };

  return { questions: (data || []).map(toQuestion) };
}

export async function deleteQuestion(id) {
  const { error } = await supabase.from('my_questions').delete().eq('id', id);

  return { error: error ? error.message : '' };
}
