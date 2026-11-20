import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findPlayer, readStats, type IvsPlayer } from '../src/page/player';
import { findStatsAnchor, installVideoStats, renderStats } from '../src/content/video-stats';
import { formatStats, STATS_REPLY, STATS_REQUEST, type PlayerStats } from '../src/shared/player-stats';

const STATS: PlayerStats = {
  latency: 3.527,
  width: 1280,
  height: 720,
  framerate: 60,
  bitrate: 1992324,
  buffer: 2.31,
  droppedFrames: 2,
  decodedFrames: 421,
  protocol: 'HLS',
};

/** The row under the player, trimmed: viewer count, then uptime. */
const ROW = `
  <div class="row">
    <div class="item"><strong data-a-target="animated-channel-viewers-count">5,440</strong></div>
    <div class="item"><span class="live-time"><span aria-hidden="true">5:53:44</span></span></div>
  </div>`;

function fakePlayer(overrides: Partial<IvsPlayer> = {}): IvsPlayer {
  return {
    setVolume: () => {},
    setMuted: () => {},
    getState: () => 'Playing',
    isPaused: () => false,
    getLiveLatency: () => 3.527,
    getVideoWidth: () => 1280,
    getVideoHeight: () => 720,
    getQuality: () => ({ framerate: 60 }),
    getVideoBitRate: () => 1992324,
    getBufferDuration: () => 2.31,
    getDroppedFrames: () => 2,
    getDecodedFrames: () => 421,
    getProtocol: () => 'HLS',
    ...overrides,
  };
}

describe('formatStats', () => {
  it('gives a short line and a detailed tooltip', () => {
    const { text, title } = formatStats(STATS);
    expect(text).toBe('Latency 3.5s · 720p60 · 2.0 Mb/s');
    expect(title).toContain('Latency to broadcaster: 3.53 s');
    expect(title).toContain('Resolution: 1280×720 at 60 fps');
    expect(title).toContain('Dropped frames: 2 of 421');
  });

  it('shows low bitrates in kb/s and leaves out what is unknown', () => {
    expect(formatStats({ ...STATS, bitrate: 630000, height: 360, framerate: 0 }).text).toBe(
      'Latency 3.5s · 360p · 630 kb/s',
    );
    expect(formatStats({ ...STATS, bitrate: 0, height: 0 }).text).toBe('Latency 3.5s');
  });
});

describe('findPlayer and readStats', () => {
  it('finds the player in the React props above the video element', () => {
    document.body.innerHTML = '<div data-a-target="video-player"></div>';
    const player = fakePlayer();
    const parent = { return: null, memoizedProps: { mediaPlayerInstance: player } };
    const fiber = { return: { return: parent, memoizedProps: {} }, memoizedProps: { className: 'x' } };
    Object.assign(document.querySelector('[data-a-target="video-player"]')!, { __reactFiber$abc: fiber });
    expect(findPlayer()).toBe(player);
  });

  it('finds nothing without the element or its React props', () => {
    document.body.innerHTML = '';
    expect(findPlayer()).toBeNull();
    document.body.innerHTML = '<div data-a-target="video-player"></div>';
    expect(findPlayer()).toBeNull();
  });

  it('reads the numbers only while the stream plays', () => {
    expect(readStats(fakePlayer())).toEqual(STATS);
    expect(readStats(fakePlayer({ isPaused: () => true }))).toBeNull();
    expect(readStats(fakePlayer({ getState: () => 'Idle' }))).toBeNull();
    expect(readStats(fakePlayer({ getLiveLatency: () => { throw new Error('gone'); } }))).toBeNull();
    expect(readStats(null)).toBeNull();
  });
});

describe('renderStats', () => {
  beforeEach(() => {
    document.body.innerHTML = ROW;
  });

  it('goes right after the uptime, with the same spacing class', () => {
    renderStats(STATS);
    const el = document.querySelector<HTMLElement>('.twitchy-video-stats')!;
    expect(el.previousElementSibling).toBe(findStatsAnchor());
    expect(el.classList.contains('item')).toBe(true);
    expect(el.textContent).toBe('Latency 3.5s · 720p60 · 2.0 Mb/s');
    expect(el.title).toContain('Buffer: 2.3 s');
  });

  it('updates in place and goes away without stats', () => {
    renderStats(STATS);
    renderStats({ ...STATS, latency: 1.2 });
    expect(document.querySelectorAll('.twitchy-video-stats')).toHaveLength(1);
    expect(document.querySelector('.twitchy-video-stats')!.textContent).toMatch(/^Latency 1\.2s/);
    renderStats(null);
    expect(document.querySelector('.twitchy-video-stats')).toBeNull();
  });

  it('shows nothing off a live stream, where there is no uptime', () => {
    document.body.innerHTML = '<div class="row"></div>';
    renderStats(STATS);
    expect(document.querySelector('.twitchy-video-stats')).toBeNull();
  });
});

describe('installVideoStats', () => {
  let enabled: boolean;
  let responder: (e: MessageEvent) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = ROW;
    enabled = true;
    // Stands in for the page script: answers each request with the player's stats.
    responder = (e) => {
      if (e.data?.type === STATS_REQUEST) window.postMessage({ type: STATS_REPLY, stats: STATS }, '*');
    };
    window.addEventListener('message', responder);
  });

  afterEach(() => {
    window.removeEventListener('message', responder);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // jsdom leaves MessageEvent.source null; deliver right away with the window as source, like a browser.
  function deliverMessages(): void {
    vi.spyOn(window, 'postMessage').mockImplementation((data: unknown) => {
      window.dispatchEvent(new MessageEvent('message', { data, source: window }));
    });
  }

  it('asks for stats and shows the answer', () => {
    deliverMessages();
    installVideoStats(() => enabled);
    expect(document.querySelector('.twitchy-video-stats')?.textContent).toBe('Latency 3.5s · 720p60 · 2.0 Mb/s');
  });

  it('takes the stats away once turned off', () => {
    deliverMessages();
    const stats = installVideoStats(() => enabled);
    enabled = false;
    stats.check();
    expect(document.querySelector('.twitchy-video-stats')).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(document.querySelector('.twitchy-video-stats')).toBeNull();
  });

  it('ignores replies that do not come from this window', () => {
    installVideoStats(() => enabled);
    window.dispatchEvent(new MessageEvent('message', { data: { type: STATS_REPLY, stats: STATS }, source: null }));
    expect(document.querySelector('.twitchy-video-stats')).toBeNull();
  });
});
