import type { EmoteRegistry } from '../emotes/registry';
import type { Emote } from '../providers/types';
import { SEL } from './selectors';
import { tokenize, type Token } from './tokenize';

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

function renderTokens(tokens: Token[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const t of tokens) {
    frag.append(t.kind === 'text' ? document.createTextNode(t.text) : createEmoteImage(t.emote));
  }
  return frag;
}

/**
 * Replaces emote names in one text fragment. Twitch's React still owns the original span, so we
 * hide it and add our own copy next to it instead of changing its children.
 */
export function renderFragment(span: HTMLElement, registry: EmoteRegistry): void {
  if (span.dataset[DONE]) return;
  span.dataset[DONE] = '1';

  const text = span.textContent ?? '';
  const tokens = tokenize(text, (name) => registry.get(name));
  if (!tokens.some((t) => t.kind === 'emote')) return;

  const copy = document.createElement('span');
  copy.className = 'twitchy-fragment';
  copy.append(renderTokens(tokens));
  span.hidden = true;
  span.after(copy);
}

/** Renders every fragment under `root` that we have not handled yet. */
export function renderAll(root: ParentNode, registry: EmoteRegistry): void {
  if (registry.size === 0) return;
  root.querySelectorAll<HTMLElement>(SEL.textFragment).forEach((s) => renderFragment(s, registry));
}
