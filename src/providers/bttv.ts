import type { Emote, GetJson, Scope } from './types';

const API = 'https://api.betterttv.net/3/cached';
const CDN = 'https://cdn.betterttv.net/emote';

/** BetterTTV draws these on top of the previous emote. */
export const BTTV_ZERO_WIDTH = new Set([
  'cvHazmat',
  'cvMask',
  'IceCold',
  'SoSnowy',
  'SantaHat',
  'TopHat',
  'ReinDeer',
  'CandyCane',
]);

interface BttvEmote {
  id: string;
  code: string;
  animated?: boolean;
  /** Text modifiers like `w!` (wide) and `h!` (flip). We leave these as plain text. */
  modifier?: boolean;
}

interface BttvUser {
  channelEmotes?: BttvEmote[];
  sharedEmotes?: BttvEmote[];
}

export function parseBttvEmotes(list: BttvEmote[] | null | undefined, scope: Scope): Emote[] {
  return (list ?? [])
    .filter((e) => !e.modifier)
    .map((e) => ({
      id: e.id,
      name: e.code,
      provider: 'bttv' as const,
      scope,
      images: [1, 2, 3].map((scale) => ({ scale, url: `${CDN}/${e.id}/${scale}x.webp` })),
      animated: Boolean(e.animated),
      zeroWidth: BTTV_ZERO_WIDTH.has(e.code),
    }));
}

export async function fetchBttvGlobal(getJson: GetJson): Promise<Emote[]> {
  return parseBttvEmotes((await getJson(`${API}/emotes/global`)) as BttvEmote[] | null, 'global');
}

export async function fetchBttvChannel(getJson: GetJson, twitchId: string): Promise<Emote[]> {
  const user = (await getJson(`${API}/users/twitch/${twitchId}`)) as BttvUser | null;
  return parseBttvEmotes([...(user?.channelEmotes ?? []), ...(user?.sharedEmotes ?? [])], 'channel');
}
