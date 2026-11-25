import { ProIcon, StatsIcon } from '../components/NavIcons';
import { pageHref } from '../useRoute';
import { useNavT } from './strings';

// The bottom of Me (the avatar page): Mnemoq Pro, three short help lines
// (in place of the old "How it works") and, for admins, the Stats page.

export default function MeExtras({ plan, isAdmin }) {
  const t = useNavT();

  return (
    <div className="mq-me-extras">
      <a className="mq-me-pro" href={pageHref('me/pro')}>
        <ProIcon />
        <span>
          <b>{t('me.pro.title')}</b>
          <small>{plan.pro ? t('me.pro.on', { n: plan.daysLeft }) : t('me.pro.off')}</small>
        </span>
        <span aria-hidden="true">→</span>
      </a>

      <section className="profile-card mq-me-help">
        <h3>{t('me.help.title')}</h3>
        <ol>
          <li>{t('me.help.1')}</li>
          <li>{t('me.help.2')}</li>
          <li>{t('me.help.3')}</li>
        </ol>
      </section>

      {isAdmin && (
        <a className="mq-me-pro" href={pageHref('admin')}>
          <StatsIcon />
          <span>
            <b>{t('me.stats')}</b>
          </span>
          <span aria-hidden="true">→</span>
        </a>
      )}
    </div>
  );
}
