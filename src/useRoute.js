import { useCallback, useEffect, useState } from 'react';

// Tiny page router built on the address bar's #hash, so every section has its
// own address (https://.../#/review) and the browser Back button works, with
// no extra library and no server setup (a refresh on any page just works).

export const PAGES = ['home', 'progress', 'add', 'library', 'review', 'profile', 'path'];

// Links and bookmarks from before the pages existed still land somewhere sensible.
const OLD_ANCHORS = { dashboard: 'progress', mistakes: 'library', review: 'review' };

function readPage() {
  const name = String(window.location.hash || '')
    .replace(/^#\/?/, '')
    .split(/[/?]/)[0]
    .toLowerCase();

  if (PAGES.includes(name)) return name;

  return OLD_ANCHORS[name] || 'home';
}

export function useRoute() {
  const [page, setPage] = useState(readPage);

  useEffect(() => {
    const onChange = () => {
      setPage(readPage());
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };

    window.addEventListener('hashchange', onChange);

    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const go = useCallback((next) => {
    const target = PAGES.includes(next) ? next : 'home';

    if (readPage() === target && window.location.hash === `#/${target}`) {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      return;
    }

    window.location.hash = `/${target}`;
  }, []);

  return { page, go };
}

export const pageHref = (name) => `#/${name}`;
