import { describe, expect, it } from 'vitest';
import { embeddedInTwitch, showVideoOnly } from '../src/embed/embedded';

describe('embeddedInTwitch', () => {
  it('is true only in a player that a twitch.tv page frames directly', () => {
    expect(embeddedInTwitch(['https://www.twitch.tv'])).toBe(true);
    expect(embeddedInTwitch(['https://www.twitch.tv', 'https://example.com'])).toBe(true);
    expect(embeddedInTwitch(['https://example.com', 'https://www.twitch.tv'])).toBe(false);
    expect(embeddedInTwitch([])).toBe(false);
    expect(embeddedInTwitch(undefined)).toBe(false);
  });
});

describe('showVideoOnly', () => {
  it('hides everything in the player but the video, once', () => {
    document.head.innerHTML = '';
    showVideoOnly();
    showVideoOnly();
    const styles = document.head.querySelectorAll('style');
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toContain('body * { visibility: hidden !important; }');
    expect(styles[0].textContent).toContain('video { visibility: visible !important; }');
  });
});
