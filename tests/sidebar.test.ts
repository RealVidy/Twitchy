import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addPreview,
  EMBED_NAMESPACE,
  EMBED_ORIGIN,
  EMBED_SET_MUTED,
  EMBED_SET_VOLUME,
  embedUrl,
  installSidebarPeek,
  installSidebarPreviews,
  PEEK_CLASS,
  TOOLTIP_GONE,
  previewUrl,
  sideNavLogin,
} from '../src/content/sidebar';
import { PREVIEW_FRAME_NAME } from '../src/embed/embedded';
import type { PreviewSound } from '../src/shared/settings';
import { HOLD_MUTE, savedVolume, STREAM_SOUND, STREAM_SOUND_REQUEST } from '../src/shared/volume';
import { isolateListeners } from './helpers';

/** Twitch's sidebar, trimmed: a collapsed card is an avatar in a link to the channel. */
const SIDEBAR = `
  <div class="side-nav side-nav--collapsed">
    <button data-a-target="side-nav-arrow" aria-label="Expand Side Nav"></button>
    <div class="side-nav-section" aria-label="Followed Channels">
      <div class="side-nav-card"><a class="side-nav-card" href="/florence"><img alt="florence"></a></div>
      <div class="side-nav-card"><a class="side-nav-card" href="/ZeratoR"><img alt="ZeratoR"></a></div>
    </div>
  </div>
  <main><img class="category"></main>`;

/** The tooltip Twitch opens in a dialog layer next to a live channel. */
const TOOLTIP = `
  <div class="ReactModal__Content" role="dialog"><div data-popper-placement="right-start">
    <div class="online-side-nav-channel-tooltip__body">
      <p>Florence · Horses of Hoofprint Bay</p>
      <p>ce soir Floflo passion poney</p>
      <div><div class="tw-channel-status-indicator"></div><span>Live | 1.7K viewers</span></div>
    </div>
  </div></div>`;

const NOW = Date.UTC(2026, 10, 21, 12, 0, 30);

function hover(el: Element): void {
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
}

function openTooltip(): HTMLElement {
  document.body.insertAdjacentHTML('beforeend', TOOLTIP);
  return document.querySelector('.online-side-nav-channel-tooltip__body')!;
}

const box = () => document.querySelector<HTMLElement>('.twitchy-side-preview');
const preview = () => document.querySelector<HTMLImageElement>('.twitchy-side-preview > img');
const frame = () => document.querySelector<HTMLIFrameElement>('.twitchy-side-preview > iframe');

describe('previewUrl', () => {
  it("points at Twitch's live thumbnail and changes every minute", () => {
    expect(previewUrl('florence', NOW)).toBe(
      `https://static-cdn.jtvnw.net/previews-ttv/live_user_florence-440x248.jpg?t=${Math.floor(NOW / 60000)}`,
    );
    expect(previewUrl('florence', NOW + 20_000)).toBe(previewUrl('florence', NOW));
    expect(previewUrl('florence', NOW + 60_000)).not.toBe(previewUrl('florence', NOW));
  });
});

describe('sideNavLogin', () => {
  beforeEach(() => {
    document.body.innerHTML = SIDEBAR;
  });

  it('reads the channel from the card the pointer is on', () => {
    expect(sideNavLogin(document.querySelector('img[alt="florence"]'))).toBe('florence');
    expect(sideNavLogin(document.querySelector('a[href="/ZeratoR"]'))).toBe('zerator');
  });

  it('gives nothing outside the cards or outside the sidebar', () => {
    expect(sideNavLogin(document.querySelector('.side-nav-section'))).toBeNull();
    expect(sideNavLogin(document.querySelector('main img'))).toBeNull();
    expect(sideNavLogin(null)).toBeNull();
    document.body.innerHTML = '<div class="side-nav-card"><a href="/florence">x</a></div>';
    expect(sideNavLogin(document.querySelector('a'))).toBeNull();
  });
});

describe('addPreview', () => {
  it('puts one thumbnail at the top of the tooltip and keeps it up to date', () => {
    document.body.innerHTML = '';
    const tooltip = openTooltip();
    expect(addPreview(tooltip, 'florence', null, NOW)).toBe(true);
    expect(tooltip.firstElementChild).toBe(box());
    expect(preview()!.getAttribute('src')).toBe(previewUrl('florence', NOW));

    expect(addPreview(tooltip, 'zerator', null, NOW)).toBe(false);
    expect(tooltip.querySelectorAll('.twitchy-side-preview')).toHaveLength(1);
    expect(preview()!.getAttribute('src')).toBe(previewUrl('zerator', NOW));
    expect(frame()).toBeNull();
  });

  it("puts Twitch's player over the thumbnail, loading it again only for another channel", () => {
    document.body.innerHTML = '';
    localStorage.clear();
    const tooltip = openTooltip();
    addPreview(tooltip, 'florence', { muted: false }, NOW);
    expect(frame()!.src).toBe(embedUrl('florence', false));
    expect(frame()!.allow).toBe('autoplay');
    expect(frame()!.name).toBe(PREVIEW_FRAME_NAME);
    box()!.classList.add('twitchy-side-preview--playing');

    addPreview(tooltip, 'florence', { muted: false }, NOW + 60_000);
    expect(box()!.classList.contains('twitchy-side-preview--playing')).toBe(true);

    addPreview(tooltip, 'zerator', { muted: true }, NOW);
    expect(tooltip.querySelectorAll('iframe')).toHaveLength(1);
    expect(frame()!.src).toBe(embedUrl('zerator', true));
    expect(box()!.classList.contains('twitchy-side-preview--playing')).toBe(false);

    addPreview(tooltip, 'zerator', null, NOW);
    expect(frame()).toBeNull();
  });
});

describe('embedUrl', () => {
  it("asks for the channel's stream, playing at once, without controls", () => {
    const url = new URL(embedUrl('florence', true, 'www.twitch.tv'));
    expect(url.origin).toBe(EMBED_ORIGIN);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      channel: 'florence',
      parent: 'www.twitch.tv',
      autoplay: 'true',
      muted: 'true',
      controls: 'false',
    });
  });
});

describe('savedVolume', () => {
  const storage = (items: Record<string, string>) => ({ getItem: (k: string) => items[k] ?? null });

  it('reads the volume and mute Twitch saved', () => {
    expect(savedVolume(storage({ volume: '0.8', 'video-muted': '{"default":true}' }))).toEqual({
      volume: 0.8,
      muted: true,
    });
    expect(savedVolume(storage({ volume: '0', 'video-muted': '{"default":false}' }))).toEqual({
      volume: 0,
      muted: false,
    });
  });

  it("falls back to Twitch's defaults when missing or broken", () => {
    expect(savedVolume(storage({}))).toEqual({ volume: 0.5, muted: false });
    expect(savedVolume(storage({ volume: 'loud', 'video-muted': '{' }))).toEqual({ volume: 0.5, muted: false });
    expect(savedVolume(storage({ volume: '3', 'video-muted': 'null' }))).toEqual({ volume: 0.5, muted: false });
  });
});

describe('installSidebarPreviews', () => {
  let enabled: boolean;
  let previews: { check: () => void };

  isolateListeners();

  beforeEach(() => {
    // A fresh body, so the observers installed by earlier tests no longer see the page.
    document.body = document.createElement('body');
    document.body.innerHTML = SIDEBAR;
    document.documentElement.classList.remove(TOOLTIP_GONE);
    enabled = true;
    previews = installSidebarPreviews(() => enabled, () => false, () => 'on');
  });

  it('adds the thumbnail of the hovered channel when Twitch opens its tooltip', async () => {
    hover(document.querySelector('img[alt="florence"]')!);
    openTooltip();
    await vi.waitFor(() => expect(preview()?.src).toContain('live_user_florence-'));
  });

  it('adds it to the tooltip of channels streaming together too', async () => {
    hover(document.querySelector('img[alt="florence"]')!);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div role="dialog"><div class="side-nav-guest-star-tooltip__body"><p>Florence</p></div></div>',
    );
    await vi.waitFor(() => expect(preview()?.src).toContain('live_user_florence-'));
  });

  it('hides the tooltip and its preview as soon as the pointer leaves the card', async () => {
    const root = document.documentElement;
    hover(document.querySelector('img[alt="florence"]')!);
    const tooltip = openTooltip();
    await vi.waitFor(() => expect(preview()).not.toBeNull());
    expect(root.classList.contains(TOOLTIP_GONE)).toBe(false);

    // Even into the tooltip, which Twitch would keep open.
    hover(tooltip.querySelector('p')!);
    expect(root.classList.contains(TOOLTIP_GONE)).toBe(true);
    expect(preview()).toBeNull();

    hover(document.querySelector('img[alt="ZeratoR"]')!);
    expect(root.classList.contains(TOOLTIP_GONE)).toBe(false);
    expect(preview()!.src).toContain('live_user_zerator-');
  });

  it('hides them when the pointer leaves the window from the card', async () => {
    const root = document.documentElement;
    hover(document.querySelector('img[alt="florence"]')!);
    root.dispatchEvent(new MouseEvent('mouseleave'));
    expect(root.classList.contains(TOOLTIP_GONE)).toBe(true);
    // Twitch opens its tooltip late, after the pointer has gone.
    openTooltip();
    await Promise.resolve();
    expect(preview()).toBeNull();

    hover(document.querySelector('img[alt="florence"]')!);
    expect(root.classList.contains(TOOLTIP_GONE)).toBe(false);
    expect(preview()!.src).toContain('live_user_florence-');
  });

  it('leaves the tooltip to Twitch while turned off', () => {
    enabled = false;
    hover(document.querySelector('img[alt="florence"]')!);
    hover(document.querySelector('main img')!);
    expect(document.documentElement.classList.contains(TOOLTIP_GONE)).toBe(false);
  });

  it('follows the pointer to the next channel', async () => {
    hover(document.querySelector('img[alt="florence"]')!);
    openTooltip();
    await vi.waitFor(() => expect(preview()).not.toBeNull());
    hover(document.querySelector('img[alt="ZeratoR"]')!);
    expect(preview()!.src).toContain('live_user_zerator-');
  });

  it('keeps the channel when Twitch moves the focus into its tooltip', async () => {
    hover(document.querySelector('img[alt="florence"]')!);
    const tooltip = openTooltip();
    tooltip.closest('.ReactModal__Content')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await vi.waitFor(() => expect(preview()?.src).toContain('live_user_florence-'));
  });

  it('works with the keyboard too', async () => {
    document.querySelector('a[href="/ZeratoR"]')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    openTooltip();
    await vi.waitFor(() => expect(preview()?.src).toContain('live_user_zerator-'));
  });

  it('adds nothing for tooltips that are not about a sidebar channel', async () => {
    hover(document.querySelector('main img')!);
    openTooltip();
    await Promise.resolve();
    expect(preview()).toBeNull();
  });

  it('adds nothing while turned off and takes the thumbnail away once turned off', async () => {
    enabled = false;
    hover(document.querySelector('img[alt="florence"]')!);
    openTooltip();
    await Promise.resolve();
    expect(preview()).toBeNull();

    enabled = true;
    previews.check();
    expect(preview()).not.toBeNull();
    enabled = false;
    previews.check();
    expect(preview()).toBeNull();
  });

  it("asks Twitch to place the tooltip again when the thumbnail pushes it off the screen", async () => {
    const resized = vi.fn();
    window.addEventListener('resize', resized);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: window.innerHeight + 100,
    } as DOMRect);
    hover(document.querySelector('img[alt="florence"]')!);
    openTooltip();
    await vi.waitFor(() => expect(resized).toHaveBeenCalledTimes(1));
    // Only once: a second look finds the thumbnail already there.
    previews.check();
    expect(resized).toHaveBeenCalledTimes(1);
    window.removeEventListener('resize', resized);
  });
});

describe('installSidebarPreviews with the stream playing', () => {
  let video: boolean;
  let sound: PreviewSound;
  let previews: { check: () => void };
  let sent: unknown[];
  /** The volumes saved for each channel. */
  let saved: Record<string, number>;

  isolateListeners();

  beforeEach(() => {
    document.body = document.createElement('body');
    document.body.innerHTML = SIDEBAR;
    localStorage.clear();
    localStorage.setItem('volume', '0.8');
    history.replaceState(null, '', '/');
    video = true;
    sound = 'stream';
    sent = [];
    saved = {};
    // Stands in for the page script, which mutes the stream for HOLD_MUTE.
    window.addEventListener('message', (e) => {
      if ((e.data as { type?: unknown } | null)?.type === HOLD_MUTE) sent.push(e.data);
    });
    previews = installSidebarPreviews(() => true, () => video, () => sound, {
      peek: (login) => saved[login] ?? null,
      load: async () => {},
    });
  });

  // window.postMessage delivers later: let a test's messages arrive before the next one listens.
  afterEach(() => new Promise((resolve) => setTimeout(resolve, 0)));

  /** What the embed tells the page as it loads and plays. */
  function report(params: Record<string, unknown>, from: Window | null = frame()!.contentWindow): void {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: EMBED_ORIGIN,
        source: from,
        data: { eventName: 'UPDATE_STATE', params, namespace: EMBED_NAMESPACE },
      }),
    );
  }

  async function openFor(login: string): Promise<HTMLIFrameElement> {
    hover(document.querySelector(`img[alt="${login}"]`)!);
    openTooltip();
    await vi.waitFor(() => expect(frame()).not.toBeNull());
    return frame()!;
  }

  const playing = () => box()!.classList.contains('twitchy-side-preview--playing');
  const held = (on: boolean) => ({ type: HOLD_MUTE, held: on });

  it('shows the stream once it plays and mutes the one being watched meanwhile', async () => {
    const iframe = await openFor('florence');
    expect(iframe.src).toBe(embedUrl('florence', false));
    report({ playback: 'Buffering', muted: false, volume: 0.8 });
    expect(playing()).toBe(false);
    await Promise.resolve();
    expect(sent).toEqual([]);

    report({ playback: 'Playing', muted: false, volume: 0.8 });
    expect(playing()).toBe(true);
    await vi.waitFor(() => expect(sent).toEqual([held(true)]));

    // The preview goes as soon as the pointer leaves the card, before Twitch closes its tooltip.
    hover(document.querySelector('main img')!);
    expect(frame()).toBeNull();
    await vi.waitFor(() => expect(sent).toEqual([held(true), held(false)]));
  });

  it("plays at the volume the user picked on Twitch's player", async () => {
    const iframe = await openFor('florence');
    const post = vi.spyOn(iframe.contentWindow!, 'postMessage');
    report({ playback: 'Idle', muted: false, volume: 0.5 });
    expect(post).toHaveBeenCalledWith(
      { eventName: EMBED_SET_VOLUME, params: 0.8, namespace: EMBED_NAMESPACE },
      EMBED_ORIGIN,
    );
    post.mockClear();
    report({ playback: 'Playing', muted: false, volume: 0.8 });
    expect(post).not.toHaveBeenCalled();
  });

  it('plays at the volume saved for its channel, muted or not as the stream being watched is', async () => {
    saved = { florence: 0.3 };
    const iframe = await openFor('florence');
    const post = vi.spyOn(iframe.contentWindow!, 'postMessage');
    report({ playback: 'Idle', muted: false, volume: 0.5 });
    expect(post).toHaveBeenCalledWith(
      { eventName: EMBED_SET_VOLUME, params: 0.3, namespace: EMBED_NAMESPACE },
      EMBED_ORIGIN,
    );
    expect(post).not.toHaveBeenCalledWith(expect.objectContaining({ eventName: EMBED_SET_MUTED }), EMBED_ORIGIN);
  });

  it('stays muted, and leaves the stream being watched alone, when Twitch is muted', async () => {
    localStorage.setItem('video-muted', '{"default":true}');
    const iframe = await openFor('florence');
    expect(iframe.src).toBe(embedUrl('florence', true));
    const post = vi.spyOn(iframe.contentWindow!, 'postMessage');
    report({ playback: 'Playing', muted: false, volume: 0.8 });
    expect(post).toHaveBeenCalledWith(
      { eventName: EMBED_SET_MUTED, params: true, namespace: EMBED_NAMESPACE },
      EMBED_ORIGIN,
    );
    expect(playing()).toBe(true);
    await Promise.resolve();
    expect(sent).toEqual([]);
  });

  it('leaves the stream being watched alone when the browser only lets the preview play muted', async () => {
    const iframe = await openFor('florence');
    const post = vi.spyOn(iframe.contentWindow!, 'postMessage');
    report({ playback: 'Playing', muted: true, volume: 0.8 });
    expect(playing()).toBe(true);
    // Unmuting it before a click in the page would make the browser pause it.
    expect(post).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(sent).toEqual([]);
  });

  it('gives the preview its sound once the user clicked in the page', async () => {
    Object.defineProperty(navigator, 'userActivation', { value: { hasBeenActive: true }, configurable: true });
    try {
      const iframe = await openFor('florence');
      const post = vi.spyOn(iframe.contentWindow!, 'postMessage');
      report({ playback: 'Buffering', muted: true, volume: 0.8 });
      expect(post).not.toHaveBeenCalled();
      report({ playback: 'Playing', muted: true, volume: 0.8 });
      expect(post).toHaveBeenCalledWith(
        { eventName: EMBED_SET_MUTED, params: false, namespace: EMBED_NAMESPACE },
        EMBED_ORIGIN,
      );
      report({ playback: 'Playing', muted: false, volume: 0.8 });
      await vi.waitFor(() => expect(sent).toEqual([held(true)]));
    } finally {
      delete (navigator as { userActivation?: unknown }).userActivation;
    }
  });

  /** Stands in for the page script, which says how the user has the stream in the page. */
  function streamIs(sound: { muted: boolean; volume: number } | null): () => number {
    let asked = 0;
    window.addEventListener('message', (e) => {
      if ((e.data as { type?: unknown } | null)?.type !== STREAM_SOUND_REQUEST) return;
      asked++;
      window.dispatchEvent(new MessageEvent('message', { data: { type: STREAM_SOUND, sound }, source: window }));
    });
    return () => asked;
  }

  async function openAfterAnswer(login: string, asked: () => number): Promise<HTMLIFrameElement> {
    hover(document.querySelector(`img[alt="${login}"]`)!);
    // Twitch opens its tooltip a moment after the pointer reaches the card.
    await vi.waitFor(() => expect(asked()).toBe(1));
    openTooltip();
    await vi.waitFor(() => expect(frame()).not.toBeNull());
    return frame()!;
  }

  it("plays with the sound of the stream in the page, even when Twitch's saved setting is muted", async () => {
    // As when the user muted Twitch in another tab.
    localStorage.setItem('video-muted', '{"default":true}');
    const iframe = await openAfterAnswer('florence', streamIs({ muted: false, volume: 0.3 }));
    expect(iframe.src).toBe(embedUrl('florence', false));
    const post = vi.spyOn(iframe.contentWindow!, 'postMessage');
    report({ playback: 'Playing', muted: false, volume: 0.8 });
    expect(post).toHaveBeenCalledWith(
      { eventName: EMBED_SET_VOLUME, params: 0.3, namespace: EMBED_NAMESPACE },
      EMBED_ORIGIN,
    );
    expect(post).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(sent).toEqual([held(true)]));
  });

  it('stays muted while the stream in the page plays muted', async () => {
    const iframe = await openAfterAnswer('florence', streamIs({ muted: true, volume: 0.8 }));
    expect(iframe.src).toBe(embedUrl('florence', true));
    const post = vi.spyOn(iframe.contentWindow!, 'postMessage');
    report({ playback: 'Playing', muted: false, volume: 0.8 });
    expect(post).toHaveBeenCalledWith(
      { eventName: EMBED_SET_MUTED, params: true, namespace: EMBED_NAMESPACE },
      EMBED_ORIGIN,
    );
    await Promise.resolve();
    expect(sent).toEqual([]);
  });

  it('plays with sound when set to, even while the stream in the page is muted', async () => {
    sound = 'on';
    const iframe = await openAfterAnswer('florence', streamIs({ muted: true, volume: 0.3 }));
    expect(iframe.src).toBe(embedUrl('florence', false));
    const post = vi.spyOn(iframe.contentWindow!, 'postMessage');
    report({ playback: 'Playing', muted: false, volume: 0.8 });
    // At the volume the stream keeps while muted.
    expect(post).toHaveBeenCalledWith(
      { eventName: EMBED_SET_VOLUME, params: 0.3, namespace: EMBED_NAMESPACE },
      EMBED_ORIGIN,
    );
    expect(post).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(sent).toEqual([held(true)]));
  });

  it('stays muted when set to, and leaves the stream in the page alone', async () => {
    sound = 'off';
    Object.defineProperty(navigator, 'userActivation', { value: { hasBeenActive: true }, configurable: true });
    try {
      const iframe = await openAfterAnswer('florence', streamIs({ muted: false, volume: 0.8 }));
      expect(iframe.src).toBe(embedUrl('florence', true));
      const post = vi.spyOn(iframe.contentWindow!, 'postMessage');
      report({ playback: 'Playing', muted: true, volume: 0.8 });
      expect(post).not.toHaveBeenCalled();
      report({ playback: 'Playing', muted: false, volume: 0.8 });
      expect(post).toHaveBeenCalledWith(
        { eventName: EMBED_SET_MUTED, params: true, namespace: EMBED_NAMESPACE },
        EMBED_ORIGIN,
      );
      await Promise.resolve();
      expect(sent).toEqual([]);
    } finally {
      delete (navigator as { userActivation?: unknown }).userActivation;
    }
  });

  it("follows Twitch's saved setting when no stream plays in the page", async () => {
    localStorage.setItem('video-muted', '{"default":true}');
    const iframe = await openAfterAnswer('florence', streamIs(null));
    expect(iframe.src).toBe(embedUrl('florence', true));
  });

  it('ignores messages that are not from its player', async () => {
    await openFor('florence');
    report({ playback: 'Playing', muted: false, volume: 0.8 }, window);
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://example.com',
        source: frame()!.contentWindow,
        data: { eventName: 'UPDATE_STATE', params: { playback: 'Playing' }, namespace: EMBED_NAMESPACE },
      }),
    );
    expect(playing()).toBe(false);
  });

  it('shows only the thumbnail for the channel already playing in the page', async () => {
    history.replaceState(null, '', '/florence');
    hover(document.querySelector('img[alt="florence"]')!);
    openTooltip();
    await vi.waitFor(() => expect(preview()).not.toBeNull());
    expect(frame()).toBeNull();
    history.replaceState(null, '', '/');
  });

  it('stops the stream and gives the sound back when the video is turned off', async () => {
    await openFor('florence');
    report({ playback: 'Playing', muted: false, volume: 0.8 });
    video = false;
    previews.check();
    expect(frame()).toBeNull();
    expect(preview()).not.toBeNull();
    await vi.waitFor(() => expect(sent.at(-1)).toEqual(held(false)));
  });
});

describe('installSidebarPeek', () => {
  let enabled: boolean;
  let peek: { check: () => void };
  let nav: HTMLElement;
  let toggle: HTMLButtonElement;
  let clicks: number;

  isolateListeners();

  beforeEach(() => {
    vi.useFakeTimers();
    document.body = document.createElement('body');
    document.documentElement.classList.remove(PEEK_CLASS);
    document.body.innerHTML = SIDEBAR;
    nav = document.querySelector('.side-nav')!;
    toggle = document.querySelector('[data-a-target="side-nav-arrow"]')!;
    clicks = 0;
    // Stands in for Twitch: the toggle flips the sidebar between collapsed and expanded.
    toggle.addEventListener('click', () => {
      clicks++;
      nav.classList.toggle('side-nav--collapsed');
      nav.classList.toggle('side-nav--expanded');
    });
    enabled = true;
    peek = installSidebarPeek(() => enabled);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const expanded = () => nav.classList.contains('side-nav--expanded');
  const peeking = () => document.documentElement.classList.contains(PEEK_CLASS);

  it('opens the collapsed sidebar once the pointer rests on it, over the page', () => {
    hover(document.querySelector('img[alt="florence"]')!);
    vi.advanceTimersByTime(299);
    expect(expanded()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(expanded()).toBe(true);
    expect(peeking()).toBe(true);
  });

  it('collapses it again when the pointer leaves', () => {
    hover(nav);
    vi.advanceTimersByTime(300);
    hover(document.querySelector('main img')!);
    vi.advanceTimersByTime(200);
    expect(expanded()).toBe(false);
    expect(peeking()).toBe(true); // until Twitch has drawn the collapsed sidebar
    vi.advanceTimersByTime(50);
    expect(peeking()).toBe(false);
    expect(clicks).toBe(2);
  });

  it('collapses it when the pointer leaves the window', () => {
    hover(nav);
    vi.advanceTimersByTime(300);
    document.documentElement.dispatchEvent(new MouseEvent('mouseleave'));
    vi.runAllTimers();
    expect(expanded()).toBe(false);
  });

  it('does not open for a pointer just passing over', () => {
    hover(nav);
    vi.advanceTimersByTime(150);
    hover(document.querySelector('main img')!);
    vi.runAllTimers();
    expect(clicks).toBe(0);
  });

  it('stays open while the pointer comes back quickly', () => {
    hover(nav);
    vi.advanceTimersByTime(300);
    hover(document.querySelector('main img')!);
    vi.advanceTimersByTime(100);
    hover(document.querySelector('img[alt="ZeratoR"]')!);
    vi.runAllTimers();
    expect(expanded()).toBe(true);
    expect(clicks).toBe(1);
  });

  it('leaves a sidebar the user expanded alone', () => {
    toggle.click();
    clicks = 0;
    hover(nav);
    vi.advanceTimersByTime(300);
    hover(document.querySelector('main img')!);
    vi.runAllTimers();
    expect(expanded()).toBe(true);
    expect(clicks).toBe(0);
  });

  it('does nothing when Twitch offers no toggle, in a narrow window', () => {
    toggle.remove();
    hover(nav);
    vi.runAllTimers();
    expect(expanded()).toBe(false);
    expect(peeking()).toBe(false);
  });

  it('does not click again when the user collapsed it with the toggle', () => {
    hover(nav);
    vi.advanceTimersByTime(300);
    toggle.click();
    hover(document.querySelector('main img')!);
    vi.runAllTimers();
    expect(expanded()).toBe(false);
    expect(clicks).toBe(2);
  });

  it('stays off while turned off and collapses when turned off', () => {
    enabled = false;
    hover(nav);
    vi.runAllTimers();
    expect(clicks).toBe(0);

    hover(document.querySelector('main img')!);
    enabled = true;
    hover(nav);
    vi.advanceTimersByTime(300);
    expect(expanded()).toBe(true);
    enabled = false;
    peek.check();
    vi.runAllTimers();
    expect(expanded()).toBe(false);
    expect(peeking()).toBe(false);
  });

  it('collapses it when the page goes away, so Twitch remembers it collapsed', () => {
    hover(nav);
    vi.advanceTimersByTime(300);
    window.dispatchEvent(new Event('pagehide'));
    expect(expanded()).toBe(false);
  });
});
