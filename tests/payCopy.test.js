import { describe, expect, it } from 'vitest';
import { methodLabel, methodLabelIn, parentShareText, payMethods, payText, whatsappShareUrl } from '../src/pro/payCopy.js';
import { PRO } from '../src/proConfig.js';

const BKASH = { bkash: '01800000000', nagad: '' };
const BOTH = { bkash: '01800000000', nagad: '01900000000' };
const NAGAD = { bkash: '', nagad: '01900000000' };

describe('payment copy follows the configured numbers', () => {
  it('lists only methods that have a number', () => {
    expect(payMethods(BKASH)).toEqual(['bkash']);
    expect(payMethods(BOTH)).toEqual(['bkash', 'nagad']);
    expect(payMethods({ bkash: '  ', nagad: '' })).toEqual([]);
  });

  it('says bKash only while Nagad is empty, and both once it is set', () => {
    expect(methodLabel(BKASH, 'en')).toBe('bKash');
    expect(methodLabel(BOTH, 'en')).toBe('bKash or Nagad');
    expect(methodLabel(NAGAD, 'en')).toBe('Nagad');
    expect(methodLabel(BKASH, 'bn')).toBe('বিকাশ');
    expect(methodLabel(BOTH, 'bn')).toBe('বিকাশ বা নগদ');
    expect(methodLabelIn(BKASH, 'bn')).toBe('বিকাশে');
    expect(methodLabelIn(BOTH, 'bn')).toBe('বিকাশ বা নগদে');
  });

  it('never mentions Nagad with the live config while its number is empty', () => {
    if (PRO.payment.nagad) return;

    for (const lang of ['en', 'bn']) {
      for (const key of ['landingPay', 'landingFaqA', 'payWith', 'stepOpen', 'last4Label', 'parentHint', 'timeout', 'pendingBody']) {
        const text = payText(PRO.payment, lang, key, { trx: 'X' });

        expect(text).not.toMatch(/nagad|নগদ/i);
      }
    }
  });

  it('describes the automatic TrxID flow, not access codes, on the landing FAQ', () => {
    const en = payText(BKASH, 'en', 'landingFaqA');

    expect(en).toContain('transaction ID');
    expect(en).toContain('automatically');
    expect(en).not.toMatch(/access code/i);
    expect(payText(BKASH, 'bn', 'landingFaqA')).toContain('বিকাশে Send Money');
  });

  it('timeout copy is honest: saved, completes by itself, echoes the TrxID', () => {
    const text = payText(BKASH, 'en', 'timeout', { trx: 'BKA1B2C3D4' });

    expect(text).toContain('BKA1B2C3D4');
    expect(text).toContain('by itself');
    expect(text).not.toMatch(/by hand/);
  });

  it('builds the parent message with launch and regular prices', () => {
    const text = parentShareText(BKASH, 'en', { plan: '4 months', price: '৳299', was: '৳599', endDate: '15 December 2026', number: '01800000000' });

    expect(text).toContain('৳299');
    expect(text).toContain('regular ৳599');
    expect(text).toContain('01800000000');
    expect(text).toContain('bKash');
    expect(text).not.toContain('{');

    const plain = parentShareText(BKASH, 'bn', { plan: '৪ মাস', price: '৳১৯৯', was: null, number: '01800000000' });

    expect(plain).not.toContain('নিয়মিত');
    expect(whatsappShareUrl('a b')).toBe('https://wa.me/?text=a%20b');
  });

  it('replaces the unproven "Most popular" tag', () => {
    expect(payText(BKASH, 'en', 'planTag')).toBe('Covers one full SAT prep');
  });
});
