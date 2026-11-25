import { describe, expect, it } from 'vitest';
import { ALIASES, applyRedirect, hrefFor, mergePages, pageNameNow, resolveRoute, tabIsActive } from '../src/nav/routes.js';

describe('resolveRoute: the five tabs and their views', () => {
  it('accepts every new name without a rewrite', () => {
    for (const name of ['today', 'exam', 'snap', 'progress', 'library', 'me', 'review', 'daily', 'drill', 'done', 'admin']) {
      const route = resolveRoute(`#/${name}`);

      expect(route.page).toBe(name);
      expect(route.sub).toBe(null);
      expect(route.redirected).toBe(false);
    }
  });

  it('reads the second segment as a view', () => {
    expect(resolveRoute('#/exam/mocks')).toMatchObject({ page: 'exam', sub: 'mocks', redirected: false });
    expect(resolveRoute('#/exam/practice')).toMatchObject({ page: 'exam', sub: 'practice' });
    expect(resolveRoute('#/exam/report')).toMatchObject({ page: 'exam', sub: 'report' });
    expect(resolveRoute('#/me/pro')).toMatchObject({ page: 'me', sub: 'pro', hash: '#/me/pro' });
  });

  it('drops an unknown view and rewrites to the page', () => {
    expect(resolveRoute('#/exam/nope')).toMatchObject({ page: 'exam', sub: null, hash: '#/exam', redirected: true });
    expect(resolveRoute('#/today/pro')).toMatchObject({ page: 'today', sub: null, redirected: true });
  });

  it('treats an empty hash and #/ as Today without a rewrite', () => {
    for (const hash of ['', '#', '#/', undefined]) {
      expect(resolveRoute(hash)).toMatchObject({ page: 'today', redirected: false });
    }
  });

  it('sends unknown names to Today', () => {
    expect(resolveRoute('#/recovery')).toMatchObject({ page: 'today', hash: '#/today', redirected: true, from: 'recovery' });
    expect(resolveRoute('#/whatever/else')).toMatchObject({ page: 'today', redirected: true });
  });

  it('is case-insensitive and keeps the query part', () => {
    expect(resolveRoute('#/Review')).toMatchObject({ page: 'review', hash: '#/review', redirected: true });
    expect(resolveRoute('#/me?reminders')).toMatchObject({ page: 'me', query: '?reminders', redirected: false });
    expect(resolveRoute('#/profile?reminders')).toMatchObject({ page: 'me', hash: '#/me?reminders', redirected: true });
  });
});

describe('old links (the alias table in phase2-tabs.md §4)', () => {
  const table = {
    '#/home': '#/today',
    '#/add': '#/snap',
    '#/path': '#/exam',
    '#/mocks': '#/exam/mocks',
    '#/practice': '#/exam/practice',
    '#/report': '#/exam/report',
    '#/profile': '#/me',
    '#/pro': '#/me/pro',
    '#/dashboard': '#/progress',
    '#/mistakes': '#/library',
  };

  it('rewrites every old hash to its new home', () => {
    for (const [old, now] of Object.entries(table)) {
      const route = resolveRoute(old);

      expect(route.hash).toBe(now);
      expect(route.redirected).toBe(true);
      expect(route.from).toBe(old.slice(2));
    }

    expect(Object.keys(ALIASES).length).toBe(Object.keys(table).length);
  });

  it('leaves the flow routes and notification URLs alone', () => {
    for (const hash of ['#/review', '#/daily', '#/done', '#/progress', '#/library', '#/admin']) {
      expect(resolveRoute(hash)).toMatchObject({ hash, redirected: false });
    }
  });

  it('builds links by new or old name', () => {
    expect(hrefFor('profile')).toBe('#/me');
    expect(hrefFor('home')).toBe('#/today');
    expect(hrefFor('exam/mocks')).toBe('#/exam/mocks');
    expect(hrefFor('nonsense')).toBe('#/today');
    expect(`${hrefFor('profile')}?reminders`).toBe('#/me?reminders');
  });
});

describe('applyRedirect: rewriting the address bar', () => {
  const fake = (hash, path = '/', search = '') => {
    const calls = [];
    const hist = { state: null, replaceState: (state, title, url) => calls.push(url) };

    return { loc: { hash, pathname: path, search }, hist, calls };
  };

  it('replaces (never pushes) an old hash and reports it once', () => {
    const { loc, hist, calls } = fake('#/path', '/', '?utm_source=x');
    const seen = [];
    const route = applyRedirect(loc, hist, (info) => seen.push(info));

    expect(route.page).toBe('exam');
    expect(calls).toEqual(['/?utm_source=x#/exam']);
    expect(seen).toEqual([{ from: 'path', to: 'exam' }]);
  });

  it('keeps the query after the hash', () => {
    const { loc, hist, calls } = fake('#/profile?reminders');

    applyRedirect(loc, hist);
    expect(calls).toEqual(['/#/me?reminders']);
  });

  it('does nothing for a current address or an empty hash', () => {
    for (const hash of ['#/today', '#/review', '#/exam/mocks', '']) {
      const { loc, hist, calls } = fake(hash);
      const seen = [];

      applyRedirect(loc, hist, (info) => seen.push(info));
      expect(calls).toEqual([]);
      expect(seen).toEqual([]);
    }
  });
});

describe('tab highlight and stats names', () => {
  it('highlights the parent tab for flows', () => {
    expect(tabIsActive('review', 'today')).toBe(true);
    expect(tabIsActive('daily', 'today')).toBe(true);
    expect(tabIsActive('done', 'today')).toBe(true);
    expect(tabIsActive('admin', 'me')).toBe(true);
    expect(tabIsActive('exam', 'exam')).toBe(true);
    expect(tabIsActive('review', 'library')).toBe(false);
  });

  it('counts old page names as the new pages on the Stats page', () => {
    expect(pageNameNow('home')).toBe('today');
    expect(pageNameNow('path')).toBe('exam');
    expect(pageNameNow('today')).toBe('today');

    expect(
      mergePages([
        { page: 'home', views: 10, visitors: 4 },
        { page: 'today', views: 5, visitors: 3 },
        { page: 'add', views: 2, visitors: 2 },
        { page: 'library', views: 7, visitors: 1 },
      ])
    ).toEqual([
      { page: 'today', views: 15, visitors: 7 },
      { page: 'library', views: 7, visitors: 1 },
      { page: 'snap', views: 2, visitors: 2 },
    ]);
  });
});
