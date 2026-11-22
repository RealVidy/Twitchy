import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChannelVolumes } from '../src/content/channel-volume';
import { CHANNEL_VOLUME, CHANNEL_VOLUME_CHANGED } from '../src/shared/volume';
import { isolateListeners } from './helpers';

function memoryStorage(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  const storage = {
    get: vi.fn(async (key: string) => (key in data ? { [key]: data[key] } : {})),
    set: vi.fn(async (items: Record<string, unknown>) => void Object.assign(data, items)),
  };
  return { data, storage };
}

describe('ChannelVolumes', () => {
  let enabled: boolean;
  let posted: unknown[];

  isolateListeners();

  beforeEach(() => {
    enabled = true;
    posted = [];
    vi.spyOn(window, 'postMessage').mockImplementation((data: unknown) => {
      if ((data as { type?: unknown }).type === CHANNEL_VOLUME) posted.push(data);
    });
  });

  function setup(initial: Record<string, unknown> = {}) {
    const { data, storage } = memoryStorage(initial);
    const volumes = new ChannelVolumes(storage, () => enabled);
    volumes.start();
    return { volumes, data, storage };
  }

  /** What the page script reports when the user turns the volume. */
  const report = (login: string, volume: unknown) =>
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: CHANNEL_VOLUME_CHANGED, login, volume }, source: window }),
    );
  const told = (login: string | null, volume: number | null) => ({ type: CHANNEL_VOLUME, login, volume });

  it("tells the page script the channel's saved volume, or that it has none", async () => {
    const { volumes } = setup({ 'volume:florence': 0.3 });
    await volumes.switchChannel('florence');
    await volumes.switchChannel('zerator');
    expect(posted).toEqual([told('florence', 0.3), told('zerator', null)]);
  });

  it('keeps the last channel off a channel page, and says it once', async () => {
    const { volumes } = setup({ 'volume:florence': 0.3 });
    await volumes.switchChannel('florence');
    await volumes.switchChannel(null);
    await volumes.check();
    expect(posted).toEqual([told('florence', 0.3)]);
  });

  it('saves the volume the user picks, and goes back to it', async () => {
    const { volumes, data } = setup();
    await volumes.switchChannel('florence');
    report('florence', 0.6);
    report('florence', 0);
    report('florence', 'loud');
    expect(data).toEqual({ 'volume:florence': 0.6 });
    expect(volumes.peek('florence')).toBe(0.6);
    await volumes.switchChannel('zerator');
    await volumes.switchChannel('florence');
    expect(posted.at(-1)).toEqual(told('florence', 0.6));
  });

  it('does nothing while turned off, and stops the page script when turned off', async () => {
    enabled = false;
    const { volumes, data } = setup({ 'volume:florence': 0.3 });
    await volumes.switchChannel('florence');
    report('florence', 0.6);
    expect(posted).toEqual([]);
    expect(data).toEqual({ 'volume:florence': 0.3 });
    expect(volumes.peek('florence')).toBeNull();

    enabled = true;
    await volumes.check();
    enabled = false;
    await volumes.check();
    expect(posted).toEqual([told('florence', 0.3), told(null, null)]);
  });

  it('loads each channel once, for sidebar previews', async () => {
    const { volumes, storage } = setup({ 'volume:florence': 0.3 });
    expect(volumes.peek('florence')).toBeUndefined();
    await Promise.all([volumes.load('florence'), volumes.load('florence')]);
    expect(volumes.peek('florence')).toBe(0.3);
    await volumes.load('zerator');
    expect(volumes.peek('zerator')).toBeNull();
    expect(storage.get).toHaveBeenCalledTimes(2);
  });
});
