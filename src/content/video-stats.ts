import { formatStats, STATS_REPLY, STATS_REQUEST, type StatsReply } from '../shared/player-stats';
import { SEL } from './selectors';

const CLASS = 'twitchy-video-stats';

/** The uptime item under the player ("5:53:44"); the stats go right after it. */
export function findStatsAnchor(root: ParentNode = document): HTMLElement | null {
  return root.querySelector(SEL.liveTime)?.parentElement ?? null;
}

/** Puts the stats after the uptime, or takes them away when there are none. */
export function renderStats(stats: StatsReply['stats'], root: ParentNode = document): void {
  const anchor = findStatsAnchor(root);
  let el = root.querySelector<HTMLElement>(`.${CLASS}`);
  if (!stats || !anchor) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    // Twitch's own spacing for the items in this row.
    el.className = `${anchor.className} ${CLASS}`;
  }
  if (el.previousElementSibling !== anchor) anchor.after(el);
  const { text, title } = formatStats(stats);
  if (el.textContent !== text) el.textContent = text;
  if (el.title !== title) el.title = title;
}

/**
 * Shows latency, quality and bitrate next to the viewer count and uptime, like 7TV and FFZ.
 * Asks the page script for fresh numbers every second while the tab is visible.
 */
export function installVideoStats(enabled: () => boolean): { check: () => void } {
  const active = () => enabled() && !document.hidden && findStatsAnchor() !== null;
  const check = () => {
    if (active()) window.postMessage({ type: STATS_REQUEST }, location.origin);
    else renderStats(null);
  };
  window.addEventListener('message', (e) => {
    const data = e.data as Partial<StatsReply> | null;
    if (e.source !== window || data?.type !== STATS_REPLY) return;
    renderStats(active() ? (data.stats ?? null) : null);
  });
  window.setInterval(check, 1000);
  check();
  return { check };
}
