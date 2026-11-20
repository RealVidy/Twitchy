import type { Emote, GetJson, Scope } from './types';

const API = 'https://7tv.io/v3';

/** Active-emote flag: the streamer marked this emote zero-width in their set. */
const ACTIVE_ZERO_WIDTH = 1 << 0;
/** Emote flag: the emote itself is zero-width. */
const EMOTE_ZERO_WIDTH = 1 << 8;

interface SevenTvFile {
  name: string;
  width: number;
  height: number;
  format: string;
}

export interface SevenTvActiveEmote {
  id: string;
  name: string;
  flags?: number;
  data?: {
    flags?: number;
    animated?: boolean;
    host?: { url: string; files: SevenTvFile[] };
  } | null;
}

interface SevenTvSet {
  id: string;
  emotes?: SevenTvActiveEmote[] | null;
}

interface SevenTvUser {
  emote_set?: SevenTvSet | null;
}

/** Converts one entry of a 7TV emote set. Returns null when it has no usable image. */
export function parseSevenTvEmote(e: SevenTvActiveEmote, scope: Scope): Emote | null {
  const host = e.data?.host;
  if (!host?.files?.length) return null;

  const base = host.url.startsWith('//') ? `https:${host.url}` : host.url;
  const webp = host.files.filter((f) => f.format === 'WEBP');
  const files = webp.length ? webp : host.files;

  const images = files
    .map((f) => ({ scale: Number.parseInt(f.name, 10), url: `${base}/${f.name}`, file: f }))
    .filter((i) => i.scale >= 1 && i.scale <= 4)
    .sort((a, b) => a.scale - b.scale);
  if (!images.length) return null;

  const first = images[0].file;
  return {
    id: e.id,
    name: e.name,
    provider: '7tv',
    scope,
    images: images.map(({ scale, url }) => ({ scale, url })),
    width: first.width,
    height: first.height,
    animated: Boolean(e.data?.animated),
    zeroWidth: Boolean((e.flags ?? 0) & ACTIVE_ZERO_WIDTH || (e.data?.flags ?? 0) & EMOTE_ZERO_WIDTH),
  };
}

export function parseSevenTvSet(set: SevenTvSet | null | undefined, scope: Scope): Emote[] {
  return (set?.emotes ?? []).flatMap((e) => parseSevenTvEmote(e, scope) ?? []);
}

export async function fetchSevenTvGlobal(getJson: GetJson): Promise<Emote[]> {
  const set = (await getJson(`${API}/emote-sets/global`)) as SevenTvSet | null;
  return parseSevenTvSet(set, 'global');
}

export async function fetchSevenTvChannel(
  getJson: GetJson,
  twitchId: string,
): Promise<{ setId: string | null; emotes: Emote[] }> {
  const user = (await getJson(`${API}/users/twitch/${twitchId}`)) as SevenTvUser | null;
  const set = user?.emote_set;
  return { setId: set?.id ?? null, emotes: parseSevenTvSet(set, 'channel') };
}
