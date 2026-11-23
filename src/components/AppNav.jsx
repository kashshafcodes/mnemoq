import MnemoqLogo from './MnemoqLogo';
import { AddIcon, DailyIcon, HelpIcon, HomeIcon, LibraryIcon, PathIcon, PracticeIcon, ProIcon, ReviewIcon, StatsIcon } from './NavIcons';
import { PRO } from '../proConfig';
import { launchActive, priceOf, taka } from '../pricing';
import { LanguageToggle, useI18n } from '../i18n';
import { pageHref } from '../useRoute';
import './AppNav.css';

// The app's navigation: the desktop sidebar, the phone top bar and the phone
// tab bar. Kept short on purpose. "Add" is a button, not a page in the list;
// Progress opens from Home and Library; the Daily puzzle is its own full-screen
// game at /daily.

// Pages that live under another menu entry, so that entry stays highlighted.
const PARENT = { mocks: 'path', progress: 'home', add: 'library', report: 'path' };

// A plain function (not a hook): App calls it after its early returns.
export function navItems({ t, dueCount, pathInfo, isAdmin }) {
  const side = [
    ['home', HomeIcon, t('nav.home')],
    ['review', ReviewIcon, t('nav.review'), dueCount],
    ['practice', PracticeIcon, t('nav.practice')],
    ['path', PathIcon, pathInfo ? `${pathInfo.short} path` : t('nav.path')],
    ['library', LibraryIcon, t('nav.library')],
    ['daily', DailyIcon, t('nav.daily'), 0, '/daily'],
    ...(isAdmin ? [['admin', StatsIcon, 'Stats']] : []),
  ];

  const tabs = [
    ['home', HomeIcon, t('nav.home')],
    ['review', ReviewIcon, t('nav.review'), dueCount],
    ['add', AddIcon, t('nav.addShort')],
    ['practice', PracticeIcon, t('nav.practice')],
    ['path', PathIcon, pathInfo ? pathInfo.short : t('nav.pathShort')],
  ];

  return { side, tabs };
}

const isActive = (page, name) => page === name || PARENT[page] === name;
const hrefOf = (name, href) => href || pageHref(name);
const badge = (count) => count > 0 && <b className="mq-count">{count > 99 ? '99+' : count}</b>;

export function Sidebar({ page, items, plan, me, onTutorial, onDebrief, onLogout }) {
  const { t } = useI18n();

  return (
    <aside className="mq-side" aria-label="Main menu">
      <MnemoqLogo size={30} href={pageHref('home')} />

      <a className={`mq-side-add${page === 'add' ? ' active' : ''}`} href={pageHref('add')}>
        <AddIcon /> {t('nav.add')}
      </a>

      <nav className="mq-nav">
        {items.map(([name, NavIcon, label, count, href]) => (
          <a
            key={name}
            className={isActive(page, name) ? 'mq-nav-link active' : 'mq-nav-link'}
            href={hrefOf(name, href)}
            aria-current={isActive(page, name) ? 'page' : undefined}
          >
            <NavIcon />
            <span>{label}</span>
            {badge(count)}
          </a>
        ))}
      </nav>

      <div className="mq-side-bottom">
        {plan.pro ? (
          <a className="mq-pro-card is-pro" href={pageHref('pro')}>
            <ProIcon />
            <span>
              <b>Mnemoq Pro</b>
              <small>
                {plan.daysLeft} {plan.daysLeft === 1 ? 'day' : 'days'} left
              </small>
            </span>
          </a>
        ) : (
          <a className={page === 'pro' ? 'mq-pro-card active' : 'mq-pro-card'} href={pageHref('pro')}>
            <ProIcon />
            <span>
              <b>Go Pro</b>
              <small>
                {launchActive()
                  ? `${PRO.launch.name}: 50% off · from ${taka(priceOf(PRO.offers[0]).now)}`
                  : `Full tests, AI coach · from ${taka(priceOf(PRO.offers[0]).now)}/mo`}
              </small>
            </span>
          </a>
        )}

        <div className="mq-side-links">
          <button type="button" onClick={onTutorial}>
            <HelpIcon /> {t('nav.how')}
          </button>
          <button type="button" onClick={onDebrief}>
            <ReviewIcon /> {t('nav.debrief')}
          </button>
        </div>

        <a className={page === 'profile' ? 'mq-me active' : 'mq-me'} href={pageHref('profile')}>
          <span className="mq-avatar" style={{ '--avatar': me.color.value }} aria-hidden="true">
            {me.initial}
          </span>
          <span className="mq-me-text">
            <b>{me.name || t('nav.profile')}</b>
            <small>{t('nav.profile')} &amp; reminders</small>
          </span>
        </a>
        <div className="mq-side-foot">
          <LanguageToggle />
          <button type="button" className="mq-logout" onClick={onLogout}>
            {t('nav.logout')}
          </button>
        </div>
      </div>
    </aside>
  );
}

export function MobileBar({ plan, me }) {
  const { t } = useI18n();

  return (
    <header className="mq-mobilebar">
      <MnemoqLogo size={26} href={pageHref('home')} />
      <div className="mq-mobilebar-right">
        <a className="mq-daily-chip" href="/daily" aria-label={t('nav.daily')}>
          <DailyIcon />
        </a>
        {!plan.pro && (
          <a className="mq-pro-chip" href={pageHref('pro')}>
            <ProIcon /> Pro
          </a>
        )}
        <a className="mq-avatar" href={pageHref('profile')} style={{ '--avatar': me.color.value }} aria-label={t('nav.profile')}>
          {me.initial}
        </a>
      </div>
    </header>
  );
}

export function TabBar({ page, items }) {
  return (
    <nav className="mq-tabbar" aria-label="Main menu">
      {items.map(([name, NavIcon, label, count]) => (
        <a
          key={name}
          className={`${isActive(page, name) ? 'mq-tab active' : 'mq-tab'}${name === 'add' ? ' mq-tab-add' : ''}`}
          href={pageHref(name)}
          aria-current={isActive(page, name) ? 'page' : undefined}
        >
          <span className="mq-tab-icon">
            <NavIcon />
            {badge(count)}
          </span>
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
