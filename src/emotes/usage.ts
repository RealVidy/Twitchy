/** The part of chrome.storage.local we use, so tests can pass a fake. */
export interface UsageStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

const PREFIX = 'usage:';
/** Only the most used names are kept, so storage stays small on busy channels. */
const MAX_NAMES = 1000;
const SAVE_DELAY_MS = 10_000;

/**
 * Counts how often each emote shows up in a channel's chat, so the emote picker can show the
 * emotes that chat actually uses. Counts are kept per channel and survive reloads.
 */
export class EmoteUsage {
  private login: string | null = null;
  private counts = new Map<string, number>();
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private storage: UsageStorage) {}

  async switchChannel(login: string | null): Promise<void> {
    if (login === this.login) return;
    void this.flush();
    this.login = login;
    this.counts = new Map();
    if (!login) return;

    const stored = (await this.storage.get(PREFIX + login))[PREFIX + login];
    if (this.login !== login || !stored || typeof stored !== 'object') return;
    // Messages counted while we were loading are added on top.
    for (const [name, n] of Object.entries(stored as Record<string, unknown>)) {
      if (typeof n === 'number') this.counts.set(name, (this.counts.get(name) ?? 0) + n);
    }
  }

  /** Counts each name once, so one message spamming an emote counts as one use. */
  record(names: Iterable<string>): void {
    if (!this.login) return;
    for (const name of new Set(names)) this.counts.set(name, (this.counts.get(name) ?? 0) + 1);
    this.dirty = true;
    this.saveTimer ??= setTimeout(() => void this.flush(), SAVE_DELAY_MS);
  }

  count(name: string): number {
    return this.counts.get(name) ?? 0;
  }

  async flush(): Promise<void> {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    if (!this.dirty || !this.login) return;
    this.dirty = false;
    const top = [...this.counts].sort((a, b) => b[1] - a[1]).slice(0, MAX_NAMES);
    await this.storage.set({ [PREFIX + this.login]: Object.fromEntries(top) });
  }
}
