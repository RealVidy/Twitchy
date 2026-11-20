import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VolumeBoost, type AudioContextLike, type BoostStorage } from '../src/content/volume';
import { MAX_LEVEL, normalizeBoost, SET_VOLUME, splitLevel, stepLevel } from '../src/shared/volume';
import { isolateListeners } from './helpers';

describe('stepLevel', () => {
  it('goes 5% at a time up to 100%, then 10% at a time', () => {
    expect(stepLevel(0.5, 1)).toBe(0.55);
    expect(stepLevel(0.98, 1)).toBe(1);
    expect(stepLevel(1, 1)).toBe(1.1);
    expect(stepLevel(1.5, -1)).toBe(1.4);
    expect(stepLevel(1.05, -1)).toBe(1);
    expect(stepLevel(1, -1)).toBe(0.95);
  });

  it('stops at silence and at the loudest boost', () => {
    expect(stepLevel(0.02, -1)).toBe(0);
    expect(stepLevel(0, -1)).toBe(0);
    expect(stepLevel(MAX_LEVEL, 1)).toBe(MAX_LEVEL);
  });

  it('does not pile up rounding errors', () => {
    let level = 0;
    for (let i = 0; i < 30; i++) level = stepLevel(level, 1);
    expect(level).toBe(2);
  });
});

describe('splitLevel and normalizeBoost', () => {
  it("puts up to 100% on Twitch's volume and the rest on our gain", () => {
    expect(splitLevel(0.4)).toEqual({ volume: 0.4, boost: 1 });
    expect(splitLevel(2.5)).toEqual({ volume: 1, boost: 2.5 });
  });

  it('reads stored boosts safely', () => {
    expect(normalizeBoost(1.5)).toBe(1.5);
    expect(normalizeBoost(undefined)).toBe(1);
    expect(normalizeBoost('loud')).toBe(1);
    expect(normalizeBoost(0.5)).toBe(1);
    expect(normalizeBoost(99)).toBe(MAX_LEVEL);
  });
});

/** The player, trimmed: Twitch's own video inside the element its React props hang on. */
const PLAYER = `
  <div data-a-target="video-player">
    <div class="video-player__overlay">
      <div role="menu" data-a-target="player-settings-menu"><button>Quality</button></div>
    </div>
    <video></video>
  </div>
  <div class="about">About the channel</div>`;

function fakeContext(state: AudioContextState = 'running') {
  const destination = {};
  const gain = { gain: { value: 1 }, connect: vi.fn(() => destination) };
  const source = { connect: vi.fn(() => gain) };
  const ctx = {
    state,
    resume: vi.fn(async () => {}),
    createMediaElementSource: vi.fn(() => source),
    createGain: vi.fn(() => gain),
    destination,
    onstatechange: null,
  };
  return { ctx: ctx as unknown as AudioContextLike & { state: AudioContextState }, gain, source };
}

function memoryStorage(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  const storage: BoostStorage = {
    get: async (key) => (key in data ? { [key]: data[key] } : {}),
    set: vi.fn(async (items) => void Object.assign(data, items)),
    remove: vi.fn(async (key) => void delete data[key]),
  };
  return { data, storage };
}

describe('VolumeBoost', () => {
  let enabled: boolean;
  let video: HTMLVideoElement;
  let posted: { volume: number; muted: boolean }[];

  isolateListeners();

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = PLAYER;
    video = document.querySelector('video')!;
    video.volume = 1;
    enabled = true;
    posted = [];
    // Stands in for the page script: Twitch's player sets the video's volume.
    vi.spyOn(window, 'postMessage').mockImplementation((data: unknown) => {
      const m = data as { type: string; volume: number; muted: boolean };
      if (m.type !== SET_VOLUME) return;
      posted.push({ volume: m.volume, muted: m.muted });
      video.volume = m.volume;
      video.muted = m.muted;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(initial: Record<string, unknown> = {}, context = fakeContext()) {
    const { data, storage } = memoryStorage(initial);
    const boost = new VolumeBoost(storage, () => enabled, () => context.ctx);
    boost.start();
    return { boost, data, storage, ...context };
  }

  /** One wheel notch over `target`; up is a negative deltaY, as in browsers. */
  function wheel(direction: 'up' | 'down', target: Element = video): WheelEvent {
    const e = new WheelEvent('wheel', { deltaY: direction === 'up' ? -100 : 100, bubbles: true, cancelable: true });
    target.dispatchEvent(e);
    // Far enough apart that each notch reads the volume Twitch applied.
    vi.advanceTimersByTime(500);
    return e;
  }

  const indicator = () => document.querySelector('.twitchy-volume');

  it("turns Twitch's volume up to 100% without Web Audio", async () => {
    const { boost, ctx } = setup();
    await boost.switchChannel('quiet');
    video.volume = 0.9;
    const e = wheel('up');
    expect(e.defaultPrevented).toBe(true);
    wheel('up');
    expect(posted).toEqual([
      { volume: 0.95, muted: false },
      { volume: 1, muted: false },
    ]);
    expect(ctx.createMediaElementSource).not.toHaveBeenCalled();
    expect(indicator()?.textContent).toBe('100%');
  });

  it('boosts past 100% with a gain and remembers it for the channel', async () => {
    const { boost, ctx, gain, data } = setup();
    await boost.switchChannel('quiet');
    wheel('up');
    wheel('up');
    expect(posted.at(-1)).toEqual({ volume: 1, muted: false });
    expect(ctx.createMediaElementSource).toHaveBeenCalledWith(video);
    expect(gain.gain.value).toBe(1.2);
    expect(data['boost:quiet']).toBe(1.2);
    expect(indicator()?.textContent).toBe('120%');
  });

  it('takes the boost back down, and forgets it once back at 100%', async () => {
    const { boost, gain, data, storage } = setup({ 'boost:quiet': 1.1 });
    await boost.switchChannel('quiet');
    expect(gain.gain.value).toBe(1.1);
    wheel('down');
    expect(gain.gain.value).toBe(1);
    expect(storage.remove).toHaveBeenCalledWith('boost:quiet');
    expect(data).toEqual({});
    wheel('down');
    expect(posted.at(-1)).toEqual({ volume: 0.95, muted: false });
  });

  it('applies the saved boost when coming back to a channel, and none on others', async () => {
    const { boost, gain } = setup({ 'boost:quiet': 2 });
    await boost.switchChannel('loud');
    expect(gain.gain.value).toBe(1);
    await boost.switchChannel('quiet');
    expect(gain.gain.value).toBe(2);
    await boost.switchChannel('loud');
    expect(gain.gain.value).toBe(1);
    // Off a channel page, e.g. in the mini player, the last channel's boost stays.
    await boost.switchChannel('quiet');
    await boost.switchChannel(null);
    expect(gain.gain.value).toBe(2);
  });

  it('counts fast notches before Twitch has applied the last one', async () => {
    const { boost, gain } = setup();
    await boost.switchChannel('quiet');
    vi.mocked(window.postMessage).mockImplementation(() => {}); // Twitch is slow: the volume stays for now
    for (let i = 0; i < 3; i++) {
      video.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
      vi.advanceTimersByTime(50);
    }
    expect(gain.gain.value).toBe(1.3);
  });

  it('counts each notch of a fast spin that comes as one event', async () => {
    const { boost } = setup();
    await boost.switchChannel('quiet');
    video.volume = 0.5;
    video.dispatchEvent(new WheelEvent('wheel', { deltaY: -300, bubbles: true, cancelable: true }));
    expect(posted).toEqual([{ volume: 0.65, muted: false }]);
  });

  it('adds small touchpad movements up to a notch', async () => {
    const { boost } = setup();
    await boost.switchChannel('quiet');
    video.volume = 0.5;
    for (let i = 0; i < 4; i++) {
      video.dispatchEvent(new WheelEvent('wheel', { deltaY: 20, bubbles: true, cancelable: true }));
    }
    expect(posted).toEqual([{ volume: 0.45, muted: false }]);
  });

  it('unmutes on the way up, where the volume was, and stays muted on the way down', async () => {
    const { boost } = setup();
    await boost.switchChannel('quiet');
    video.volume = 0.3;
    video.muted = true;
    wheel('down');
    expect(posted).toEqual([]);
    wheel('up');
    expect(posted).toEqual([{ volume: 0.3, muted: false }]);
  });

  it('leaves the wheel alone outside the player, in its menus and with Ctrl for zoom', async () => {
    const { boost } = setup();
    await boost.switchChannel('quiet');
    expect(wheel('up', document.querySelector('.about')!).defaultPrevented).toBe(false);
    expect(wheel('up', document.querySelector('[role="menu"] button')!).defaultPrevented).toBe(false);
    const zoom = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true });
    video.dispatchEvent(zoom);
    expect(zoom.defaultPrevented).toBe(false);
    expect(posted).toEqual([]);
  });

  it('does nothing while turned off and drops the boost', async () => {
    const { boost, gain } = setup({ 'boost:quiet': 2 });
    await boost.switchChannel('quiet');
    expect(gain.gain.value).toBe(2);
    enabled = false;
    boost.apply();
    expect(gain.gain.value).toBe(1);
    expect(wheel('up').defaultPrevented).toBe(false);
    enabled = true;
    boost.apply();
    expect(gain.gain.value).toBe(2);
  });

  it('waits for the browser to allow Web Audio, so the stream never goes silent', async () => {
    const context = fakeContext('suspended');
    const { boost, ctx, gain } = setup({}, context);
    await boost.switchChannel('quiet');
    wheel('up');
    expect(ctx.createMediaElementSource).not.toHaveBeenCalled();
    expect(indicator()?.textContent).toBe('110% · click the player to boost');

    // The user clicks: the browser lets the context run.
    ctx.resume = vi.fn(async () => {
      context.ctx.state = 'running';
      context.ctx.onstatechange?.call(context.ctx as unknown as AudioContext, new Event('statechange'));
    });
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await vi.waitFor(() => expect(ctx.createMediaElementSource).toHaveBeenCalledWith(video));
    expect(gain.gain.value).toBe(1.1);
  });

  it('gives up quietly on a video something else already routes', async () => {
    const context = fakeContext();
    context.ctx.createMediaElementSource = vi.fn(() => {
      throw new DOMException('already connected', 'InvalidStateError');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { boost } = setup({ 'boost:quiet': 2 }, context);
    await boost.switchChannel('quiet');
    vi.advanceTimersByTime(3000);
    expect(context.ctx.createMediaElementSource).toHaveBeenCalledTimes(1);
  });

  it('hides the indicator a moment after the wheel stops', async () => {
    const { boost } = setup();
    await boost.switchChannel('quiet');
    video.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
    expect(indicator()!.classList.contains('twitchy-volume--visible')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(indicator()!.classList.contains('twitchy-volume--visible')).toBe(false);
  });
});

describe('the page script', () => {
  it("sets Twitch's player volume when asked, and ignores bad requests", async () => {
    await import('../src/page/index');
    localStorage.clear();
    document.body.innerHTML = '<div data-a-target="video-player"></div>';
    const player = { setVolume: vi.fn(), setMuted: vi.fn(), getLiveLatency: () => 0 };
    const fiber = { return: null, memoizedProps: { mediaPlayerInstance: player } };
    Object.assign(document.querySelector('[data-a-target="video-player"]')!, { __reactFiber$abc: fiber });

    // jsdom leaves MessageEvent.source null; a browser gives the window.
    const send = (data: unknown) => window.dispatchEvent(new MessageEvent('message', { data, source: window }));
    send({ type: SET_VOLUME, volume: 0.6, muted: false });
    expect(player.setVolume).toHaveBeenCalledWith(0.6);
    expect(player.setMuted).toHaveBeenCalledWith(false);

    send({ type: SET_VOLUME, volume: 2, muted: false });
    send({ type: SET_VOLUME, volume: '1', muted: false });
    window.dispatchEvent(new MessageEvent('message', { data: { type: SET_VOLUME, volume: 0.1, muted: false } }));
    expect(player.setVolume).toHaveBeenCalledTimes(1);
  });

  it('saves the volume where Twitch does, keeping its other mute flags', async () => {
    const { saveVolume } = await import('../src/page/index');
    localStorage.clear();
    localStorage.setItem('video-muted', JSON.stringify({ default: true, other: 1 }));
    saveVolume(0.8, false);
    expect(localStorage.getItem('volume')).toBe('0.8');
    expect(JSON.parse(localStorage.getItem('video-muted')!)).toEqual({ default: false, other: 1 });
  });
});
