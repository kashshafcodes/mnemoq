import MnemoqLogo from './MnemoqLogo';
import { HomeIcon, LibraryIcon, PathIcon, ProIcon, ProgressIcon, SnapIcon } from './NavIcons';
import { PRO } from '../proConfig';
import { launchActive, priceOf, taka } from '../pricing';
import { LanguageToggle, useI18n } from '../i18n';
import { pageHref } from '../useRoute';
import { tabIsActive } from '../nav/routes';
import { useNavT } from '../nav/strings';
import { track } from '../track';
import '../nav/nav.css';
import './AppNav.css';

// The app's navigation (spec company/product/phase2-tabs.md): five tabs,
// Today · Exam · (Snap) · Progress · Library, the same on the phone tab bar
// and the desktop sidebar. Me opens from the avatar. Review, the Daily and
// "Done for today" are full-screen flows opened by Play, not tabs.

// A plain function (not a hook): App calls it after its early returns.
export function navItems({ t, dueCount }) {
  const today = ['today', HomeIcon, t('nav.today'), dueCount];
  const exam = ['exam', PathIcon, t('nav.exam')];
  const progress = ['progress', ProgressIcon, t('nav.progress')];
  const library = ['library', LibraryIcon, t('nav.library')];

  return {
    side: [today, exam, progress, library],
    tabs: [today, exam, ['snap', SnapIcon, t('nav.snap')], progress, library],
  };
}

const badge = (count) => count > 0 && <b className="mq-count">{count > 99 ? '99+' : count}</b>;

const tapped = (tab, from, surface) => () => track('nav_tab', { tab, from, surface });

export function Sidebar({ page, items, plan, me, onLogout }) {
  const { t } = useI18n();
  const nt = useNavT();

  return (
    <aside className="mq-side" aria-label={nt('nav.main')}>
      <MnemoqLogo size={30} href={pageHref('today')} />

      <a className={`mq-side-add${page === 'snap' ? ' active' : ''}`} href={pageHref('snap')} onClick={tapped('snap', page, 'desktop')}>
        <SnapIcon /> {nt('nav.snapLong')}
      </a>

      <nav className="mq-nav">
        {items.map(([name, NavIcon, label, count]) => (
          <a
            key={name}
            className={tabIsActive(page, name) ? 'mq-nav-link active' : 'mq-nav-link'}
            href={pageHref(name)}
            aria-current={tabIsActive(page, name) ? 'page' : undefined}
            onClick={tapped(name, page, 'desktop')}
          >
            <NavIcon />
            <span>{label}</span>
            {badge(count)}
          </a>
        ))}
      </nav>

      <div className="mq-side-bottom">
        {plan.pro ? (
          <a className="mq-pro-card is-pro" href={pageHref('me/pro')}>
            <ProIcon />
            <span>
              <b>Mnemoq Pro</b>
              <small>
                {plan.daysLeft} {plan.daysLeft === 1 ? 'day' : 'days'} left
              </small>
            </span>
          </a>
        ) : (
          <a className="mq-pro-card" href={pageHref('me/pro')}>
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

        <a className={tabIsActive(page, 'me') ? 'mq-me active' : 'mq-me'} href={pageHref('me')} onClick={tapped('me', page, 'desktop')}>
          <span className="mq-avatar" style={{ '--avatar': me.color.value }} aria-hidden="true">
            {me.initial}
          </span>
          <span className="mq-me-text">
            <b>{me.name || nt('nav.me')}</b>
            {me.name && <small>{nt('nav.me')}</small>}
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

// Phone top bar: the logo and the avatar (Me). Nothing else.
export function MobileBar({ page, me }) {
  const nt = useNavT();

  return (
    <header className="mq-mobilebar">
      <MnemoqLogo size={26} href={pageHref('today')} />
      <div className="mq-mobilebar-right">
        <a
          className={`mq-avatar${tabIsActive(page, 'me') ? ' active' : ''}`}
          href={pageHref('me')}
          style={{ '--avatar': me.color.value }}
          aria-label={nt('nav.me')}
          onClick={tapped('me', page, 'phone')}
        >
          {me.initial}
        </a>
      </div>
    </header>
  );
}

// Tab switches are silent (sensory spec 1.4): no feel() here. The pill
// behind the active icon slides between tabs (translateX) and the icon pops
// once (D6). Snap has its own raised button, so the pill hides there.
export function TabBar({ page, items }) {
  const nt = useNavT();
  const at = items.findIndex(([name]) => tabIsActive(page, name));
  const pill = at >= 0 && items[at][0] !== 'snap';

  return (
    <nav className="mq-tabbar" aria-label={nt('nav.main')}>
      <span className={`mq-tab-pill${pill ? '' : ' is-off'}`} style={{ '--i': Math.max(0, at) }} aria-hidden="true">
        <i />
        <b />
      </span>
      {items.map(([name, NavIcon, label, count]) => (
        <a
          key={name}
          className={`${tabIsActive(page, name) ? 'mq-tab active' : 'mq-tab'}${name === 'snap' ? ' mq-tab-snap' : ''}`}
          href={pageHref(name)}
          aria-current={tabIsActive(page, name) ? 'page' : undefined}
          onClick={tapped(name, page, 'phone')}
        >
          <span className="mq-tab-icon">
            <NavIcon />
            {badge(count)}
          </span>
          <span className="mq-tab-label">{label}</span>
        </a>
      ))}
    </nav>
  );
}

// Path · Mock tests · Practice at the top of the Exam tab: views of one
// destination, not menu items.
export function ExamSegments({ view }) {
  const nt = useNavT();
  const views = [
    ['path', 'exam'],
    ['mocks', 'exam/mocks'],
    ['practice', 'exam/practice'],
  ];

  return (
    <nav className="mq-seg mq-exam-seg" aria-label={nt('nav.examViews')}>
      {views.map(([id, href]) => (
        <a
          key={id}
          href={pageHref(href)}
          className={view === id ? 'active' : ''}
          aria-current={view === id ? 'page' : undefined}
          onClick={() => track('exam_segment', { segment: id })}
        >
          {nt(`exam.seg.${id}`)}
        </a>
      ))}
    </nav>
  );
}
