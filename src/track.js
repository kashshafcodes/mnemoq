import { supabase } from './supabaseClient';

// First-party visitor and activity tracking (supabase/analytics.sql).
//
// Every visitor gets a random anonymous id (kept in this browser), each visit a
// session id, and the first link that brought them (utm_source, a Facebook or
// Instagram referrer, ...) is remembered so a later sign-up or payment can be
// traced back to the post that brought them. Events go to the `site_events`
// table, which only the owner can read (the Stats page, #/admin), and to GA4.
//
// Never send emails, names, card text or answers: only event names, the page
// and small anonymous properties.

const VISITOR_KEY = 'mnemoq-visitor';
const SESSION_KEY = 'mnemoq-session';
const SOURCE_KEY = 'mnemoq-source';
const SESSION_IDLE_MS = 30 * 60 * 1000;

let userId = null;
let disabled = false;

const randomId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/-/g, '').slice(0, 24);

function store(kind) {
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function read(kind, key) {
  try {
    return store(kind)?.getItem(key) || null;
  } catch {
    return null;
  }
}

function write(kind, key, value) {
  try {
    store(kind)?.setItem(key, value);
  } catch {
    // Private mode or storage blocked: tracking just becomes per page load.
  }
}

export function visitorId() {
  let id = read('local', VISITOR_KEY);

  if (!id) {
    id = randomId();
    write('local', VISITOR_KEY, id);
  }

  return id;
}

function sessionId() {
  const now = Date.now();
  const saved = read('session', SESSION_KEY);
  const [id, last] = saved ? saved.split(':') : [];
  const next = id && now - Number(last) < SESSION_IDLE_MS ? id : randomId();

  write('session', SESSION_KEY, `${next}:${now}`);

  return next;
}

const clip = (value, n = 80) => (value ? String(value).slice(0, n) : null);

// Where this visit came from: UTM tags first, then the referring site.
function sourceFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const utm = (k) => clip(params.get(`utm_${k}`), 60);
  const ref = clip(params.get('ref'), 60);
  let referrer = '';

  try {
    referrer = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
  } catch {
    referrer = '';
  }

  if (referrer === window.location.hostname) referrer = '';

  const fromReferrer = () => {
    if (!referrer) return null;
    if (/facebook|fb\.|messenger/.test(referrer)) return 'facebook';
    if (/instagram/.test(referrer)) return 'instagram';
    if (/t\.co$|twitter|x\.com/.test(referrer)) return 'x';
    if (/linkedin|lnkd/.test(referrer)) return 'linkedin';
    if (/youtube|youtu\.be/.test(referrer)) return 'youtube';
    if (/tiktok/.test(referrer)) return 'tiktok';
    if (/whatsapp|wa\.me/.test(referrer)) return 'whatsapp';
    if (/reddit/.test(referrer)) return 'reddit';
    if (/google\./.test(referrer)) return 'google';
    return referrer;
  };

  const source = utm('source') || ref || (params.has('fbclid') ? 'facebook' : null) || fromReferrer();

  if (!source) return null;

  return {
    source: source.toLowerCase(),
    medium: utm('medium') || (referrer ? 'referral' : null),
    campaign: utm('campaign'),
    content: utm('content'),
    referrer: clip(referrer, 80),
    landed_at: new Date().toISOString(),
  };
}

// First touch wins: the post that first brought someone keeps the credit.
export function trafficSource() {
  let saved = null;

  try {
    saved = JSON.parse(read('local', SOURCE_KEY) || 'null');
  } catch {
    saved = null;
  }

  if (saved) return saved;

  const found = typeof window !== 'undefined' ? sourceFromUrl() : null;
  const value = found || { source: 'direct', medium: null, campaign: null, content: null, referrer: null, landed_at: new Date().toISOString() };

  write('local', SOURCE_KEY, JSON.stringify(value));

  return value;
}

function device() {
  const ua = navigator.userAgent || '';

  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|iphone|android/i.test(ua)) return 'mobile';

  return 'desktop';
}

export function identify(id) {
  userId = id || null;
}

// Fire and forget. Never throws, never slows the page down.
export function track(event, props = {}) {
  if (disabled || typeof window === 'undefined') return;

  const src = trafficSource();
  const page = clip(props.page || (window.location.hash || '#/').replace(/^#\/?/, '') || 'landing', 40);
  const cleanProps = {};

  for (const [key, value] of Object.entries(props)) {
    if (key === 'page' || value === undefined || value === null) continue;
    cleanProps[clip(key, 30)] = typeof value === 'number' || typeof value === 'boolean' ? value : clip(value, 60);
  }

  // The clip or creator in the first-touch link (utm_content). site_events has
  // no column for it, so it rides in props.
  if (src.content && !cleanProps.utm_content) cleanProps.utm_content = src.content;

  const row = {
    visitor_id: visitorId(),
    session_id: sessionId(),
    user_id: userId,
    event: clip(event, 40),
    page,
    source: src.source,
    medium: src.medium,
    campaign: src.campaign,
    referrer: src.referrer,
    device: device(),
    lang: clip(document.documentElement.lang || navigator.language, 10),
    props: Object.keys(cleanProps).length ? cleanProps : null,
  };

  Promise.resolve(supabase.from('site_events').insert(row))
    .then(({ error } = {}) => {
      // The table is not set up yet: stop trying for this page load.
      if (error && /does not exist|schema cache|42P01|PGRST205/i.test(`${error.code} ${error.message}`)) disabled = true;
    })
    .catch(() => {});
}

let lastPage = null;

export function trackPage(page) {
  if (page === lastPage) return;

  lastPage = page;
  track('page_view', { page });

  if (typeof window.gtag === 'function') window.gtag('event', 'page_view', { page_title: page, page_location: window.location.href });
}

// Is the signed-in person allowed to see the Stats page? (site_admins table)
export async function checkAdmin() {
  try {
    const { data, error } = await supabase.rpc('is_site_admin');

    return !error && data === true;
  } catch {
    return false;
  }
}
