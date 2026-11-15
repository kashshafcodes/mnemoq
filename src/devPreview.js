// Development-only preview: open http://localhost:5173/?preview to see the
// signed-in app with sample data, without an account or a network. It stands
// in for the Supabase client, keeps everything in memory, and is never used in
// a production build (see supabaseClient.js).
//
//   ?preview        signed-in app with sample cards
//   ?preview=new    signed-in app as a brand-new person (no cards)
//   ?preview=admin  as above, and the Stats page is unlocked
//   ?preview=sat    as ?preview, following the Digital SAT path (=nsu for NSU)
//   ?preview=out    signed out (the landing page)
//   ?preview=off    leave preview mode

const KEY = 'mnemoq-dev-preview';

export function previewMode() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return '';

  const params = new URLSearchParams(window.location.search);

  if (params.has('preview')) {
    const value = params.get('preview') || 'on';

    if (value === 'off') sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, value);
  }

  return sessionStorage.getItem(KEY) || '';
}

const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString();

function sampleCards() {
  const rows = [
    ['English', 'Vocabulary', 'What does "ubiquitous" mean?', 'rare', 'found everywhere', -3, 2, 1],
    ['English', 'Grammar', 'Choose the correct verb: "Neither of the boys ___ ready."', 'are', 'is', -1, 1, 0],
    ['Math', 'Algebra', 'If 3x + 7 = 22, what is x?', '4', '5', -6, 4, 6],
    ['Math', 'Geometry', 'Sum of interior angles of a hexagon?', '540°', '720°', -2, 0, 0],
    ['Physics', 'Mechanics', 'Unit of impulse?', 'N/s', 'N·s', -9, 5, 12],
    ['English', 'Reading', 'An author who "equivocates" is…', 'decisive', 'deliberately vague', -4, 3, 2],
    ['Math', 'Data', 'Median of 3, 9, 4, 7, 10?', '6.6', '7', -12, 6, 20],
    ['Biology', 'Genetics', 'Where does transcription happen in eukaryotes?', 'ribosome', 'nucleus', -1, 0, 0],
    ['Physics', 'Kinematics', String.raw`A ball is thrown at speed $v$ and angle $\theta$. Its range is $$R = \frac{v^2 \sin 2\theta}{g}$$ Which angle gives the longest range? [graph: y = x*tan(t) - 9.8*x^2/(2*(v*cos(t))^2); v = 20 [5, 40]; t = 0.8 [0.1, 1.5]; x = 0..50]`, '30°', String.raw`$45^\circ$`, -0.5, 0, 0],
    ['Math', 'Algebra', 'Where does $y = x^2 - 5x + 6$ cross the x-axis? [graph: y = x^2 - b*x + c; b = 5; c = 6; x = -2..7]', 'x = 1 and 6', '$x = 2$ and $x = 3$', -0.4, 0, 0],
  ];

  return rows.map(([subject, category, question, yours, correct, created, count, interval], i) => ({
    id: `p${i + 1}`,
    user_id: 'preview-user',
    subject,
    category,
    question,
    your_answer: yours,
    correct_answer: correct,
    explanation: '',
    distractors: [],
    created_at: iso(created),
    next_review_at: i % 3 === 0 ? iso(-0.2) : iso(interval / 2 + 0.5),
    review_count: count,
    review_interval_days: interval,
    mastered: interval >= 20,
  }));
}

function sampleReviews(cards) {
  const out = [];
  let id = 1;

  for (let day = 12; day >= 1; day -= 1) {
    for (const card of cards.slice(0, 2 + (day % 4))) {
      out.push({
        id: id++,
        user_id: 'preview-user',
        mistake_id: card.id,
        subject: card.subject,
        category: card.category,
        rating: day % 5 === 0 ? 'again' : 'good',
        recalled: day % 5 !== 0,
        interval_days: Math.max(1, 12 - day),
        created_at: iso(-day),
      });
    }
  }

  return out;
}

// A query builder that accepts any chain and resolves to the table's rows.
function builder(db, table) {
  let op = 'select';
  let single = false;
  let payload = null;

  const result = () => {
    if (op === 'select') {
      const rows = db[table] || [];

      return { data: single ? rows[0] || null : rows, error: null, count: rows.length };
    }

    if (op === 'insert' || op === 'upsert') {
      const list = Array.isArray(payload) ? payload : [payload];

      db[table] = [...(db[table] || []), ...list.map((row, i) => ({ id: `${table}-${Date.now()}-${i}`, ...row }))];

      return { data: single ? list[0] : list, error: null };
    }

    return { data: null, error: null };
  };

  const chain = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return (ok, fail) => Promise.resolve(result()).then(ok, fail);
        if (prop === 'maybeSingle' || prop === 'single') {
          return () => {
            single = true;
            return chain;
          };
        }
        if (['insert', 'upsert', 'update', 'delete'].includes(prop)) {
          return (value) => {
            op = prop;
            payload = value;
            return chain;
          };
        }

        return () => chain;
      },
    }
  );

  return chain;
}

export function createPreviewClient(mode) {
  const signedIn = mode !== 'out';
  const cards = mode === 'new' ? [] : sampleCards();
  const db = {
    mistakes: cards,
    reviews: mode === 'new' ? [] : sampleReviews(cards),
    user_paths:
      mode === 'sat' || mode === 'nsu' || mode === 'brac'
        ? [{ user_id: 'preview-user', path_id: mode, is_active: true, exam_date: iso(60).slice(0, 10), target_score: mode === 'sat' ? 1400 : 75, updated_at: iso(0) }]
        : [],
  };
  const user = { id: 'preview-user', email: 'preview@mnemoq.test', user_metadata: { name: 'Preview' } };
  const session = signedIn ? { user, access_token: 'preview' } : null;

  return {
    preview: true,
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session ? user : null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signUp: async () => ({ data: { user, session: null }, error: null }),
      signInWithPassword: async () => ({ data: {}, error: { message: 'Preview mode: sign-in is disabled.' } }),
      signOut: async () => {
        sessionStorage.setItem(KEY, 'out');
        window.location.reload();
        return { error: null };
      },
      updateUser: async () => ({ data: { user }, error: null }),
    },
    from: (table) => builder(db, table),
    rpc: async (name) => {
      if (name === 'is_site_admin') return { data: mode === 'admin', error: null };
      if (name.startsWith('admin_')) return { data: null, error: { message: 'Preview mode: no live stats.' } };

      return { data: null, error: null };
    },
  };
}
