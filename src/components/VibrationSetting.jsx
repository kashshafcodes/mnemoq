import { hapticsPlatform, useHapticsSetting } from '../haptics';
import { feel } from '../sensory';
import { useI18n } from '../i18n';

// The "Vibration" card on the profile page, next to Reminders. One switch for
// the whole app, saved on this device. The Daily's own switch is the same one.

export default function VibrationSetting() {
  const { t } = useI18n();
  const [on, setOn] = useHapticsSetting();
  const platform = hapticsPlatform();

  function toggle() {
    setOn(!on);
    // Turning it on plays one tick so you feel it straight away.
    feel(on ? 'toggle.off' : 'toggle.on');
  }

  return (
    <section className="profile-card rm" id="vibration">
      <div className="rm-head">
        <div>
          <h3>{t('vibration.title')}</h3>
          <p className="rm-muted">{t('vibration.body')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={t('vibration.title')}
          className={on ? 'rm-switch on' : 'rm-switch'}
          onClick={toggle}
        >
          <span />
        </button>
      </div>
      {platform === 'ios' && <p className="rm-muted">{t('vibration.iphone')}</p>}
      {platform === 'none' && <p className="rm-muted">{t('vibration.none')}</p>}
    </section>
  );
}
