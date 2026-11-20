// Runs in Twitch's own page (MAIN world), the only place that can reach its player.
// It answers the content script's requests: it reads the player for the video stats and sets its
// volume for the mouse wheel.
import { STATS_REPLY, STATS_REQUEST, type StatsReply } from '../shared/player-stats';
import { SET_VOLUME, type SetVolume } from '../shared/volume';
import { findPlayer, readStats } from './player';

window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  const data = e.data as Partial<SetVolume> | { type?: unknown } | null;
  if (data?.type === STATS_REQUEST) {
    const reply: StatsReply = { type: STATS_REPLY, stats: readStats(findPlayer()) };
    window.postMessage(reply, location.origin);
  } else if (data?.type === SET_VOLUME) {
    setVolume(data as Partial<SetVolume>);
  }
});

function setVolume({ volume, muted }: Partial<SetVolume>): void {
  if (typeof volume !== 'number' || !(volume >= 0 && volume <= 1) || typeof muted !== 'boolean') return;
  try {
    const player = findPlayer();
    if (!player) return;
    player.setVolume(volume);
    player.setMuted(muted);
    saveVolume(volume, muted);
  } catch {
    // Twitch changed its player: leave the volume alone rather than break the page.
  }
}

/** Saves the volume where Twitch's own slider and mute button do, so it is kept on reload. */
export function saveVolume(volume: number, muted: boolean): void {
  localStorage.setItem('volume', String(volume));
  const stored = JSON.parse(localStorage.getItem('video-muted') ?? '{}') as unknown;
  const flags = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  if (flags.default !== muted) localStorage.setItem('video-muted', JSON.stringify({ ...flags, default: muted }));
}
