/** The kinds of top bar notifications whose red count badge can be shown or hidden. */
export const BADGE_KINDS = ['giftSubs', 'drops', 'streaks', 'promotions', 'other', 'whispers'] as const;
export type BadgeKind = (typeof BADGE_KINDS)[number];

/** How a message a moderator deleted shows: its text struck through, its text faded, or Twitch's notice. */
export const DELETED_STYLES = ['strike', 'faded', 'twitch'] as const;
export type DeletedStyle = (typeof DELETED_STYLES)[number];

/**
 * Whether sidebar previews play with sound: always (`on`), never (`off`), or as the stream being
 * watched does (`stream`), or as Twitch's saved setting says when none plays.
 */
export const PREVIEW_SOUNDS = ['on', 'off', 'stream'] as const;
export type PreviewSound = (typeof PREVIEW_SOUNDS)[number];

export interface Settings {
  /** Adds 7TV, BetterTTV and FrankerFaceZ sections to Twitch's emote picker. */
  pickerEmotes: boolean;
  /** Above this many emotes, a provider's section only shows the most used ones. */
  pickerLimit: number;
  /** Typing `:` and two letters lists the emotes whose names contain them. */
  colonAutocomplete: boolean;
  /** Up and Down in an empty chat box bring back the messages sent in this tab. */
  messageHistory: boolean;
  deletedMessages: DeletedStyle;
  /** Clicks the channel points bonus as soon as it shows up. */
  autoClaimPoints: boolean;
  /** Clicks "Start Watching" on the warning Twitch shows before streams with content labels. */
  skipContentWarning: boolean;
  /** Shows latency, quality and bitrate next to the viewer count under the player. */
  videoStats: boolean;
  /** Shows the stream's thumbnail when hovering a live channel in the sidebar. */
  sidebarPreviews: boolean;
  /** Plays the stream itself in that preview, and mutes the stream being watched while it has sound. */
  sidebarPreviewVideo: boolean;
  /** Whether the stream in that preview plays with sound. */
  sidebarPreviewSound: PreviewSound;
  /** Opens the collapsed sidebar while the pointer rests on it. */
  sidebarExpandOnHover: boolean;
  /** The mouse wheel over the player turns the volume, past 100% for quiet channels. */
  volumeWheel: boolean;
  /**
   * Each channel plays at the volume it was last left at, its sidebar preview too. Muting stays
   * Twitch's own, for all channels.
   */
  volumePerChannel: boolean;
  /** A click on the stream mutes or unmutes it. */
  clickToMute: boolean;
  /** Hides the emotes the picker shows with a lock (subscriber emotes you don't have). */
  hideLockedEmotes: boolean;
  /** Hides the Chat button under the chat input; messages are sent with Enter. */
  hideSendButton: boolean;
  /** Which kinds of new notifications get a red count badge in the top bar. */
  badges: Record<BadgeKind, boolean>;
}

export const DEFAULT_SETTINGS: Settings = {
  pickerEmotes: true,
  pickerLimit: 60,
  colonAutocomplete: true,
  messageHistory: true,
  deletedMessages: 'strike',
  autoClaimPoints: true,
  skipContentWarning: true,
  videoStats: true,
  sidebarPreviews: true,
  sidebarPreviewVideo: true,
  sidebarPreviewSound: 'on',
  sidebarExpandOnHover: true,
  volumeWheel: true,
  volumePerChannel: true,
  clickToMute: true,
  hideLockedEmotes: true,
  hideSendButton: true,
  badges: {
    giftSubs: true,
    drops: false,
    streaks: false,
    promotions: false,
    other: false,
    whispers: false,
  },
};

export const PICKER_LIMIT_MIN = 6;
export const PICKER_LIMIT_MAX = 1000;

const KEY = 'settings';

/** Fills in defaults and fixes out-of-range values, so old or hand-edited data still works. */
export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const limit = Number(r.pickerLimit);
  const badges = (r.badges && typeof r.badges === 'object' ? r.badges : {}) as Record<string, unknown>;
  return {
    pickerEmotes: bool(r.pickerEmotes, DEFAULT_SETTINGS.pickerEmotes),
    pickerLimit: Number.isFinite(limit)
      ? Math.min(PICKER_LIMIT_MAX, Math.max(PICKER_LIMIT_MIN, Math.round(limit)))
      : DEFAULT_SETTINGS.pickerLimit,
    colonAutocomplete: bool(r.colonAutocomplete, DEFAULT_SETTINGS.colonAutocomplete),
    messageHistory: bool(r.messageHistory, DEFAULT_SETTINGS.messageHistory),
    deletedMessages: DELETED_STYLES.includes(r.deletedMessages as DeletedStyle)
      ? (r.deletedMessages as DeletedStyle)
      : DEFAULT_SETTINGS.deletedMessages,
    autoClaimPoints: bool(r.autoClaimPoints, DEFAULT_SETTINGS.autoClaimPoints),
    skipContentWarning: bool(r.skipContentWarning, DEFAULT_SETTINGS.skipContentWarning),
    videoStats: bool(r.videoStats, DEFAULT_SETTINGS.videoStats),
    sidebarPreviews: bool(r.sidebarPreviews, DEFAULT_SETTINGS.sidebarPreviews),
    sidebarPreviewVideo: bool(r.sidebarPreviewVideo, DEFAULT_SETTINGS.sidebarPreviewVideo),
    sidebarPreviewSound: PREVIEW_SOUNDS.includes(r.sidebarPreviewSound as PreviewSound)
      ? (r.sidebarPreviewSound as PreviewSound)
      : DEFAULT_SETTINGS.sidebarPreviewSound,
    sidebarExpandOnHover: bool(r.sidebarExpandOnHover, DEFAULT_SETTINGS.sidebarExpandOnHover),
    volumeWheel: bool(r.volumeWheel, DEFAULT_SETTINGS.volumeWheel),
    volumePerChannel: bool(r.volumePerChannel, DEFAULT_SETTINGS.volumePerChannel),
    clickToMute: bool(r.clickToMute, DEFAULT_SETTINGS.clickToMute),
    hideLockedEmotes: bool(r.hideLockedEmotes, DEFAULT_SETTINGS.hideLockedEmotes),
    hideSendButton: bool(r.hideSendButton, DEFAULT_SETTINGS.hideSendButton),
    badges: Object.fromEntries(
      BADGE_KINDS.map((k) => [k, bool(badges[k], DEFAULT_SETTINGS.badges[k])]),
    ) as Record<BadgeKind, boolean>,
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
