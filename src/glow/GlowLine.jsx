import { useEffect, useRef } from 'react';
import { CountUp } from '../sensory/celebrate';
import { bnDigits } from '../loop/strings';
import { useI18n } from '../i18n';
import { levelFor } from './glow';
import { useGlow } from './store';
import { useGlowT } from './strings';
import './glow.css';

// One quiet line on Today: lifetime Glow, the level, today's gain, and a calm
// streak note when it is true (yesterday was a rest day, or tonight matters).
// The full Glow bar and the 14-day strip come with the Memory map (wave 3b).
export default function GlowLine({ streak = null }) {
  const t = useGlowT();
  const { lang } = useI18n();
  const { total, today } = useGlow();
  const { level } = levelFor(total);
  // The total counts up from where it was, silently, when Glow lands.
  const before = useRef(total);
  const from = before.current;

  useEffect(() => {
    before.current = total;
  }, [total]);
  const format = lang === 'bn' ? bnDigits : undefined;
  const yesterday = streak?.days?.[streak.days.length - 2];
  const note = streak?.atRisk ? t('streak.atRisk') : yesterday?.state === 'rest' && streak.current > 0 ? t('streak.rest.today') : '';

  return (
    <div className="mq-glow-today">
      <p className="mq-glow-line" title={t('glow.promise')}>
        <span>
          {t('glow.label')} <b><CountUp value={total} from={from} sound={false} format={format} /></b>
        </span>
        <span>· {t(`glow.level.${level}`)}</span>
        {today > 0 && <span>· {t('glow.today', { n: today })}</span>}
      </p>
      {note && <p className="mq-glow-note">{note}</p>}
    </div>
  );
}
