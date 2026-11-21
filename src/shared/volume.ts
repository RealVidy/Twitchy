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
