import { SEL } from '../content/selectors';
import type { PlayerStats } from '../shared/player-stats';
import type { Sound } from '../shared/volume';

/** The parts of Twitch's player (Amazon IVS) that we use. */
export interface IvsPlayer {
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  getVolume(): number;
  getState(): string;
  isPaused(): boolean;
  getLiveLatency(): number;
  getVideoWidth(): number;
  getVideoHeight(): number;
  getQuality(): { framerate?: number } | null;
  getVideoBitRate(): number;
  getBufferDuration(): number;
  getDroppedFrames(): number;
  getDecodedFrames(): number;
  getProtocol(): string;
}

type Fiber = { return: Fiber | null; memoizedProps?: Record<string, unknown> | null };

/** Twitch's player, found through the React props of the element that holds the video. */
export function findPlayer(root: ParentNode = document): IvsPlayer | null {
  const el = root.querySelector(SEL.videoPlayer);
  if (!el) return null;
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  let fiber = key ? ((el as unknown as Record<string, Fiber | undefined>)[key] ?? null) : null;
  for (let depth = 0; fiber && depth < 60; depth++, fiber = fiber.return) {
    const player = fiber.memoizedProps?.mediaPlayerInstance as IvsPlayer | undefined;
    if (player && typeof player.getLiveLatency === 'function') return player;
  }
  return null;
}

/** The player's numbers while a stream plays; null while paused, stopped or not found. */
export function readStats(player: IvsPlayer | null): PlayerStats | null {
  if (!player) return null;
  try {
    const state = player.getState();
    if (player.isPaused() || (state !== 'Playing' && state !== 'Buffering')) return null;
    return {
      latency: player.getLiveLatency() || 0,
      width: player.getVideoWidth() || 0,
      height: player.getVideoHeight() || 0,
      framerate: player.getQuality()?.framerate || 0,
      bitrate: player.getVideoBitRate() || 0,
      buffer: player.getBufferDuration() || 0,
      droppedFrames: player.getDroppedFrames() || 0,
      decodedFrames: player.getDecodedFrames() || 0,
      protocol: player.getProtocol() || '',
    };
  } catch {
    return null; // Twitch changed its player: show nothing rather than break the page
  }
}

/**
 * How the user has the stream while it plays, or null when no stream plays. A mute `held` for a
 * sidebar preview is ours, not the user's: the stream counts as unmuted then.
 */
export function streamSound(player: IvsPlayer | null, held: boolean): Sound | null {
  if (!player) return null;
  try {
    const state = player.getState();
    if (player.isPaused() || (state !== 'Playing' && state !== 'Buffering')) return null;
    const volume = player.getVolume();
    if (!(volume >= 0 && volume <= 1)) return null;
    return { muted: !held && player.isMuted(), volume };
  } catch {
    return null; // Twitch changed its player: let the caller fall back to Twitch's saved setting
  }
}

/**
 * Mutes the stream while a sidebar preview plays (`set(true)`), then unmutes it, but only if we
 * were the ones who muted it. The mute goes through the player, not Twitch's saved setting, so a
 * reload keeps the user's own choice. `holding()` says whether the stream is muted by us.
 */
export function createMuteHold(find: () => IvsPlayer | null = findPlayer): {
  set: (held: boolean) => void;
  holding: () => boolean;
} {
  let muted: IvsPlayer | null = null;
  const set = (held: boolean) => {
    try {
      if (held) {
        if (muted) return;
        const player = find();
        if (!player || player.isMuted()) return;
        player.setMuted(true);
        muted = player;
      } else if (muted) {
        const player = muted;
        muted = null;
        if (player.isMuted()) player.setMuted(false);
      }
    } catch {
      // Twitch changed its player: leave the sound alone rather than break the page.
    }
  };
  return { set, holding: () => muted !== null };
}

/**
 * Mutes the stream, or unmutes it at the volume it had, as Twitch's mute button does. Returns the
 * new state, or null when there is no player.
 */
export function toggleMute(player: IvsPlayer | null): { muted: boolean; volume: number } | null {
  if (!player) return null;
  try {
    player.setMuted(!player.isMuted());
    return { muted: player.isMuted(), volume: player.getVolume() };
  } catch {
    return null; // Twitch changed its player: leave the sound alone rather than break the page
  }
}

/**
 * Keeps Twitch's player at the volume saved for the channel playing, and reports the volume the
 * user picks for it. `set` gives the channel and its saved volume (null when none is: the player
 * keeps its own). The volume goes on each new player Twitch makes, before any change counts as the
 * user's; a channel without one keeps the player's volume, reported as its own. `update`, on the
 * video's events, reports changes; a muted or silent stream is not one, since muting is for all
 * channels.
 */
export function createChannelVolume(
  find: () => IvsPlayer | null,
  report: (login: string, volume: number) => void,
  save: (volume: number) => void,
): { set: (login: string | null, volume: number | null) => void; update: () => void } {
  let login: string | null = null;
  let volume: number | null = null;
  /** The player that has the channel's volume. */
  let applied: IvsPlayer | null = null;

  const apply = (player: IvsPlayer) => {
    try {
      if (volume !== null && Math.abs(player.getVolume() - volume) > 0.001) player.setVolume(volume);
      if (volume !== null) save(volume);
      applied = player;
    } catch {
      // Twitch changed its player: leave the volume alone rather than break the page.
    }
  };
  const update = () => {
    if (!login) return;
    const player = find();
    if (!player) return;
    if (player !== applied) {
      // A channel without a saved volume keeps the player's, which is saved below.
      const saved = volume !== null;
      apply(player);
      if (saved || applied !== player) return;
    }
    try {
      const now = player.getVolume();
      if (player.isMuted() || !(now > 0 && now <= 1) || now === volume) return;
      volume = now;
      report(login, now);
    } catch {
      // Twitch changed its player: report nothing.
    }
  };
  const set = (nextLogin: string | null, nextVolume: number | null) => {
    login = nextLogin;
    volume = nextVolume;
    applied = null;
    update();
  };
  return { set, update };
}
