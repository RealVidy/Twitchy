import type { Emote, Provider } from '../providers/types';
import { emoteOfImage } from './render';

const PROVIDER_LABEL: Record<Provider, string> = {
  '7tv': '7TV',
  bttv: 'BetterTTV',
  ffz: 'FrankerFaceZ',
};

const GAP = 8;

let tip: HTMLDivElement | null = null;

function tooltipElement(): HTMLDivElement {
  if (tip?.isConnected) return tip;
  tip = document.createElement('div');
  tip.className = 'twitchy-tooltip';
  tip.setAttribute('role', 'tooltip');
  document.body.append(tip);
  return tip;
}

function describe(emote: Emote): string {
  const scope = emote.scope === 'channel' ? 'Channel emote' : 'Global emote';
  return `${PROVIDER_LABEL[emote.provider]} · ${scope}${emote.zeroWidth ? ' · Zero-width' : ''}`;
}

/** One emote, or a stack: the base emote first, then its overlays. */
function fill(el: HTMLDivElement, emotes: Emote[]): void {
  const images = document.createElement('div');
  images.className = 'twitchy-tooltip__images';
  for (const emote of emotes) {
    const img = document.createElement('img');
    img.className = 'twitchy-tooltip__image';
    img.src = emote.images.at(-1)!.url;
    img.alt = '';
    images.append(img);
  }

  const name = document.createElement('div');
  name.className = 'twitchy-tooltip__name';
  name.textContent = emotes.map((e) => e.name).join(' + ');

  const metas = emotes.map((emote) => {
    const meta = document.createElement('div');
    meta.className = 'twitchy-tooltip__meta';
    meta.textContent = emotes.length > 1 ? `${emote.name}: ${describe(emote)}` : describe(emote);
    return meta;
  });

  el.replaceChildren(images, name, ...metas);
}

/** Places the tooltip above the emote, or below it when there is no room above. */
function place(el: HTMLDivElement, target: Element): void {
  const r = target.getBoundingClientRect();
  const t = el.getBoundingClientRect();
  let top = r.top - t.height - GAP;
  if (top < GAP) top = r.bottom + GAP;
  const left = Math.min(
    Math.max(GAP, r.left + r.width / 2 - t.width / 2),
    window.innerWidth - t.width - GAP,
  );
  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
}

function show(target: Element, emotes: Emote[]): void {
  const el = tooltipElement();
  fill(el, emotes);
  el.classList.add('twitchy-tooltip--visible');
  place(el, target);
  // The big images change the size once they have loaded.
  el.querySelectorAll('img').forEach((img) =>
    img.addEventListener('load', () => place(el, target), { once: true }),
  );
}

function hide(): void {
  tip?.classList.remove('twitchy-tooltip--visible');
}

export function installTooltip(): void {
  document.addEventListener('mouseover', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLImageElement)) return;
    if (!emoteOfImage.has(target)) return;
    const stack = target.closest('.twitchy-stack');
    if (!stack) return show(target, [emoteOfImage.get(target)!]);
    const imgs = [...stack.querySelectorAll<HTMLImageElement>('img.twitchy-emote')];
    show(stack, imgs.flatMap((img) => emoteOfImage.get(img) ?? []));
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target instanceof HTMLImageElement && emoteOfImage.has(e.target)) hide();
  });
  // Chat keeps scrolling under a still mouse; a tooltip left behind would point at nothing.
  document.addEventListener('scroll', hide, { capture: true, passive: true });
}
