import { feel, useSensorySettings } from './index.js';
import { useSensoryT } from './strings.js';
import { track } from '../track';

// The "Sound" card on Me, beside Vibration: one Sound switch and, under it,
// a Music row. Saved on this device (the one sensory store). The iPhone
// silent-switch line is left out until a real iPhone confirms it (spec 5).

function Switch({ on, label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={on ? 'rm-switch on' : 'rm-switch'}
      onClick={onClick}
    >
      <span />
    </button>
  );
}

export default function SoundSetting() {
  const t = useSensoryT();
  const [state, set] = useSensorySettings();

  function toggleSound() {
    const on = !state.sound;

    set({ sound: on });
    // Turning it on plays one soft note so you hear it straight away.
    feel(on ? 'toggle.on' : 'toggle.off');
    track('sound_toggled', { on });
  }

  function toggleMusic() {
    const on = !state.music;

    feel(on ? 'toggle.on' : 'toggle.off');
    set({ music: on });
    track('music_toggled', { on });
  }

  return (
    <section className="profile-card rm" id="sound">
      <div className="rm-head">
        <div>
          <h3>{t('sound.title')}</h3>
          <p className="rm-muted">{t('sound.body')}</p>
        </div>
        <Switch on={state.sound} label={t('sound.title')} onClick={toggleSound} />
      </div>
      <div className={state.sound ? 'rm-head snd-music' : 'rm-head snd-music is-off'}>
        <div>
          <h3>{t('sound.music')}</h3>
          <p className="rm-muted">{t('sound.musicBody')}</p>
        </div>
        <Switch on={state.sound && state.music} label={t('sound.music')} onClick={toggleMusic} disabled={!state.sound} />
      </div>
    </section>
  );
}
