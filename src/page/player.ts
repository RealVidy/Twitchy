import { SEL } from '../content/selectors';
import type { PlayerStats } from '../shared/player-stats';

/** The parts of Twitch's player (Amazon IVS) that we use. */
export interface IvsPlayer {
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
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
 * Mutes the stream while a sidebar preview plays, then unmutes it, but only if we were the ones
 * who muted it. The mute goes through the player, not Twitch's saved setting, so a reload keeps
 * the user's own choice.
 */
export function createMuteHold(find: () => IvsPlayer | null = findPlayer): (held: boolean) => void {
  let muted: IvsPlayer | null = null;
  return (held) => {
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
}
