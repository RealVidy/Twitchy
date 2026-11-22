import { PREVIEW_FRAME_NAME } from '../embed/embedded';
import {
  HOLD_MUTE,
  savedVolume,
  STREAM_SOUND,
  STREAM_SOUND_REQUEST,
  type HoldMute,
  type Sound,
  type StreamSound,
  type StreamSoundRequest,
} from '../shared/volume';
import { channelFromPath } from './channel';
import { SEL } from './selectors';

const PREVIEW = 'twitchy-side-preview';
/** On the preview once its stream plays: styles.css shows the video over the thumbnail. */
const PLAYING = `${PREVIEW}--playing`;
/** On <html> once the pointer left the sidebar card: styles.css hides Twitch's tooltip at once. */
export const TOOLTIP_GONE = 'twitchy-side-tooltip-gone';
/** On <html> while we hold the sidebar open: styles.css lays it over the page instead of beside it. */
export const PEEK_CLASS = 'twitchy-side-peek';

const PEEK_OPEN_DELAY = 300;
const PEEK_CLOSE_DELAY = 200;

/** Twitch's embeddable player, which plays a channel's stream in an iframe. */
export const EMBED_ORIGIN = 'https://player.twitch.tv';
/** How the embed and the page talk, as Twitch's own embed script does it. */
export const EMBED_NAMESPACE = 'twitch-embed-player-proxy';
export const EMBED_SET_MUTED = 10;
export const EMBED_SET_VOLUME = 11;

/** Twitch's live thumbnail for a channel. A new query each minute gets past the CDN's cached copy. */
export function previewUrl(login: string, now = Date.now()): string {
  return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}-440x248.jpg?t=${Math.floor(now / 60_000)}`;
}

/** Twitch's embedded player for a channel, playing at once, without its controls. */
export function embedUrl(login: string, muted: boolean, host = location.hostname): string {
  const params = new URLSearchParams({
    channel: login,
    parent: host,
    autoplay: 'true',
    muted: String(muted),
    controls: 'false',
  });
  return `${EMBED_ORIGIN}/?${params}`;
}

/** The channel of the sidebar card `target` is in, or null outside the sidebar's channel cards. */
export function sideNavLogin(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const link = target.closest<HTMLAnchorElement>(SEL.sideNavCardLink);
  if (!link?.closest(SEL.sideNav)) return null;
  return channelFromPath(new URL(link.getAttribute('href')!, location.origin).pathname);
}

/**
 * Puts the stream's thumbnail at the top of Twitch's sidebar tooltip, or updates the one there.
 * With `video`, Twitch's embedded player plays the stream over it, muted or not; the thumbnail
 * shows until the stream starts. Returns true when it added the preview, which makes the tooltip
 * taller.
 */
export function addPreview(
  tooltip: Element,
  login: string,
  video: { muted: boolean } | null,
  now = Date.now(),
): boolean {
  let box = tooltip.querySelector<HTMLElement>(`:scope > .${PREVIEW}`);
  const added = !box;
  if (!box) {
    // With styles.css's aspect-ratio, the tooltip has its final size before anything loads.
    box = document.createElement('div');
    box.className = PREVIEW;
    const img = document.createElement('img');
    img.alt = '';
    box.append(img);
    tooltip.prepend(box);
  }
  const img = box.querySelector('img')!;
  const src = previewUrl(login, now);
  if (img.getAttribute('src') !== src) img.src = src;

  let frame = box.querySelector('iframe');
  if (!video) {
    frame?.remove();
    box.classList.remove(PLAYING);
  } else if (frame?.dataset.login !== login) {
    if (!frame) {
      frame = document.createElement('iframe');
      frame.allow = 'autoplay';
      // Tells our script in the player to show the video alone.
      frame.name = PREVIEW_FRAME_NAME;
      frame.tabIndex = -1;
      frame.setAttribute('aria-hidden', 'true');
      box.append(frame);
    }
    frame.dataset.login = login;
    frame.removeAttribute('data-sound');
    frame.src = embedUrl(login, video.muted);
    box.classList.remove(PLAYING);
  }
  return added;
}

/** True once the user clicked or pressed a key in the page: the browser then lets previews play with sound. */
function pageWasActivated(): boolean {
  return navigator.userActivation?.hasBeenActive === true;
}

/**
 * Shows a preview of the stream in the tooltip Twitch opens over a live channel in the sidebar,
 * as other Twitch extensions do: its thumbnail, or with `video` the stream itself, with its sound.
 * The preview is muted, and plays at the volume, as the stream being watched is; without one, as
 * Twitch's saved setting says. While a preview plays with sound, the stream being watched is
 * muted. Twitch's tooltip does not say which channel it is for, so we remember the card under the
 * pointer (or keyboard focus) and only look for the tooltip while one is. For channels streaming
 * together, the preview is the channel of the card. When the pointer leaves the card, the tooltip
 * goes with its preview.
 */
export function installSidebarPreviews(enabled: () => boolean, video: () => boolean): { check: () => void } {
  const root = document.documentElement;
  let login: string | null = null;
  let holding = false;
  /** How the user has the stream in the page, from the page script; null when none plays. */
  let stream: Sound | null = null;
  /**
   * Twitch's saved setting can say muted while the stream in this tab plays with sound, e.g. when
   * the user muted Twitch in another tab: the stream in the page is what the preview should match.
   */
  const wanted = (): Sound => stream ?? savedVolume();
  /** The answer comes before Twitch opens its tooltip, a moment after the pointer reaches the card. */
  const askStream = () => {
    const message: StreamSoundRequest = { type: STREAM_SOUND_REQUEST };
    window.postMessage(message, location.origin);
  };
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const data = e.data as Partial<StreamSound> | null;
    if (data?.type !== STREAM_SOUND) return;
    const { muted, volume } = data.sound ?? {};
    const valid = typeof muted === 'boolean' && typeof volume === 'number' && volume >= 0 && volume <= 1;
    stream = valid ? { muted, volume } : null;
  });

  /** Mutes the stream being watched while a preview plays with sound, through the page script. */
  const syncMute = () => {
    const held = document.querySelector(`.${PLAYING} > iframe[data-sound]`) !== null;
    if (held === holding) return;
    holding = held;
    const message: HoldMute = { type: HOLD_MUTE, held };
    window.postMessage(message, location.origin);
  };

  const check = () => {
    // No need to play the channel already playing in the page.
    const withVideo = video() && login !== channelFromPath(location.pathname);
    for (const tooltip of document.querySelectorAll(SEL.sideNavTooltip)) {
      if (!login || !enabled()) {
        tooltip.querySelector(`:scope > .${PREVIEW}`)?.remove();
      } else if (
        addPreview(tooltip, login, withVideo ? { muted: wanted().muted } : null) &&
        tooltip.getBoundingClientRect().bottom > window.innerHeight
      ) {
        // Twitch placed the tooltip for its shorter size. Its positioning library moves it back
        // into view on resize.
        window.dispatchEvent(new Event('resize'));
      }
    }
    syncMute();
  };

  // The embed reports its state as it loads and plays.
  window.addEventListener('message', (e) => {
    if (e.origin !== EMBED_ORIGIN) return;
    const data = e.data as { namespace?: unknown; eventName?: unknown; params?: unknown } | null;
    if (data?.namespace !== EMBED_NAMESPACE || data.eventName !== 'UPDATE_STATE') return;
    const frame = [...document.querySelectorAll<HTMLIFrameElement>(`.${PREVIEW} > iframe`)].find(
      (f) => f.contentWindow === e.source,
    );
    if (!frame) return;
    const { playback, volume, muted } = (data.params ?? {}) as Record<string, unknown>;
    const want = wanted();
    const send = (eventName: number, params: unknown) =>
      frame.contentWindow?.postMessage({ eventName, params, namespace: EMBED_NAMESPACE }, EMBED_ORIGIN);
    // The embed keeps its own volume; play at the one the user picked on Twitch.
    if (typeof volume === 'number' && Math.abs(volume - want.volume) > 0.01) send(EMBED_SET_VOLUME, want.volume);
    if (muted === false && want.muted) send(EMBED_SET_MUTED, true);
    // Before any click or key press in the page, the browser may let the preview play only muted,
    // and would pause it if we unmuted it. After one, it lets the preview have its sound back.
    if (muted === true && !want.muted && playback === 'Playing' && pageWasActivated()) send(EMBED_SET_MUTED, false);
    if (typeof muted === 'boolean') frame.toggleAttribute('data-sound', !muted && !want.muted);
    if (playback === 'Playing') frame.parentElement?.classList.add(PLAYING);
    syncMute();
  });
  const pointAt = (target: EventTarget | null) => {
    const was = login;
    login = sideNavLogin(target);
    if (login && login !== was) askStream();
    // Twitch keeps its tooltip a moment after the pointer leaves the card, and as long as the
    // pointer is over it, in the way of the pointer. Hide it and stop the preview right away.
    root.classList.toggle(TOOLTIP_GONE, !login && enabled());
    if (login || was) check();
  };
  document.addEventListener('mouseover', (e) => pointAt(e.target));
  // Leaving the window from the card brings no mouseover elsewhere, and Twitch may still open
  // its tooltip after the pointer has gone.
  root.addEventListener('mouseleave', () => pointAt(null));
  // Twitch moves the focus into its tooltip when it opens, so only a card getting focus counts.
  document.addEventListener('focusin', (e) => {
    const focused = sideNavLogin(e.target);
    if (focused && focused !== login) askStream();
    login = focused ?? login;
    if (login) {
      root.classList.remove(TOOLTIP_GONE);
      check();
    }
  });
  // The tooltip opens a moment after the pointer lands on the card, and closes when it leaves:
  // the stream being watched gets its sound back then. No need to look otherwise.
  new MutationObserver(() => {
    if (login || holding) check();
  }).observe(document.body, { childList: true, subtree: true });
  return { check };
}

/**
 * Opens the collapsed sidebar while the pointer rests on it and collapses it again when the pointer
 * leaves, laid over the page so nothing moves. It uses Twitch's own toggle, so the sidebar shows
 * channel names, games and viewer counts; when the window is too narrow, Twitch has no toggle and
 * the sidebar stays as it is.
 */
export function installSidebarPeek(enabled: () => boolean): { check: () => void } {
  const root = document.documentElement;
  let inside = false;
  let peeking = false;
  let timer = 0;

  const toggle = () => document.querySelector<HTMLElement>(SEL.sideNavToggle);
  const isCollapsed = () => document.querySelector(SEL.sideNavCollapsed) !== null;

  const open = () => {
    timer = 0;
    const button = toggle();
    if (!inside || peeking || !enabled() || !isCollapsed() || !button) return;
    peeking = true;
    root.classList.add(PEEK_CLASS);
    // The collapsed card under the pointer is about to go without a mouseout, and Twitch would
    // keep its tooltip open over the expanded sidebar. Tell Twitch the pointer left it.
    document
      .querySelector(`${SEL.sideNav} ${SEL.sideNavCardLink}:hover`)
      ?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
    button.click();
  };
  const close = () => {
    timer = 0;
    if (!peeking) return;
    peeking = false;
    // The user may have collapsed it with the toggle already.
    if (!isCollapsed()) toggle()?.click();
    // Let Twitch draw the collapsed sidebar before the page takes its place back.
    window.setTimeout(() => {
      if (!peeking) root.classList.remove(PEEK_CLASS);
    }, 50);
  };
  const schedule = (fn: () => void, delay: number) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(fn, delay);
  };

  const move = (now: boolean) => {
    if (now === inside) return;
    inside = now;
    if (inside && !peeking) schedule(open, PEEK_OPEN_DELAY);
    else if (!inside && peeking) schedule(close, PEEK_CLOSE_DELAY);
    else {
      window.clearTimeout(timer);
      timer = 0;
    }
  };
  document.addEventListener('mouseover', (e) => {
    move(e.target instanceof Element && e.target.closest(SEL.sideNav) !== null);
  });
  root.addEventListener('mouseleave', () => move(false));
  // Leave Twitch's saved choice collapsed, as the user left it.
  window.addEventListener('pagehide', () => close());

  const check = () => {
    if (!enabled()) close();
  };
  return { check };
}
