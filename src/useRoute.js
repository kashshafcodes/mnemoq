import { useCallback, useEffect, useState } from 'react';
import { PAGES, applyRedirect, hrefFor, resolveRoute } from './nav/routes';
import { track } from './track';

// Tiny page router built on the address bar's #hash, so every section has its
// own address (https://.../#/today) and the browser Back button works, with
// no extra library and no server setup (a refresh on any page just works).
// The rules (tabs, views, old-name aliases) are in src/nav/routes.js.

export { PAGES };

const reportRedirect = (info) => track('route_redirect', info);

function current() {
  return applyRedirect(window.location, window.history, reportRedirect);
}

export function useRoute() {
  const [route, setRoute] = useState(current);

  useEffect(() => {
    const onChange = () => {
      setRoute(current());
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };

    window.addEventListener('hashchange', onChange);

    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  // go('exam/mocks'), go('today'), or an old name (go('path')): unknown -> today.
  const go = useCallback((next) => {
    const target = resolveRoute(`#/${next}`).hash;

    if (window.location.hash === target) {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      return;
    }

    window.location.hash = target.slice(1);
  }, []);

  return { page: route.page, sub: route.sub, go };
}

export const pageHref = hrefFor;
