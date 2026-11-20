import type { Emote, GetJson, Scope } from './types';

const API = 'https://api.frankerfacez.com/v1';

/** Modifier flag: the emote itself is hidden and only applies an effect (ffzHyper, ffzSpin, …). */
const MODIFIER_HIDDEN = 1 << 0;

type FfzUrls = Partial<Record<'1' | '2' | '4', string>>;

interface FfzEmote {
  id: number;
  name: string;
  width?: number;
  height?: number;
  modifier?: boolean;
  modifier_flags?: number;
  urls: FfzUrls;
  animated?: FfzUrls | null;
}

interface FfzSet {
  emoticons?: FfzEmote[];
}

interface FfzGlobal {
  default_sets?: number[];
  sets?: Record<string, FfzSet>;
}

interface FfzRoom {
  room?: { twitch_id?: number; set?: number };
  sets?: Record<string, FfzSet>;
}

function absolute(url: string): string {
  return url.startsWith('//') ? `https:${url}` : url;
}

export function parseFfzEmotes(list: FfzEmote[], scope: Scope): Emote[] {
  return list
    .filter((e) => !(e.modifier && (e.modifier_flags ?? 0) & MODIFIER_HIDDEN))
    .map((e) => {
      const urls = e.animated ?? e.urls;
      const images = (['1', '2', '4'] as const)
        .filter((s) => urls[s])
        .map((s) => ({ scale: Number(s), url: absolute(urls[s]!) }));
      return {
        id: String(e.id),
        name: e.name,
        provider: 'ffz' as const,
        scope,
        images,
        width: e.width,
        height: e.height,
        animated: Boolean(e.animated),
        // A visible modifier emote is an overlay drawn on top of the previous emote.
        zeroWidth: Boolean(e.modifier),
      };
    })
    .filter((e) => e.images.length > 0);
}

/** Only the sets everyone gets: the response also holds sets tied to specific users. */
export function parseFfzGlobal(data: FfzGlobal | null): Emote[] {
  const sets = data?.default_sets ?? [];
  return parseFfzEmotes(
    sets.flatMap((id) => data?.sets?.[id]?.emoticons ?? []),
    'global',
  );
}

export function parseFfzRoom(data: FfzRoom | null): Emote[] {
  return parseFfzEmotes(
    Object.values(data?.sets ?? {}).flatMap((s) => s.emoticons ?? []),
    'channel',
  );
}

export async function fetchFfzGlobal(getJson: GetJson): Promise<Emote[]> {
  return parseFfzGlobal((await getJson(`${API}/set/global`)) as FfzGlobal | null);
}

export async function fetchFfzChannel(getJson: GetJson, twitchId: string): Promise<Emote[]> {
  return parseFfzRoom((await getJson(`${API}/room/id/${twitchId}`)) as FfzRoom | null);
}

/** Looks a channel up by login. Used as a fallback to find its Twitch id. */
export async function fetchFfzTwitchId(getJson: GetJson, login: string): Promise<string | null> {
  const data = (await getJson(`${API}/room/${encodeURIComponent(login)}`)) as FfzRoom | null;
  const id = data?.room?.twitch_id;
  return id ? String(id) : null;
}
