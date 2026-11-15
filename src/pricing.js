// Prices in one place, for the browser and the server (api/_payments.js).
// Pure functions: no React, no network.

import { PRO } from './proConfig.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const launchEnds = () => new Date(PRO.launch?.endsAt || 0);

export const launchActive = (now = new Date()) => now.getTime() <= launchEnds().getTime();

// What this plan costs right now: { now, was } where `was` is the crossed-out
// regular price during the launch offer (null when there is no offer).
export function priceOf(offer, now = new Date()) {
  const regular = Number(offer.regular) || Number(offer.price);

  if (launchActive(now) && Number(offer.price) < regular) return { now: Number(offer.price), was: regular };

  return { now: regular, was: null };
}

export const percentOff = (offer, now = new Date()) => {
  const { now: price, was } = priceOf(offer, now);

  return was ? Math.round((1 - price / was) * 100) : 0;
};

export const taka = (amount) => `৳${Number(amount).toLocaleString('en-US')}`;

// Whole days left in the launch offer (0 when it has ended).
export const launchDaysLeft = (now = new Date()) => Math.max(0, Math.ceil((launchEnds().getTime() - now.getTime()) / DAY_MS));

// Which plan a payment of `amount` taka buys: the longest plan whose price at
// that moment it covers. Payments made up to a day after the offer ends still
// get the launch price, so nobody loses out to a slow SMS.
export function offerForAmount(amount, paidAt = new Date()) {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) return null;

  const graceful = new Date(Math.min(paidAt.getTime(), paidAt.getTime() - DAY_MS));
  const priceAt = (offer) => Math.min(priceOf(offer, paidAt).now, priceOf(offer, graceful).now);
  const fits = PRO.offers.filter((offer) => value + 0.001 >= priceAt(offer));

  if (fits.length === 0) return null;

  return fits.reduce((best, offer) => (offer.days > best.days ? offer : best));
}
