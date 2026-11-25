// Snapped cards are first due tomorrow morning in Dhaka, not at once
// (owner's decision, 25 Nov), with "Try it now" one tap away.

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // Asia/Dhaka is UTC+6 all year

// When a snapped card is first due: tomorrow, 07:00 in Dhaka.
export function tomorrowMorningDhaka(now = new Date()) {
  const dhaka = new Date(new Date(now).getTime() + DHAKA_OFFSET_MS);

  return new Date(Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), dhaka.getUTCDate() + 1, 7) - DHAKA_OFFSET_MS);
}
