export interface Settings {
  /** Adds 7TV, BetterTTV and FrankerFaceZ sections to Twitch's emote picker. */
  pickerEmotes: boolean;
  /** Above this many emotes, a provider's section only shows the most used ones. */
  pickerLimit: number;
  /** Hides the emotes the picker shows with a lock (subscriber emotes you don't have). */
  hideLockedEmotes: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  pickerEmotes: true,
  pickerLimit: 60,
  hideLockedEmotes: true,
};

export const PICKER_LIMIT_MIN = 6;
export const PICKER_LIMIT_MAX = 1000;

const KEY = 'settings';

/** Fills in defaults and fixes out-of-range values, so old or hand-edited data still works. */
export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const limit = Number(r.pickerLimit);
  return {
    pickerEmotes: bool(r.pickerEmotes, DEFAULT_SETTINGS.pickerEmotes),
    pickerLimit: Number.isFinite(limit)
      ? Math.min(PICKER_LIMIT_MAX, Math.max(PICKER_LIMIT_MIN, Math.round(limit)))
      : DEFAULT_SETTINGS.pickerLimit,
    hideLockedEmotes: bool(r.hideLockedEmotes, DEFAULT_SETTINGS.hideLockedEmotes),
  };
}

export async function loadSettings(): Promise<Settings> {
  return normalizeSettings((await chrome.storage.sync.get(KEY))[KEY]);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = normalizeSettings({ ...(await loadSettings()), ...patch });
  await chrome.storage.sync.set({ [KEY]: next });
  return next;
}

/** Calls `listener` whenever the settings change, from the popup or another device. */
export function watchSettings(listener: (settings: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && KEY in changes) listener(normalizeSettings(changes[KEY].newValue));
  });
}
