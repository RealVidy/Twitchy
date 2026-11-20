import type { Emote } from '../providers/types';

export type Token =
  | { kind: 'text'; text: string }
  /** `overlays` are zero-width emotes drawn on top of `emote`. */
  | { kind: 'emote'; emote: Emote; overlays: Emote[] };

// Invisible characters people append to get around Twitch's duplicate-message check.
const INVISIBLE = /[͏​-‍⁠﻿\u{e0000}-\u{e007f}]/gu;

/**
 * Splits message text into plain text and emotes, keeping every space where it was.
 * A zero-width emote right after another emote (only spaces between) becomes an overlay of it.
 */
export function tokenize(text: string, lookup: (name: string) => Emote | undefined): Token[] {
  const tokens: Token[] = [];
  const pushText = (t: string) => {
    if (!t) return;
    const last = tokens.at(-1);
    if (last?.kind === 'text') last.text += t;
    else tokens.push({ kind: 'text', text: t });
  };

  for (const part of text.split(/(\s+)/)) {
    if (!part || /^\s+$/.test(part)) {
      pushText(part);
      continue;
    }
    const emote = lookup(part.replace(INVISIBLE, ''));
    if (!emote) {
      pushText(part);
      continue;
    }

    if (emote.zeroWidth) {
      // Words are split on spaces, so an emote before us is always followed by a space token.
      const last = tokens.at(-1);
      const beforeLast = tokens.at(-2);
      if (last?.kind === 'text' && !last.text.trim() && beforeLast?.kind === 'emote') {
        tokens.pop(); // the space between the emote and its overlay
        beforeLast.overlays.push(emote);
        continue;
      }
    }
    tokens.push({ kind: 'emote', emote, overlays: [] });
  }
  return tokens;
}
