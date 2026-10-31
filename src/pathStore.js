import { loadMockData } from './mockStore';
import { supabase } from './supabaseClient';

// Saves the student's exam path and diagnostic results in Supabase
// (tables user_paths and diagnostics; see supabase/stage1.sql).

function missingTable(error) {
  return Boolean(
    error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || ''))
  );
}

const toPath = (row) =>
  row ? { pathId: row.path_id, examDate: row.exam_date || null, target: row.target_score ?? 75 } : null;

const toDiagnostic = (row) =>
  row
    ? {
        id: row.id,
        pathId: row.path_id,
        kind: row.kind,
        sections: Array.isArray(row.sections) ? row.sections : [],
        essay: row.essay || null,
        analysis: row.analysis || null,
        createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      }
    : null;

// -> { status: 'ready', path, diagnostic } | { status: 'setup' } | { status: 'error', message }
export async function loadPathState(userId) {
  const pathResult = await supabase.from('user_paths').select('*').eq('user_id', userId).maybeSingle();

  if (pathResult.error) {
    return missingTable(pathResult.error)
      ? { status: 'setup' }
      : { status: 'error', message: pathResult.error.message };
  }

  const path = toPath(pathResult.data);

  if (!path) return { status: 'ready', path: null, diagnostic: null, mocks: [], bank: [], mockSetup: false };

  const diagResult = await supabase
    .from('diagnostics')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (diagResult.error) {
    return missingTable(diagResult.error)
      ? { status: 'setup' }
      : { status: 'error', message: diagResult.error.message };
  }

  const mock = await loadMockData(userId, path.pathId).catch(() => ({ setup: false, mocks: [], bank: [] }));

  return {
    status: 'ready',
    path,
    diagnostic: toDiagnostic(diagResult.data?.[0]),
    mocks: mock.mocks,
    bank: mock.bank,
    mockSetup: mock.setup,
  };
}

export async function savePath(userId, { pathId, examDate, target }) {
  const { data, error } = await supabase
    .from('user_paths')
    .upsert(
      { user_id: userId, path_id: pathId, exam_date: examDate || null, target_score: target, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) return { error: missingTable(error) ? 'The path tables are not set up yet.' : error.message };

  return { path: toPath(data) };
}

export async function saveDiagnostic(userId, { pathId, kind, sections, essay, analysis }) {
  const { data, error } = await supabase
    .from('diagnostics')
    .insert({ user_id: userId, path_id: pathId, kind, sections, essay: essay || null, analysis: analysis || null })
    .select()
    .single();

  if (error) return { error: missingTable(error) ? 'The path tables are not set up yet.' : error.message };

  return { diagnostic: toDiagnostic(data) };
}

export async function saveAnalysis(diagnosticId, analysis) {
  const { error } = await supabase.from('diagnostics').update({ analysis }).eq('id', diagnosticId);

  return error ? { error: error.message } : { error: '' };
}
