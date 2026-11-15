// Automatic bKash / Nagad payments: reading the forwarded SMS and matching it
// to the TrxID a student typed (not a route: the leading underscore keeps
// Vercel from exposing this file). Database side: supabase/payments.sql.

import { offerForAmount } from '../src/pricing.js';
import { rest } from './_push.js';

// Senders whose SMS we trust. The forwarder app reports who sent the SMS;
// a message from an ordinary phone number is never treated as a payment.
const TRUSTED_SENDERS = [
  [/^bkash$/i, 'bkash'],
  [/^16247$/, 'bkash'],
  [/^nagad$/i, 'nagad'],
  [/^16167$/, 'nagad'],
];

export function senderMethod(from) {
  const name = String(from || '').trim();
  const hit = TRUSTED_SENDERS.find(([re]) => re.test(name));

  return hit ? hit[1] : null;
}

// Reads a "money received" SMS. Returns null for anything else (cash-in,
// payments you made, OTPs, offers...).
//   bKash: "You have received Tk 299.00 from 01712345678. Ref 1. Fee Tk 0.00. Balance Tk 1,234.00. TrxID BKA1B2C3D4 at 16/11/2026 10:30"
//   Nagad: "Money Received. Amount: Tk 299.00 Sender: 01712345678 Ref: N/A TxnID: 73ABCD12 Balance: Tk 600.00 16/11/2026 10:30"
export function parsePaymentSms(text, from) {
  const method = senderMethod(from);
  const body = String(text || '').replace(/\s+/g, ' ').trim();

  if (!method || !/\breceived\b/i.test(body) || /cash\s*in/i.test(body)) return null;

  const amount = /(?:Tk|BDT|৳)\.?\s*([\d,]+(?:\.\d{1,2})?)/i.exec(body);
  const trx = /(?:TrxID|TxnID|Trx\s*ID|Txn\s*ID|Transaction\s*ID)\s*[:.]?\s*([A-Z0-9]{6,20})\b/i.exec(body);
  const sender = /(?:from|sender)\s*:?\s*(\+?88)?(01\d{9})\b/i.exec(body);

  if (!amount || !trx) return null;

  const value = Number(amount[1].replace(/,/g, ''));

  if (!Number.isFinite(value) || value <= 0) return null;

  return {
    method,
    amount: value,
    trx_id: trx[1].toUpperCase(),
    sender: sender ? sender[2] : null,
    raw: body.slice(0, 600),
  };
}

async function rpc(cfg, name, args) {
  return rest(cfg, `rpc/${name}`, { method: 'POST', body: args, prefer: 'return=representation' });
}

// Tries to match one claim. Prices the payment from its amount on the server,
// so a student cannot choose a bigger plan than they paid for.
// -> the jsonb from match_payment, plus `offer` when a plan was matched.
export async function settleClaim(cfg, userId, trxId, last4) {
  let result = await rpc(cfg, 'match_payment', { p_user: userId, p_trx: trxId, p_last4: last4, p_days: null });

  if (result?.status === 'price') {
    const offer = offerForAmount(result.amount, new Date(result.received_at || Date.now()));

    result = await rpc(cfg, 'match_payment', { p_user: userId, p_trx: trxId, p_last4: last4, p_days: offer ? offer.days : 0 });

    if (offer) result = { ...result, offer: { id: offer.id, label: offer.label, days: offer.days } };
  }

  return result;
}

// Saves a payment SMS and completes any claims that were waiting for it.
export async function recordSms(cfg, payment) {
  await rest(cfg, 'payment_sms?on_conflict=trx_id', {
    method: 'POST',
    body: payment,
    prefer: 'resolution=ignore-duplicates,return=minimal',
  });

  const waiting = await rest(
    cfg,
    `payment_claims?select=user_id,sender_last4&trx_id=eq.${encodeURIComponent(payment.trx_id)}&status=eq.waiting&order=created_at.asc&limit=5`
  );
  const results = [];

  for (const claim of waiting) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await settleClaim(cfg, claim.user_id, payment.trx_id, claim.sender_last4).catch(() => null));
  }

  return results;
}

export function timingSafeEqual(a, b) {
  const x = String(a || '');
  const y = String(b || '');

  if (x.length !== y.length) return false;

  let diff = 0;

  for (let i = 0; i < x.length; i += 1) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);

  return diff === 0;
}
