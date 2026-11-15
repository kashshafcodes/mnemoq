import { loadMockData } from './mockStore';
import { supabase } from './supabaseClient';

// Saves the student's exam paths and diagnostic results in Supabase
// (tables user_paths and diagnostics; see supabase/stage1.sql).
//
// A person can follow more than one path (for example NSU and SAT) once
// supabase/stage4.sql has been run. One of them is the active path. Before
// that script is run the table holds one row per person, and choosing a new
// path replaces the old one.

function missingTable(error) {
  return Boolean(
    error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || ''))
  );
}

// The multi-path upsert fails in these ways when stage4.sql has not been run.
function needsStage4(error) {
  return Boolean(
    error &&
      (error.code === '42P10' ||
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        /is_active|no unique or exclusion constraint/i.test(error.message || ''))
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

// Which of the person's rows is in use: the one marked active, else the newest.
export function pickActive(rows = []) {
  if (rows.length === 0) return null;

  const newestFirst = [...rows].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));

  return newestFirst.find((row) => row.is_active === true) || newestFirst[0];
}

// -> { status: 'ready', path, paths, multi, diagnostic, mocks, bank, mockSetup }
//  | { status: 'setup' } | { status: 'error', message }
// `multi` is true when the account can hold several paths (stage4.sql was run).
export async function loadPathState(userId) {
  const pathResult = await supabase.from('user_paths').select('*').eq('user_id', userId);

  if (pathResult.error) {
    return missingTable(pathResult.error)
      ? { status: 'setup' }
      : { status: 'error', message: pathResult.error.message };
  }

  const rows = pathResult.data || [];
  const multi = rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], 'is_active');
  const path = toPath(pickActive(rows));
  const paths = rows.map(toPath);

  if (!path) return { status: 'ready', path: null, paths, multi, diagnostic: null, mocks: [], bank: [], mockSetup: false };

  const diagResult = await supabase
    .from('diagnostics')
    .select('*')
    .eq('user_id', userId)
    .eq('path_id', path.pathId)
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
    paths,
    multi,
    diagnostic: toDiagnostic(diagResult.data?.[0]),
    mocks: mock.mocks,
    bank: mock.bank,
    mockSetup: mock.setup,
  };
}

// Saves a path and makes it the active one.
// -> { path, multi } | { error }. `multi: false` means the old single-path
// table is still in place, so this path replaced whatever was there.
export async function savePath(userId, { pathId, examDate, target }) {
  const row = {
    user_id: userId,
    path_id: pathId,
    exam_date: examDate || null,
    target_score: target,
    updated_at: new Date().toISOString(),
  };

  const many = await supabase
    .from('user_paths')
    .upsert({ ...row, is_active: true }, { onConflict: 'user_id,path_id' })
    .select()
    .single();

  if (!many.error) {
    // Only one path is active at a time.
    await supabase.from('user_paths').update({ is_active: false }).eq('user_id', userId).neq('path_id', pathId);

    return { path: toPath(many.data), multi: true };
  }

  if (missingTable(many.error)) return { error: 'The path tables are not set up yet.' };
  if (!needsStage4(many.error)) return { error: many.error.message };

  const single = await supabase.from('user_paths').upsert(row, { onConflict: 'user_id' }).select().single();

  if (single.error) return { error: missingTable(single.error) ? 'The path tables are not set up yet.' : single.error.message };

  return { path: toPath(single.data), multi: false };
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
