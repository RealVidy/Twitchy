import { describe, expect, it, vi } from 'vitest';
import { EmoteUsage, type UsageStorage } from '../src/emotes/usage';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/shared/settings';

describe('normalizeSettings', () => {
  it('fills in defaults for missing or broken values', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ pickerEmotes: 'yes', pickerLimit: 'many' })).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values and clamps the limit', () => {
    expect(normalizeSettings({ pickerEmotes: false, hideLockedEmotes: false, pickerLimit: 2 })).toEqual(
      { ...DEFAULT_SETTINGS, pickerEmotes: false, hideLockedEmotes: false, pickerLimit: 6 },
    );
    expect(normalizeSettings({ pickerLimit: 99.6 }).pickerLimit).toBe(100);
    expect(normalizeSettings({ hideSendButton: false }).hideSendButton).toBe(false);
    expect(normalizeSettings({ messageHistory: false }).messageHistory).toBe(false);
    expect(normalizeSettings({ deletedMessages: 'faded' }).deletedMessages).toBe('faded');
    expect(normalizeSettings({ deletedMessages: 'bold' }).deletedMessages).toBe('strike');
    expect(normalizeSettings({ autoClaimPoints: false }).autoClaimPoints).toBe(false);
    expect(normalizeSettings({ skipContentWarning: false }).skipContentWarning).toBe(false);
  });

  it('shows only gift sub badges by default and keeps the badge choices made', () => {
    expect(DEFAULT_SETTINGS.badges).toEqual({
      giftSubs: true,
      drops: false,
      streaks: false,
      promotions: false,
      other: false,
      whispers: false,
    });
    const s = normalizeSettings({ badges: { giftSubs: false, whispers: true, streaks: 'yes', bogus: true } });
    expect(s.badges).toEqual({ ...DEFAULT_SETTINGS.badges, giftSubs: false, whispers: true });
  });
});

function memoryStorage(initial: Record<string, unknown> = {}) {
  const data = { ...initial };
  const storage: UsageStorage = {
    get: async (key) => (key in data ? { [key]: data[key] } : {}),
    set: vi.fn(async (items) => void Object.assign(data, items)),
  };
  return { data, storage };
}

describe('EmoteUsage', () => {
  it('counts each emote once per message, per channel', async () => {
    const { data, storage } = memoryStorage();
    const usage = new EmoteUsage(storage);
    await usage.switchChannel('a');
    usage.record(['KEKW', 'KEKW', 'Clap']);
    usage.record(['KEKW']);
    expect(usage.count('KEKW')).toBe(2);
    expect(usage.count('Clap')).toBe(1);

    await usage.switchChannel('b');
    expect(usage.count('KEKW')).toBe(0);
    await vi.waitFor(() => expect(data['usage:a']).toEqual({ KEKW: 2, Clap: 1 }));
  });

  it('picks up saved counts and adds what was seen while loading', async () => {
    const { storage } = memoryStorage({ 'usage:a': { KEKW: 10 } });
    const usage = new EmoteUsage(storage);
    const loading = usage.switchChannel('a');
    usage.record(['KEKW']);
    await loading;
    expect(usage.count('KEKW')).toBe(11);
  });

  it('does not save when nothing was counted', async () => {
    const { storage } = memoryStorage();
    const usage = new EmoteUsage(storage);
    await usage.switchChannel('a');
    await usage.flush();
    expect(storage.set).not.toHaveBeenCalled();
  });
});
