// Helpers for the first-run "Exam Debrief" pilot and the Recovery Plan.
// Pure functions plus tiny localStorage helpers, so they are easy to test.

const DAY_MS = 24 * 60 * 60 * 1000;

export const PILOT_MIN_CARDS = 3;
export const PILOT_MAX_CARDS = 5;

// Checkpoints of the Recovery Plan, in days after the debrief.
export const CHECKPOINTS = [
  { key: 'today', days: 0, label: 'pilot.plan.today' },
  { key: 'd1', days: 1, label: 'pilot.plan.d1' },
  { key: 'd3', days: 3, label: 'pilot.plan.d3' },
  { key: 'd7', days: 7, label: 'pilot.plan.d7' },
  { key: 'd14', days: 14, label: 'pilot.plan.d14' },
];

export function planDates(startIso, examIso = null) {
  const start = new Date(startIso);
  const at = (days) => new Date(start.getTime() + days * DAY_MS);

  if (!examIso) {
    return CHECKPOINTS.map((checkpoint) => ({ ...checkpoint, date: at(checkpoint.days) }));
  }

  // Exam path: spaced checkpoints that finish BEFORE the exam, then a final
  // review the day before, then the exam itself.
  const examDays = Math.max(0, Math.ceil((new Date(examIso).getTime() - start.getTime()) / DAY_MS));
  const items = CHECKPOINTS.filter((c) => c.days === 0 || c.days < examDays - 1);

  if (examDays >= 2) items.push({ key: 'final', days: examDays - 1, label: 'pilot.plan.final' });
  items.push({ key: 'exam', days: examDays, label: 'pilot.plan.exam' });

  return items.map((item) => ({ ...item, date: at(item.days) }));
}

// Whole days from now until an exam date string ("YYYY-MM-DD"), never negative.
export function daysUntil(dateString, now = new Date()) {
  const exam = new Date(`${dateString}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.max(0, Math.round((exam.getTime() - today.getTime()) / DAY_MS));
}

// "Locked in": a gap of 7+ days between reviews, or marked mastered.
export function isLockedIn(card) {
  return Boolean(card && (card.mastered || (card.reviewIntervalDays || 0) >= 7));
}

// ---- Forgetting-curve toy ----
// A simple illustration: memory decays exponentially, and every review resets
// it to 100% and makes the next decay slower. Not real data.
const BASE_STABILITY_DAYS = 1.5;
const STABILITY_GROWTH = 2.2;

// A review helps most when memory has already faded a bit. Reviewing while it
// is still strong (spamming the button) barely lengthens the next gap.
const EARLY_RECALL_ABOVE = 0.85;
const EARLY_GROWTH = 1.1;

export function retentionAt(day, reviewDays) {
  const past = reviewDays.filter((r) => r <= day).sort((a, b) => a - b);
  let last = 0;
  let stability = BASE_STABILITY_DAYS;

  for (const reviewDay of past) {
    const before = Math.exp(-(reviewDay - last) / stability);

    stability *= before > EARLY_RECALL_ABOVE ? EARLY_GROWTH : STABILITY_GROWTH;
    last = reviewDay;
  }

  return Math.exp(-(day - last) / stability) * 100;
}

// ---- Saved state (one per account, on this device) ----
const key = (userId) => `mnemoq-pilot-${userId}`;

export function loadPilot(userId) {
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function savePilot(userId, state) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(state));
  } catch {
    // Not being able to remember is fine; the pilot just may show again.
  }
}
