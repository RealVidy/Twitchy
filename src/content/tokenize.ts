import type { Emote } from '../providers/types';

export type Token = { kind: 'text'; text: string } | { kind: 'emote'; emote: Emote };

// Invisible characters people append to get around Twitch's duplicate-message check.
const INVISIBLE = /[͏​-‍⁠﻿\u{e0000}-\u{e007f}]/gu;

/** Splits message text into plain text and emotes, keeping every space where it was. */
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
    if (emote) tokens.push({ kind: 'emote', emote });
    else pushText(part);
  }
  return tokens;
}
