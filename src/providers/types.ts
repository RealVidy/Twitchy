export type Provider = '7tv' | 'bttv' | 'ffz';
export type Scope = 'channel' | 'global';

export interface EmoteImage {
  /** Pixel density the image is meant for: 1, 2, 3 or 4. */
  scale: number;
  url: string;
}

export interface Emote {
  id: string;
  name: string;
  provider: Provider;
  scope: Scope;
  /** Sorted by scale, smallest first. */
  images: EmoteImage[];
  /** Size of the 1x image, when the provider tells us. */
  width?: number;
  height?: number;
  animated: boolean;
  /** Drawn on top of the emote before it instead of next to it. */
  zeroWidth: boolean;
}

export interface EmoteSet {
  provider: Provider;
  scope: Scope;
  emotes: Emote[];
}

export interface ChannelEmotes {
  login: string;
  twitchId: string | null;
  /** The channel's active 7TV emote set, for live updates. */
  sevenTvSetId: string | null;
  sets: EmoteSet[];
}

/** Fetches JSON. Resolves to null on 404 so "channel has no emotes here" is not an error. */
export type GetJson = (url: string, init?: RequestInit) => Promise<unknown>;
