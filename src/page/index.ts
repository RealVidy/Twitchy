// Runs in Twitch's own page (MAIN world), the only place that can reach its player.
// It answers the content script's requests: it reads the player for the video stats, sets its
// volume for the mouse wheel, keeps the volume saved for each channel, mutes or unmutes it on a
// click, mutes it while a sidebar preview plays and tells sidebar previews whether the user has it
// muted.
import { STATS_REPLY, STATS_REQUEST, type StatsReply } from '../shared/player-stats';
import {
  CHANNEL_VOLUME,
  CHANNEL_VOLUME_CHANGED,
  HOLD_MUTE,
  isChannelVolume,
  MUTE_TOGGLED,
  SET_VOLUME,
  STREAM_SOUND,
  STREAM_SOUND_REQUEST,
  TOGGLE_MUTE,
  type ChannelVolume,
  type ChannelVolumeChanged,
  type HoldMute,
  type MuteToggled,
  type SetVolume,
  type StreamSound,
} from '../shared/volume';
import { createChannelVolume, createMuteHold, findPlayer, readStats, streamSound, toggleMute } from './player';

const holdMute = createMuteHold();
const channelVolume = createChannelVolume(
  findPlayer,
  (login, volume) => {
    const report: ChannelVolumeChanged = { type: CHANNEL_VOLUME_CHANGED, login, volume };
    window.postMessage(report, location.origin);
  },
  // Where Twitch keeps its volume, so a new player or a reload starts at it.
  (volume) => localStorage.setItem('volume', String(volume)),
);
// Media events don't bubble, but they reach the document while it captures them.
for (const type of ['volumechange', 'loadstart', 'playing']) {
  document.addEventListener(type, () => channelVolume.update(), true);
}

window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  const data = e.data as Partial<SetVolume> | { type?: unknown } | null;
  if (data?.type === STATS_REQUEST) {
    const reply: StatsReply = { type: STATS_REPLY, stats: readStats(findPlayer()) };
    window.postMessage(reply, location.origin);
  } else if (data?.type === SET_VOLUME) {
    setVolume(data as Partial<SetVolume>);
  } else if (data?.type === TOGGLE_MUTE) {
    const state = toggleMute(findPlayer());
    if (!state) return;
    saveMuted(state.muted);
    const reply: MuteToggled = { type: MUTE_TOGGLED, ...state };
    window.postMessage(reply, location.origin);
  } else if (data?.type === HOLD_MUTE) {
    const { held } = data as Partial<HoldMute>;
    if (typeof held === 'boolean') holdMute.set(held);
  } else if (data?.type === CHANNEL_VOLUME) {
    const { login, volume } = data as Partial<ChannelVolume>;
    if (login !== null && typeof login !== 'string') return;
    channelVolume.set(login ?? null, isChannelVolume(volume) ? volume : null);
  } else if (data?.type === STREAM_SOUND_REQUEST) {
    const reply: StreamSound = { type: STREAM_SOUND, sound: streamSound(findPlayer(), holdMute.holding()) };
    window.postMessage(reply, location.origin);
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
  saveMuted(muted);
}

/** Saves the muted state where Twitch's mute button does, so it is kept on reload. */
export function saveMuted(muted: boolean): void {
  const stored = JSON.parse(localStorage.getItem('video-muted') ?? '{}') as unknown;
  const flags = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  if (flags.default !== muted) localStorage.setItem('video-muted', JSON.stringify({ ...flags, default: muted }));
}
