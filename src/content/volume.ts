import { normalizeBoost, savedVolume, SET_VOLUME, splitLevel, stepLevel, type SetVolume } from '../shared/volume';
import { SEL } from './selectors';

/** The part of chrome.storage.local we use, so tests can pass a fake. */
export interface BoostStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

/** The parts of Web Audio we use, so tests can pass a fake. */
export type AudioContextLike = Pick<
  AudioContext,
  'state' | 'resume' | 'createMediaElementSource' | 'createGain' | 'destination' | 'onstatechange'
>;

const PREFIX = 'boost:';
/**
 * Wheel distance for one notch: a mouse wheel click is about 100. A touchpad sends less at a time,
 * so half of it is enough; a fast spin can come as one event of several hundred.
 */
const NOTCH = 100;
const MIN_NOTCH = 50;
const LINE_HEIGHT = 40;
const INDICATOR_MS = 1000;
/** Within this long of the last notch, Twitch may not have applied it yet: we go on from ours. */
const RAPID_MS = 400;
const INDICATOR = 'twitchy-volume';

/**
 * Turns the volume with the mouse wheel over the player, past Twitch's 100% for streams that are
 * too quiet, and remembers that boost for each channel. Up to 100% it moves Twitch's own volume
 * (through the page script, so Twitch's slider follows); past it, a Web Audio gain on the video
 * does the rest.
 */
export class VolumeBoost {
  private login: string | null = null;
  /** The gain this channel gets on top of Twitch's volume: 1 means none. */
  private boost = 1;
  private ctx: AudioContextLike | null = null;
  private gains = new WeakMap<HTMLMediaElement, GainNode>();
  /** Videos that something else already routes through Web Audio; we can't add our gain. */
  private taken = new WeakSet<HTMLMediaElement>();
  private wheel = 0;
  private last = { level: 0, at: -Infinity };

  constructor(
    private storage: BoostStorage,
    private enabled: () => boolean,
    private createContext: () => AudioContextLike = () => new AudioContext(),
  ) {}

  start(): void {
    // Not passive: we keep the page from scrolling while the wheel turns the volume.
    document.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    // Browsers start Web Audio only after a click or key press; try again on the next one.
    const retry = () => {
      if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
    };
    document.addEventListener('pointerdown', retry, true);
    document.addEventListener('keydown', retry, true);
    // Twitch can swap the video element, e.g. between channels: put the gain on the new one.
    window.setInterval(() => this.apply(), 1000);
  }

  /** Loads the boost saved for the channel. Off a channel (a mini player), the last one stays. */
  async switchChannel(login: string | null): Promise<void> {
    if (!login || login === this.login) return;
    this.login = login;
    this.boost = 1;
    this.apply();
    const saved = normalizeBoost((await this.storage.get(PREFIX + login))[PREFIX + login]);
    if (this.login !== login) return; // the user moved on while we were loading
    this.boost = saved;
    this.apply();
  }

  /** The boost in effect: none while turned off. */
  get gain(): number {
    return this.enabled() ? this.boost : 1;
  }

  /** Puts the gain on the stream's video, setting up Web Audio the first time it is needed. */
  apply(): void {
    const video = document.querySelector<HTMLVideoElement>(SEL.playerVideo);
    if (!video) return;
    let node = this.gains.get(video);
    if (!node) {
      if (this.gain <= 1 || this.taken.has(video)) return; // leave the video alone until it needs a boost
      this.ctx ??= this.createContext();
      if (this.ctx.state !== 'running') {
        // Routing the video into a context that is not running would silence it.
        this.ctx.onstatechange = () => this.apply();
        void this.ctx.resume();
        return;
      }
      try {
        const source = this.ctx.createMediaElementSource(video);
        node = this.ctx.createGain();
        source.connect(node).connect(this.ctx.destination);
      } catch (err) {
        this.taken.add(video);
        console.warn('[twitchy] cannot boost this video', err);
        return;
      }
      this.gains.set(video, node);
    }
    node.gain.value = this.gain;
  }

  /** True while a boost waits for the browser to allow Web Audio. */
  private get waiting(): boolean {
    const video = document.querySelector<HTMLVideoElement>(SEL.playerVideo);
    return this.gain > 1 && !!video && !this.gains.has(video);
  }

  private onWheel(e: WheelEvent): void {
    if (!this.enabled() || e.ctrlKey || e.deltaY === 0 || !(e.target instanceof Element)) return;
    const player = e.target.closest(SEL.videoPlayer);
    const video = player?.querySelector<HTMLVideoElement>('video');
    if (!player || !video || e.target.closest(SEL.playerMenu)) return;
    e.preventDefault();

    this.wheel += e.deltaY * (e.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_HEIGHT : 1);
    if (Math.abs(this.wheel) < MIN_NOTCH) return;
    const direction = this.wheel < 0 ? 1 : -1;
    const notches = Math.max(1, Math.round(Math.abs(this.wheel) / NOTCH));
    this.wheel = 0;

    const now = performance.now();
    const rapid = now - this.last.at < RAPID_MS;
    let level: number;
    if (video.muted && !rapid) {
      if (direction < 0) return;
      // Scrolling up unmutes where the volume was. Twitch sets the video's volume to 0 while muted,
      // so that comes from its saved volume; at 0 it would stay silent, so it goes up a notch.
      level = savedVolume().volume * this.boost;
      if (level === 0) level = stepLevel(level, 1);
    } else {
      level = rapid ? this.last.level : video.volume * this.boost;
      for (let i = 0; i < notches; i++) level = stepLevel(level, direction);
    }
    this.last = { level, at: now };
    const { volume, boost } = splitLevel(level);
    const message: SetVolume = { type: SET_VOLUME, volume, muted: false };
    window.postMessage(message, location.origin);
    this.setBoost(boost);
    this.show(player, level);
  }

  private setBoost(boost: number): void {
    if (boost === this.boost) return;
    this.boost = boost;
    this.apply();
    if (!this.login) return;
    if (boost > 1) void this.storage.set({ [PREFIX + this.login]: boost });
    else void this.storage.remove(PREFIX + this.login);
  }

  /** A short "150%" over the player, since Twitch's slider stops at 100%. */
  private show(player: Element, level: number): void {
    const percent = formatLevel(level);
    showIndicator(player, this.waiting ? `${percent} · click the page to boost` : percent);
  }
}

/** A level as the indicator shows it: 1.5 is "150%". */
export function formatLevel(level: number): string {
  return `${Math.round(level * 100)}%`;
}

let hideTimer = 0;

/** Shows `text` over the player for a moment: the volume, or that it is muted. */
export function showIndicator(player: Element, text: string): void {
  let el = player.querySelector<HTMLElement>(`.${INDICATOR}`);
  if (!el) {
    el = document.createElement('div');
    el.className = INDICATOR;
    player.append(el);
  }
  el.textContent = text;
  el.classList.add(`${INDICATOR}--visible`);
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => el.classList.remove(`${INDICATOR}--visible`), INDICATOR_MS);
}
