import { parseSevenTvEmote, type SevenTvActiveEmote } from '../providers/seventv';
import type { Emote } from '../providers/types';

interface Change {
  key: string;
  value?: SevenTvActiveEmote | null;
  old_value?: SevenTvActiveEmote | null;
}

/** Body of an `emote_set.update` dispatch from the 7TV EventAPI. */
export interface EmoteSetUpdate {
  id: string;
  pushed?: Change[] | null;
  pulled?: Change[] | null;
  updated?: Change[] | null;
}

/** Events normally carry the full emote; if not, its images are still at a known address. */
function toEmote(value: SevenTvActiveEmote): Emote | null {
  const parsed = parseSevenTvEmote(value, 'channel');
  if (parsed || !value.id || !value.name) return parsed;
  return {
    id: value.id,
    name: value.name,
    provider: '7tv',
    scope: 'channel',
    images: [1, 2, 3, 4].map((scale) => ({
      scale,
      url: `https://cdn.7tv.app/emote/${value.id}/${scale}x.webp`,
    })),
    animated: false,
    zeroWidth: Boolean((value.flags ?? 0) & 1),
  };
}

/** Returns the channel's 7TV emotes after an added, removed or renamed emote. */
export function applyEmoteSetUpdate(emotes: Emote[], update: EmoteSetUpdate): Emote[] {
  let next = [...emotes];
  const remove = (old: SevenTvActiveEmote | null | undefined) => {
    if (!old) return;
    // An emote can be added twice under different names, so match on both.
    next = next.filter((e) => !(e.id === old.id && e.name === old.name));
  };
  const add = (value: SevenTvActiveEmote | null | undefined) => {
    const emote = value && toEmote(value);
    if (emote) next = [...next.filter((e) => e.name !== emote.name), emote];
  };

  for (const c of update.pulled ?? []) if (c.key === 'emotes') remove(c.old_value);
  for (const c of update.updated ?? []) {
    if (c.key !== 'emotes') continue;
    remove(c.old_value);
    add(c.value);
  }
  for (const c of update.pushed ?? []) if (c.key === 'emotes') add(c.value);
  return next;
}
