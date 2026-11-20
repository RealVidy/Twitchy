import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addPreview,
  installSidebarPeek,
  installSidebarPreviews,
  PEEK_CLASS,
  previewUrl,
  sideNavLogin,
} from '../src/content/sidebar';

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

const preview = () => document.querySelector<HTMLImageElement>('.twitchy-side-preview');

/**
 * Records the listeners an install adds to the document, <html> and window and takes them away
 * after each test, so the sidebar code of earlier tests no longer reacts.
 */
function isolateListeners(): void {
  const added: [EventTarget, string, EventListenerOrEventListenerObject][] = [];
  beforeEach(() => {
    for (const target of [document, document.documentElement, window] as EventTarget[]) {
      const original = target.addEventListener.bind(target);
      vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
        if (listener) added.push([target, type, listener]);
        original(type, listener, options);
      });
    }
  });
  afterEach(() => {
    for (const [target, type, listener] of added.splice(0)) target.removeEventListener(type, listener);
    vi.restoreAllMocks();
  });
}

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
    expect(addPreview(tooltip, 'florence', NOW)).toBe(true);
    expect(tooltip.firstElementChild).toBe(preview());
    expect(preview()!.getAttribute('src')).toBe(previewUrl('florence', NOW));

    expect(addPreview(tooltip, 'zerator', NOW)).toBe(false);
    expect(tooltip.querySelectorAll('.twitchy-side-preview')).toHaveLength(1);
    expect(preview()!.getAttribute('src')).toBe(previewUrl('zerator', NOW));
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
    enabled = true;
    previews = installSidebarPreviews(() => enabled);
  });

  it('adds the thumbnail of the hovered channel when Twitch opens its tooltip', async () => {
    hover(document.querySelector('img[alt="florence"]')!);
    openTooltip();
    await vi.waitFor(() => expect(preview()?.src).toContain('live_user_florence-'));
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
