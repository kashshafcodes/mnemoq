import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePaymentSms, settleClaim } from '../api/_payments.js';
import smsHook, { signatureValid } from '../api/sms-hook.js';
import { offerForAmount, priceOf } from '../src/pricing.js';
import { PRO } from '../src/proConfig.js';

const BKASH = 'You have received Tk 299.00 from 01712345678. Ref 1. Fee Tk 0.00. Balance Tk 1,234.00. TrxID BKA1B2C3D4 at 16/11/2026 10:30';
const NAGAD = 'Money Received.\nAmount: Tk 1,199.00\nSender: 01898765432\nRef: N/A\nTxnID: 73ABCD12\nBalance: Tk 1,600.00\n16/11/2026 10:30';

describe('payment SMS', () => {
  it('reads bKash and Nagad "received" messages', () => {
    expect(parsePaymentSms(BKASH, 'bKash')).toMatchObject({ method: 'bkash', amount: 299, trx_id: 'BKA1B2C3D4', sender: '01712345678' });
    expect(parsePaymentSms(NAGAD, 'NAGAD')).toMatchObject({ method: 'nagad', amount: 1199, trx_id: '73ABCD12', sender: '01898765432' });
  });

  it('ignores fakes and other messages', () => {
    expect(parsePaymentSms(BKASH, '+8801711111111')).toBeNull(); // typed by a person
    expect(parsePaymentSms('Cash In Tk 500.00 from 01712345678 successful. TrxID ABCDEF123', 'bKash')).toBeNull();
    expect(parsePaymentSms('Your bKash OTP is 123456', 'bKash')).toBeNull();
    expect(parsePaymentSms('You have sent Tk 50.00 to 017... TrxID ZZZ999111', 'bKash')).toBeNull();
  });
});

describe('prices', () => {
  const launch = new Date('2026-11-20T00:00:00+06:00');
  const after = new Date('2027-01-05T00:00:00+06:00');

  it('crosses out the regular price only during the launch offer', () => {
    expect(priceOf(PRO.offers[0], launch)).toEqual({ now: 99, was: 199 });
    expect(priceOf(PRO.offers[0], after)).toEqual({ now: 199, was: null });
  });

  it('gives the plan the amount pays for, never more', () => {
    expect(offerForAmount(299, launch).days).toBe(120);
    expect(offerForAmount(298, launch).days).toBe(30);
    expect(offerForAmount(98, launch)).toBeNull();
    expect(offerForAmount(299, after).days).toBe(30);
    // A day of grace after the offer ends.
    expect(offerForAmount(299, new Date('2026-12-16T12:00:00+06:00')).days).toBe(120);
  });
});

describe('matching a claim', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('prices on the server from the amount received', async () => {
    const calls = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        const args = JSON.parse(init.body);

        calls.push(args);

        const body = args.p_days === null ? { ok: true, status: 'price', amount: 299, received_at: '2026-11-20T10:00:00+06:00' } : { ok: true, status: 'granted', days: args.p_days };

        return { ok: true, json: async () => body, headers: new Headers() };
      })
    );

    const result = await settleClaim({ url: 'https://db', key: 'k' }, 'user-1', 'BKA1B2C3D4', '5678');

    expect(calls[1].p_days).toBe(120);
    expect(result).toMatchObject({ status: 'granted', days: 120, offer: { id: 'season' } });
  });

  it('the SMS hook refuses callers without the secret', async () => {
    const res = { status: vi.fn(() => res), json: vi.fn(() => res), setHeader: vi.fn() };

    await smsHook({ method: 'POST', headers: { 'x-hook-secret': 'nope' }, body: { from: 'bKash', text: BKASH } }, res, { SMS_HOOK_SECRET: 'x'.repeat(24) });

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('iPhone forwarder app', () => {
  const secret = 's'.repeat(32);
  // The app's payload: sorted keys, signed with HMAC-SHA256.
  const payload = { message: BKASH, messageId: 'F8A7C2E1', receivedAt: '2026-11-16T03:14:15Z', sender: 'bKash' };
  const canonical = JSON.stringify(Object.fromEntries(Object.keys(payload).sort().map((k) => [k, payload[k]])));
  const hex = createHmac('sha256', secret).update(canonical).digest('hex');
  const b64 = createHmac('sha256', secret).update(canonical).digest('base64');

  it('accepts its signature in hex or base64', () => {
    expect(signatureValid({ 'x-signature': hex }, payload, null, secret)).toBe(true);
    expect(signatureValid({ 'x-webhook-signature': `sha256=${b64}` }, payload, null, secret)).toBe(true);
  });

  it('refuses a wrong or missing signature', () => {
    expect(signatureValid({ 'x-signature': hex.replace(/^./, '0') === hex ? hex.replace(/^./, '1') : hex.replace(/^./, '0') }, payload, null, secret)).toBe(false);
    expect(signatureValid({}, payload, null, secret)).toBe(false);
    expect(signatureValid({ 'x-signature': hex }, { ...payload, message: 'You have received Tk 599.00 ...' }, null, secret)).toBe(false);
  });

  it('reads its message and sender fields', () => {
    expect(parsePaymentSms(payload.message, payload.sender)).toMatchObject({ amount: 299, trx_id: 'BKA1B2C3D4' });
  });

  it('answers its test message with 200 and stores nothing', async () => {
    const res = { status: vi.fn(() => res), json: vi.fn(() => res), setHeader: vi.fn() };
    const test = { message: 'Your OTP is 482910.', messageId: 'x', receivedAt: '2026-04-22T03:14:15Z', sender: '+91 99999 12345' };
    const sig = createHmac('sha256', secret).update(JSON.stringify(Object.fromEntries(Object.keys(test).sort().map((k) => [k, test[k]])))).digest('hex');

    vi.stubGlobal('fetch', vi.fn());
    await smsHook({ method: 'POST', headers: { 'x-signature': sig }, body: test, query: {} }, res, {
      SMS_HOOK_SECRET: secret,
      SUPABASE_URL: 'https://db',
      SUPABASE_SERVICE_ROLE_KEY: 'k',
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({ ok: true, payment: false });
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('webhook setup problems are explained', () => {
  const run = async (req, env) => {
    const res = { status: vi.fn(() => res), json: vi.fn(() => res), setHeader: vi.fn() };

    await smsHook({ method: 'POST', query: {}, headers: {}, body: {}, ...req }, res, env);

    return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
  };
  const secret = 'k'.repeat(40);

  it('says when the server has no secret', async () => {
    expect((await run({}, {})).body.reason).toBe('server-secret-missing');
  });

  it('ignores a pasted line break after the secret', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const r = await run({ query: { key: secret }, body: { message: 'hi', sender: 'x' } }, { SMS_HOOK_SECRET: `${secret}\n`, SUPABASE_URL: 'https://db', SUPABASE_SERVICE_ROLE_KEY: 'k' });
    vi.unstubAllGlobals();

    expect(r.status).toBe(200);
  });

  it('says whether the key or the signature was wrong', async () => {
    expect((await run({ query: { key: 'wrong' } }, { SMS_HOOK_SECRET: secret })).body.reason).toBe('key-does-not-match');
    expect((await run({ headers: { 'x-signature': 'a'.repeat(64) } }, { SMS_HOOK_SECRET: secret })).body).toMatchObject({ reason: 'signature-does-not-match', signatureHeaders: ['x-signature'] });
    expect((await run({}, { SMS_HOOK_SECRET: secret })).body.reason).toBe('no-key-or-signature');
  });

  it('accepts timestamped signatures over the raw text', async () => {
    const raw = '{ "message": "hi",\n  "sender": "x" }';
    const sig = createHmac('sha256', secret).update(`1700000000.${raw}`).digest('hex');

    expect(signatureValid({ 'x-signature': `t=1700000000,v1=${sig}` }, JSON.parse(raw), raw, secret)).toBe(true);
  });
});

