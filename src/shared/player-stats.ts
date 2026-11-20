/** Messages between the content script and the page script that can reach Twitch's player. */
export const STATS_REQUEST = 'twitchy:player-stats-request';
export const STATS_REPLY = 'twitchy:player-stats';

export interface PlayerStats {
  /** Seconds behind the broadcaster. */
  latency: number;
  width: number;
  height: number;
  /** Frames per second of the quality playing, e.g. 60 for 720p60. */
  framerate: number;
  /** Bits per second. */
  bitrate: number;
  /** Seconds of video downloaded ahead. */
  buffer: number;
  droppedFrames: number;
  decodedFrames: number;
  /** "HLS" and the like. */
  protocol: string;
}

export interface StatsReply {
  type: typeof STATS_REPLY;
  /** Null when no live stream is playing. */
  stats: PlayerStats | null;
}

function bitrate(bps: number): string {
  return bps >= 1e6 ? `${(bps / 1e6).toFixed(1)} Mb/s` : `${Math.round(bps / 1e3)} kb/s`;
}

/** A short line for under the player, and the details for its tooltip. */
export function formatStats(s: PlayerStats): { text: string; title: string } {
  const fps = s.framerate ? Math.round(s.framerate) : 0;
  const quality = s.height ? `${s.height}p${fps || ''}` : '';
  const text = [`Latency ${s.latency.toFixed(1)}s`, quality, s.bitrate ? bitrate(s.bitrate) : '']
    .filter(Boolean)
    .join(' · ');
  const title = [
    `Latency to broadcaster: ${s.latency.toFixed(2)} s`,
    s.height ? `Resolution: ${s.width}×${s.height}${fps ? ` at ${fps} fps` : ''}` : '',
    s.bitrate ? `Bitrate: ${bitrate(s.bitrate)}` : '',
    `Buffer: ${s.buffer.toFixed(1)} s`,
    `Dropped frames: ${s.droppedFrames} of ${s.decodedFrames}`,
    s.protocol ? `Protocol: ${s.protocol}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return { text, title };
}
