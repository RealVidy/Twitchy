import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installClickToMute } from '../src/content/click-mute';
import { toggleMute, type IvsPlayer } from '../src/page/player';
import { MUTE_TOGGLED, TOGGLE_MUTE } from '../src/shared/volume';
import { isolateListeners } from './helpers';

/** The player, trimmed: the layer over the video that Twitch listens to, and the controls. */
const PLAYER = `
  <div data-a-target="video-player">
    <video></video>
    <div data-a-target="player-overlay-click-handler"></div>
    <div data-a-target="player-controls"><button data-a-target="player-mute-unmute-button"></button></div>
  </div>
  <div class="about">About the channel</div>`;

describe('installClickToMute', () => {
  let enabled: boolean;
  let boost: number;
  let posted: unknown[];
  let twitchClicks: number;

  isolateListeners();

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = PLAYER;
    enabled = true;
    boost = 1;
    posted = [];
    twitchClicks = 0;
    // Stands in for Twitch's own click handler, which React runs from below the document.
    document.documentElement.addEventListener('click', () => twitchClicks++);
    vi.spyOn(window, 'postMessage').mockImplementation((data: unknown) => void posted.push(data));
    installClickToMute(() => enabled, () => boost);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const overlay = () => document.querySelector('[data-a-target="player-overlay-click-handler"]')!;
  const indicator = () => document.querySelector('.twitchy-volume');
  const click = (target: Element, init: MouseEventInit = {}) =>
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }));
  /** The page script's answer, as it comes back through window messages. */
  const reply = (muted: boolean, volume: number) =>
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: MUTE_TOGGLED, muted, volume }, source: window }),
    );

  it("asks the page script to toggle the sound and keeps the click from Twitch's handler", () => {
    click(overlay());
    expect(posted).toEqual([{ type: TOGGLE_MUTE }]);
    expect(twitchClicks).toBe(0);
  });

  it('shows the new state over the player, with the boost on top of the volume', () => {
    click(overlay());
    reply(true, 0.8);
    expect(indicator()?.textContent).toBe('Muted');
    boost = 1.5;
    click(overlay());
    reply(false, 1);
    expect(indicator()?.textContent).toBe('150%');
    expect(indicator()!.classList.contains('twitchy-volume--visible')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(indicator()!.classList.contains('twitchy-volume--visible')).toBe(false);
  });

  it('leaves the controls, the rest of the page and modified clicks alone', () => {
    click(document.querySelector('[data-a-target="player-mute-unmute-button"]')!);
    click(document.querySelector('.about')!);
    click(overlay(), { ctrlKey: true });
    click(overlay(), { button: 1 });
    expect(posted).toEqual([]);
    expect(twitchClicks).toBe(4);
  });

  it('only closes an open settings menu, which Twitch takes away before the click', () => {
    document.body.insertAdjacentHTML('beforeend', '<div role="menu"><div data-a-target="player-settings-menu"></div></div>');
    overlay().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    document.querySelector('[role="menu"]')!.remove();
    click(overlay());
    expect(posted).toEqual([]);
    expect(twitchClicks).toBe(1);

    // The next click, with the menu gone, mutes.
    overlay().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    click(overlay());
    expect(posted).toEqual([{ type: TOGGLE_MUTE }]);
  });

  it('does nothing while turned off', () => {
    enabled = false;
    click(overlay());
    reply(true, 1);
    expect(posted).toEqual([]);
    expect(indicator()).toBeNull();
  });
});

describe('toggleMute', () => {
  function fakePlayer(muted: boolean, volume = 0.7) {
    const player = {
      isMuted: () => muted,
      setMuted: vi.fn((m: boolean) => void (muted = m)),
      getVolume: () => volume,
    };
    return player as typeof player & IvsPlayer;
  }

  it('mutes, then unmutes at the volume Twitch kept', () => {
    const player = fakePlayer(false);
    expect(toggleMute(player)).toEqual({ muted: true, volume: 0.7 });
    expect(toggleMute(player)).toEqual({ muted: false, volume: 0.7 });
  });

  it('gives up quietly without a player or when Twitch changed it', () => {
    expect(toggleMute(null)).toBeNull();
    const broken = { isMuted: () => false, setMuted: () => {} } as unknown as IvsPlayer;
    expect(toggleMute(broken)).toBeNull();
  });
});

describe('the page script', () => {
  it('toggles the mute, saves it like Twitch does and answers with the new state', async () => {
    await import('../src/page/index');
    localStorage.clear();
    document.body.innerHTML = '<div data-a-target="video-player"></div>';
    let muted = false;
    const player = {
      setMuted: vi.fn((m: boolean) => void (muted = m)),
      isMuted: () => muted,
      getVolume: () => 0.4,
      getLiveLatency: () => 0,
    };
    const fiber = { return: null, memoizedProps: { mediaPlayerInstance: player } };
    Object.assign(document.querySelector('[data-a-target="video-player"]')!, { __reactFiber$abc: fiber });
    const answers: unknown[] = [];
    const post = vi.spyOn(window, 'postMessage').mockImplementation((data: unknown) => void answers.push(data));

    window.dispatchEvent(new MessageEvent('message', { data: { type: TOGGLE_MUTE }, source: window }));
    expect(muted).toBe(true);
    expect(JSON.parse(localStorage.getItem('video-muted')!)).toEqual({ default: true });
    expect(answers).toEqual([{ type: MUTE_TOGGLED, muted: true, volume: 0.4 }]);

    // From another window, e.g. an embedded frame: ignored.
    window.dispatchEvent(new MessageEvent('message', { data: { type: TOGGLE_MUTE } }));
    expect(muted).toBe(true);
    post.mockRestore();
  });
});
