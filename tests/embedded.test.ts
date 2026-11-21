import { describe, expect, it } from 'vitest';
import { embeddedInTwitch } from '../src/embed/embedded';

describe('embeddedInTwitch', () => {
  it('is true only in a player that a twitch.tv page frames directly', () => {
    expect(embeddedInTwitch(['https://www.twitch.tv'])).toBe(true);
    expect(embeddedInTwitch(['https://www.twitch.tv', 'https://example.com'])).toBe(true);
    expect(embeddedInTwitch(['https://example.com', 'https://www.twitch.tv'])).toBe(false);
    expect(embeddedInTwitch([])).toBe(false);
    expect(embeddedInTwitch(undefined)).toBe(false);
  });
});
