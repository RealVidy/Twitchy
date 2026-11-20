import { describe, expect, it } from 'vitest';
import { Completer, completions } from '../src/content/autocomplete';

const names = ['catJAM', 'KEKW', 'kekw', 'KEKWait', 'OMEGALUL'];

describe('completions', () => {
  it('matches the start of names, ignoring case', () => {
    expect(completions(names, 'ke')).toEqual(['KEKW', 'kekw', 'KEKWait']);
    expect(completions(names, 'LUL')).toEqual([]);
  });
});

describe('Completer', () => {
  it('cycles through matches on repeated Tab and wraps around', () => {
    const c = new Completer(() => names);
    expect(c.next('ke', false)).toBe('KEKW');
    expect(c.next('KEKW', false)).toBe('kekw');
    expect(c.next('kekw', false)).toBe('KEKWait');
    expect(c.next('KEKWait', false)).toBe('KEKW');
  });

  it('goes backwards with Shift+Tab', () => {
    const c = new Completer(() => names);
    expect(c.next('ke', true)).toBe('KEKWait');
    expect(c.next('KEKWait', true)).toBe('kekw');
  });

  it('starts over when the word is not the last completion', () => {
    const c = new Completer(() => names);
    c.next('ke', false);
    expect(c.next('cat', false)).toBe('catJAM');
  });

  it('starts over after a reset, completing the full name as a prefix', () => {
    const c = new Completer(() => names);
    c.next('ke', false);
    c.reset();
    expect(c.next('KEKW', false)).toBe('KEKW');
  });

  it('returns null when nothing matches', () => {
    expect(new Completer(() => names).next('zzz', false)).toBeNull();
  });
});
