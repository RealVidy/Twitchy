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

function fill(el: HTMLDivElement, emote: Emote): void {
  const big = emote.images.at(-1)!;
  const img = document.createElement('img');
  img.className = 'twitchy-tooltip__image';
  img.src = big.url;
  img.alt = '';

  const name = document.createElement('div');
  name.className = 'twitchy-tooltip__name';
  name.textContent = emote.name;

  const meta = document.createElement('div');
  meta.className = 'twitchy-tooltip__meta';
  const scope = emote.scope === 'channel' ? 'Channel emote' : 'Global emote';
  meta.textContent = `${PROVIDER_LABEL[emote.provider]} · ${scope}${emote.zeroWidth ? ' · Zero-width' : ''}`;

  el.replaceChildren(img, name, meta);
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

function show(target: HTMLImageElement, emote: Emote): void {
  const el = tooltipElement();
  fill(el, emote);
  el.classList.add('twitchy-tooltip--visible');
  place(el, target);
  // The big image may change the size once it has loaded.
  el.querySelector('img')?.addEventListener('load', () => place(el, target), { once: true });
}

function hide(): void {
  tip?.classList.remove('twitchy-tooltip--visible');
}

export function installTooltip(): void {
  document.addEventListener('mouseover', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLImageElement)) return;
    const emote = emoteOfImage.get(target);
    if (emote) show(target, emote);
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target instanceof HTMLImageElement && emoteOfImage.has(e.target)) hide();
  });
  // Chat keeps scrolling under a still mouse; a tooltip left behind would point at nothing.
  document.addEventListener('scroll', hide, { capture: true, passive: true });
}
