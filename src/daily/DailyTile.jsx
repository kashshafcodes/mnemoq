import Jonaki from '../components/Jonaki';
import { MAX_SCORE, loadHistory, puzzleNumber, streakOf } from './calendar';
import './dailyTile.css';

// The Daily's doorway inside the app (Home page tile): a small piece of the
// night scene with Jonaki, today's status and the streak.

export function dailyStatus(now = new Date()) {
  const number = puzzleNumber(now);
  const history = loadHistory();

  return { number, today: history.plays[number] || null, streak: streakOf(history, number) };
}

// `streak`: the app's one streak (Home passes it); without it, this device's Daily days.
export default function DailyTile({ streak: appStreak = null }) {
  const status = dailyStatus();
  const { number, today } = status;
  const streak = appStreak ?? status.streak;

  return (
    <a className="mq-tile dly-tile" href="#/daily">
      <span className="dly-tile-sky" aria-hidden="true">
        {[12, 34, 58, 76, 88].map((left, i) => (
          <i key={left} style={{ left: `${left}%`, top: `${20 + ((i * 37) % 55)}%`, animationDelay: `${-i * 0.7}s` }} />
        ))}
      </span>
      <Jonaki mood={today ? 'sleep' : 'idle'} size={68} />
      <span className="dly-tile-text">
        <span className="dly-tile-kicker">Daily puzzle #{number}</span>
        <b>{today ? `Tonight: ${today.score}/${MAX_SCORE}` : 'Five lanterns are waiting'}</b>
        <small>
          {today
            ? `${streak > 1 ? `${streak}-day streak. ` : ''}Jonaki is resting. A new puzzle at midnight.`
            : `Five questions, the same for everyone, in English or Bangla.${streak ? ` Keep your ${streak}-day streak glowing.` : ''}`}
        </small>
      </span>
      <span className="mq-tile-arrow" aria-hidden="true">
        →
      </span>
    </a>
  );
}
