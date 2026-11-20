import type { EmoteRegistry } from '../emotes/registry';
import type { Emote } from '../providers/types';
import { SEL } from './selectors';
import { tokenize, type Token } from './tokenize';

/** Told about the emotes of every message we render, e.g. to count how often they are used. */
export type EmotesSeen = (names: string[]) => void;

const DONE = 'twitchyDone';

/** Lets the tooltip find the emote behind an <img>. */
export const emoteOfImage = new WeakMap<HTMLImageElement, Emote>();

export function createEmoteImage(emote: Emote): HTMLImageElement {
  const img = document.createElement('img');
  img.className = 'twitchy-emote';
  img.alt = emote.name;
  img.src = emote.images[0].url;
  img.srcset = emote.images.map((i) => `${i.url} ${i.scale}x`).join(', ');
  img.decoding = 'async';
  if (emote.width && emote.height) {
    img.width = emote.width;
    img.height = emote.height;
  }
  emoteOfImage.set(img, emote);
  return img;
}

/** An emote with zero-width emotes drawn on top of it, all in one grid cell. */
function createStack(base: Emote, overlays: Emote[]): HTMLSpanElement {
  const stack = document.createElement('span');
  stack.className = 'twitchy-stack';
  stack.append(createEmoteImage(base), ...overlays.map(createEmoteImage));
  return stack;
}

function renderTokens(tokens: Token[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const t of tokens) {
    if (t.kind === 'text') frag.append(document.createTextNode(t.text));
    else if (t.overlays.length) frag.append(createStack(t.emote, t.overlays));
    else frag.append(createEmoteImage(t.emote));
  }
  return frag;
}

/** Plain message text with our emotes drawn in. */
export function renderText(text: string, registry: EmoteRegistry): DocumentFragment {
  return renderTokens(tokenize(text, (name) => registry.get(name)));
}

/**
 * Replaces emote names in one text fragment. Twitch's React still owns the original span, so we
 * hide it and add our own copy next to it instead of changing its children.
 */
export function renderFragment(
  span: HTMLElement,
  registry: EmoteRegistry,
  onEmotes?: EmotesSeen,
): void {
  if (span.dataset[DONE]) return;
  span.dataset[DONE] = '1';

  const text = span.textContent ?? '';
  const tokens = tokenize(text, (name) => registry.get(name));
  const emotes = tokens.flatMap((t) => (t.kind === 'emote' ? [t.emote, ...t.overlays] : []));
  if (!emotes.length) return;
  onEmotes?.(emotes.map((e) => e.name));

  const copy = document.createElement('span');
  copy.className = 'twitchy-fragment';
  copy.append(renderTokens(tokens));
  span.hidden = true;
  span.after(copy);
}

/** Renders every fragment under `root` that we have not handled yet. */
export function renderAll(root: ParentNode, registry: EmoteRegistry, onEmotes?: EmotesSeen): void {
  if (registry.size === 0) return;
  root
    .querySelectorAll<HTMLElement>(SEL.textFragment)
    .forEach((s) => renderFragment(s, registry, onEmotes));
}
