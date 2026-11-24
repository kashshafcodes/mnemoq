import { describe, expect, it } from 'vitest';
import { guessExam } from '../src/entryExam.js';
import { DEFAULT_SETTINGS } from '../src/reminders.js';

describe('smart defaults', () => {
  it('guesses the exam from the entry link', () => {
    expect(guessExam({ pathname: '/sat' })).toBe('sat');
    expect(guessExam({ pathname: '/NSU/' })).toBe('nsu');
    expect(guessExam({ pathname: '/', search: '?exam=brac' })).toBe('brac');
    expect(guessExam({ pathname: '/', search: '?utm_campaign=fb-sat-dec' })).toBe('sat');
    expect(guessExam({ pathname: '/daily', search: '?utm_campaign=saturday' })).toBe(null);
    expect(guessExam({ pathname: '/', search: '' })).toBe(null);
  });

  it('defaults new reminders to 19:00, quiet from 23:30', () => {
    expect(DEFAULT_SETTINGS.time).toBe('19:00');
    expect(DEFAULT_SETTINGS.quietStart).toBe('23:30');
    expect(DEFAULT_SETTINGS.enabled).toBe(false);
  });
});
