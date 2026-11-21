/** Asks the page script to set Twitch's player volume, so Twitch's own slider follows. */
export const SET_VOLUME = 'twitchy:set-volume';

export interface SetVolume {
  type: typeof SET_VOLUME;
  /** 0 to 1, as Twitch's slider. */
  volume: number;
  muted: boolean;
}

/** The loudest the wheel goes: 400%, four times Twitch's maximum. */
export const MAX_LEVEL = 4;
/** One wheel notch: 5% up to 100%, then 10% at a time while boosting. */
const STEP = 0.05;
const BOOST_STEP = 0.1;

const round = (n: number) => Math.round(n * 100) / 100;

/** The level one wheel notch up (`direction` 1) or down (-1) from `level`, where 1 is 100%. */
export function stepLevel(level: number, direction: 1 | -1): number {
  if (direction > 0) {
    return level < 1 ? Math.min(1, round(level + STEP)) : Math.min(MAX_LEVEL, round(level + BOOST_STEP));
  }
  return level > 1 ? Math.max(1, round(level - BOOST_STEP)) : Math.max(0, round(level - STEP));
}

/** Twitch's own volume does up to 100%; our gain on top of it does the rest. */
export function splitLevel(level: number): { volume: number; boost: number } {
  return { volume: Math.min(1, level), boost: Math.max(1, level) };
}

/** Keeps a stored boost to a usable number: 1 (none) when missing or broken. */
export function normalizeBoost(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 1 ? Math.min(MAX_LEVEL, round(n)) : 1;
}

/**
 * Asks the page script to mute the stream while a sidebar preview plays with sound (`held`), and
 * to give its sound back afterwards.
 */
export const HOLD_MUTE = 'twitchy:hold-mute';

export interface HoldMute {
  type: typeof HOLD_MUTE;
  held: boolean;
}

/** Asks the page script to mute the stream, or unmute it at its volume, as Twitch's mute button does. */
export const TOGGLE_MUTE = 'twitchy:toggle-mute';
/** The page script's answer to TOGGLE_MUTE. */
export const MUTE_TOGGLED = 'twitchy:mute-toggled';

export interface ToggleMute {
  type: typeof TOGGLE_MUTE;
}

export interface MuteToggled {
  type: typeof MUTE_TOGGLED;
  muted: boolean;
  /** Twitch's volume, 0 to 1, which it keeps while muted. */
  volume: number;
}

/** Twitch's volume before the user ever moved its slider. */
const DEFAULT_VOLUME = 0.5;

/**
 * The volume Twitch saved for its player. Unlike the video's own volume, which Twitch sets to 0 while
 * muted, it keeps the level the stream comes back at.
 */
export function savedVolume(storage: Pick<Storage, 'getItem'> = localStorage): { volume: number; muted: boolean } {
  const raw = storage.getItem('volume');
  const volume = raw === null ? NaN : Number(raw);
  let muted = false;
  try {
    const flags = JSON.parse(storage.getItem('video-muted') ?? '{}') as { default?: unknown } | null;
    muted = flags?.default === true;
  } catch {
    // Broken or changed by Twitch: play with sound, as Twitch does by default.
  }
  return { volume: volume >= 0 && volume <= 1 ? volume : DEFAULT_VOLUME, muted };
}
