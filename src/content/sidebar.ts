import { channelFromPath } from './channel';
import { SEL } from './selectors';

const PREVIEW = 'twitchy-side-preview';
/** On <html> while we hold the sidebar open: styles.css lays it over the page instead of beside it. */
export const PEEK_CLASS = 'twitchy-side-peek';

const PEEK_OPEN_DELAY = 300;
const PEEK_CLOSE_DELAY = 200;

/** Twitch's live thumbnail for a channel. A new query each minute gets past the CDN's cached copy. */
export function previewUrl(login: string, now = Date.now()): string {
  return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}-440x248.jpg?t=${Math.floor(now / 60_000)}`;
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
 * Returns true when it added one, which makes the tooltip taller.
 */
export function addPreview(tooltip: Element, login: string, now = Date.now()): boolean {
  let img = tooltip.querySelector<HTMLImageElement>(`:scope > .${PREVIEW}`);
  const added = !img;
  if (!img) {
    img = document.createElement('img');
    img.className = PREVIEW;
    img.alt = '';
    // With styles.css's aspect-ratio, the tooltip has its final size before the image loads.
    img.width = 440;
    img.height = 248;
    tooltip.prepend(img);
  }
  const src = previewUrl(login, now);
  if (img.getAttribute('src') !== src) img.src = src;
  return added;
}

/**
 * Shows the stream's thumbnail in the tooltip Twitch opens over a live channel in the sidebar,
 * as other Twitch extensions do. Twitch's tooltip does not say which channel it is for, so we remember the card
 * under the pointer (or keyboard focus) and only look for the tooltip while one is.
 */
export function installSidebarPreviews(enabled: () => boolean): { check: () => void } {
  let login: string | null = null;

  const check = () => {
    for (const tooltip of document.querySelectorAll(SEL.sideNavTooltip)) {
      if (!login || !enabled()) {
        tooltip.querySelector(`:scope > .${PREVIEW}`)?.remove();
      } else if (addPreview(tooltip, login) && tooltip.getBoundingClientRect().bottom > window.innerHeight) {
        // Twitch placed the tooltip for its shorter size. Its positioning library moves it back
        // into view on resize.
        window.dispatchEvent(new Event('resize'));
      }
    }
  };
  document.addEventListener('mouseover', (e) => {
    login = sideNavLogin(e.target);
    if (login) check();
  });
  // Twitch moves the focus into its tooltip when it opens, so only a card getting focus counts.
  document.addEventListener('focusin', (e) => {
    login = sideNavLogin(e.target) ?? login;
    if (login) check();
  });
  // The tooltip opens a moment after the pointer lands on the card. No need to look while none is.
  new MutationObserver(() => {
    if (login) check();
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
