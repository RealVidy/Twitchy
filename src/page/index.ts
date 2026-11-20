// Runs in Twitch's own page (MAIN world), the only place that can reach its player.
// It answers the content script's requests by reading the player; it never changes it.
import { STATS_REPLY, STATS_REQUEST, type StatsReply } from '../shared/player-stats';
import { findPlayer, readStats } from './player';

window.addEventListener('message', (e) => {
  if (e.source !== window || (e.data as { type?: unknown } | null)?.type !== STATS_REQUEST) return;
  const reply: StatsReply = { type: STATS_REPLY, stats: readStats(findPlayer()) };
  window.postMessage(reply, location.origin);
});
