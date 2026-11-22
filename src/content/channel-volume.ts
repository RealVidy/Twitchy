import {
  CHANNEL_VOLUME,
  CHANNEL_VOLUME_CHANGED,
  isChannelVolume,
  type ChannelVolume,
  type ChannelVolumeChanged,
} from '../shared/volume';
import type { BoostStorage } from './volume';

const PREFIX = 'volume:';

/**
 * Remembers the volume each channel was last left at, in chrome.storage.local, and has the page
 * script set Twitch's player to it when the channel plays. Sidebar previews read it too. Muting is
 * not saved here: it stays Twitch's own, for all channels.
 */
export class ChannelVolumes {
  /** Saved volumes, null for a channel without one. */
  private cache = new Map<string, number | null>();
  private loads = new Map<string, Promise<void>>();
  private login: string | null = null;
  /** The channel the page script was last told about, null when it was told to stop. */
  private sent: string | null = null;

  constructor(
    private storage: Pick<BoostStorage, 'get' | 'set'>,
    private enabled: () => boolean,
  ) {}

  start(): void {
    window.addEventListener('message', (e) => {
      if (e.source !== window) return;
      const data = e.data as Partial<ChannelVolumeChanged> | null;
      if (data?.type !== CHANNEL_VOLUME_CHANGED || typeof data.login !== 'string') return;
      if (!isChannelVolume(data.volume) || !this.enabled()) return;
      this.cache.set(data.login, data.volume);
      void this.storage.set({ [PREFIX + data.login]: data.volume });
    });
  }

  /** The channel now playing. Off a channel (a mini player), the last one stays. */
  switchChannel(login: string | null): Promise<void> {
    if (login) this.login = login;
    return this.check();
  }

  /** Tells the page script about the channel playing, or to stop while turned off. */
  async check(): Promise<void> {
    const login = this.enabled() ? this.login : null;
    if (login === this.sent) return;
    this.sent = login;
    if (login) await this.load(login);
    if (this.sent !== login) return; // moved on while we were loading
    const volume = login ? (this.cache.get(login) ?? null) : null;
    const message: ChannelVolume = { type: CHANNEL_VOLUME, login, volume };
    window.postMessage(message, location.origin);
  }

  /** The volume saved for `login`: null without one or while turned off, undefined until loaded. */
  peek(login: string): number | null | undefined {
    if (!this.enabled()) return null;
    return this.cache.get(login);
  }

  /** Loads the volume saved for `login` into the cache, once. */
  load(login: string): Promise<void> {
    let load = this.loads.get(login);
    if (!load) {
      load = this.storage.get(PREFIX + login).then(
        (items) => {
          const saved = items[PREFIX + login];
          // A change the page script reported meanwhile is newer.
          if (!this.cache.has(login)) this.cache.set(login, isChannelVolume(saved) ? saved : null);
        },
        () => {
          if (!this.cache.has(login)) this.cache.set(login, null);
        },
      );
      this.loads.set(login, load);
    }
    return load;
  }
}
