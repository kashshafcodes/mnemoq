// The app's addresses (the part after #/), as pure functions so every rule is
// tested without a browser (tests/routes.test.js). Spec: company/product/phase2-tabs.md §4.
//
// Five tabs (Today, Exam, Snap, Progress, Library), Me behind the avatar, and
// full-screen flows opened by Play (review, daily, drill, done). A second
// segment picks a view: #/exam/mocks, #/exam/practice, #/exam/report, #/me/pro.
//
// Old addresses stay accepted forever: saved links, bookmarks and the
// notification URLs in api/_push.js (/#/review) keep working.

export const TABS = ['today', 'exam', 'snap', 'progress', 'library'];

export const PAGES = [...TABS, 'me', 'review', 'daily', 'drill', 'done', 'admin'];

const SUBS = { exam: ['mocks', 'practice', 'report'], me: ['pro'] };

// Old name -> where it lives now.
export const ALIASES = {
  home: 'today',
  add: 'snap',
  path: 'exam',
  mocks: 'exam/mocks',
  practice: 'exam/practice',
  report: 'exam/report',
  profile: 'me',
  pro: 'me/pro',
  // Bookmarks from before the pages existed.
  dashboard: 'progress',
  mistakes: 'library',
};

// Flow and hidden pages highlight the tab they belong to.
export const PARENT = { review: 'today', daily: 'today', drill: 'today', done: 'today', admin: 'me' };

// '#/Path?x=1' -> { page: 'exam', sub: null, path: 'exam', query: '?x=1',
//                   hash: '#/exam?x=1', redirected: true, from: 'path' }
// An empty hash or '#/' is Today without a rewrite (nothing old to fix).
export function resolveRoute(hash) {
  const raw = String(hash || '').replace(/^#\/?/, '');
  const cut = raw.indexOf('?');
  const path = (cut >= 0 ? raw.slice(0, cut) : raw).toLowerCase();
  const query = cut >= 0 ? raw.slice(cut) : '';
  const [name = '', sub = ''] = path.split('/').filter(Boolean);

  let target;

  if (PAGES.includes(name)) target = sub && SUBS[name]?.includes(sub) ? `${name}/${sub}` : name;
  else if (ALIASES[name]) target = ALIASES[name];
  else target = 'today';

  const [page, subPage = null] = target.split('/');
  const canonical = `#/${target}${query}`;
  const redirected = name !== '' && raw !== `${target}${query}`;

  return { page, sub: subPage, path: target, query, hash: canonical, redirected, from: redirected ? path || null : null };
}

// The address of a page, by new or old name: pageHref('profile') -> '#/me'.
export const hrefFor = (name) => resolveRoute(`#/${name}`).hash;

// Is this tab the one to highlight for the current page?
export const tabIsActive = (page, tab) => page === tab || PARENT[page] === tab;

// Rewrites an old address in place (no new history entry, so Back never
// loops) and reports it. `loc` and `hist` are window.location / window.history,
// or fakes in tests. Returns the resolved route.
export function applyRedirect(loc, hist, onRedirect) {
  const route = resolveRoute(loc.hash);

  if (route.redirected) {
    hist.replaceState(hist.state ?? null, '', `${loc.pathname}${loc.search}${route.hash}`);
    onRedirect?.({ from: route.from, to: route.path });
  }

  return route;
}

// Stats: page views logged before the tabs (home, add, path, profile, ...)
// count as the page they became, so old and new rows add up.
export function pageNameNow(name) {
  const value = String(name || '');

  return ALIASES[value] || value;
}

// Merges the Stats page's per-page rows under today's names. Visitors are
// summed, so a merged row's visitor count is an upper bound.
export function mergePages(rows = []) {
  const byName = new Map();

  for (const row of rows || []) {
    const page = pageNameNow(row.page);
    const seen = byName.get(page) || { page, views: 0, visitors: 0 };

    seen.views += Number(row.views) || 0;
    seen.visitors += Number(row.visitors) || 0;
    byName.set(page, seen);
  }

  return [...byName.values()].sort((a, b) => b.views - a.views);
}
