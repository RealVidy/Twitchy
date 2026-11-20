import { describe, expect, it } from 'vitest';
import { createEmoteImage } from '../src/content/render';
import { installTooltip } from '../src/content/tooltip';
import type { Emote } from '../src/providers/types';

const kekw: Emote = {
  id: '1',
  name: 'KEKW',
  provider: 'bttv',
  scope: 'channel',
  images: [
    { scale: 1, url: 'https://cdn.example/1x.webp' },
    { scale: 3, url: 'https://cdn.example/3x.webp' },
  ],
  animated: false,
  zeroWidth: false,
};

describe('tooltip', () => {
  installTooltip();

  it('shows the big image, name and provider on hover, and hides on leave', () => {
    const img = createEmoteImage(kekw);
    document.body.append(img);

    img.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const tip = document.querySelector<HTMLElement>('.twitchy-tooltip')!;
    expect(tip.classList.contains('twitchy-tooltip--visible')).toBe(true);
    expect(tip.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/3x.webp');
    expect(tip.textContent).toContain('KEKW');
    expect(tip.textContent).toContain('BetterTTV · Channel emote');

    img.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    expect(tip.classList.contains('twitchy-tooltip--visible')).toBe(false);
  });

  it('describes every emote of a stack', () => {
    const stack = document.createElement('span');
    stack.className = 'twitchy-stack';
    const overlay = createEmoteImage({ ...kekw, name: 'RainTime', provider: '7tv', scope: 'global', zeroWidth: true });
    stack.append(createEmoteImage(kekw), overlay);
    document.body.append(stack);

    overlay.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const tip = document.querySelector<HTMLElement>('.twitchy-tooltip')!;
    expect(tip.querySelectorAll('.twitchy-tooltip__image')).toHaveLength(2);
    expect(tip.querySelector('.twitchy-tooltip__name')?.textContent).toBe('KEKW + RainTime');
    expect(tip.textContent).toContain('RainTime: 7TV · Global emote · Zero-width');
    overlay.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
  });

  it('ignores images that are not ours', () => {
    const other = document.createElement('img');
    document.body.append(other);
    other.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelector('.twitchy-tooltip--visible')).toBeNull();
  });
});
