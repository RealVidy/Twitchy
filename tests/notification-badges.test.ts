import { describe, expect, it } from 'vitest';
import { NotificationBadges, badgeKindOf, countWanted, readTwitchCount, titleWithout } from '../src/content/notification-badges';
import { fetchNotifications, type NotificationsSummary } from '../src/providers/twitch';
import { DEFAULT_SETTINGS } from '../src/shared/settings';

const note = (category: string, at: string) => ({ category, createdAt: at, updatedAt: at });

describe('badgeKindOf', () => {
  it('groups the categories Twitch uses', () => {
    expect(badgeKindOf('gift_subscriptions')).toBe('giftSubs');
    expect(badgeKindOf('transactional')).toBe('drops');
    expect(badgeKindOf('drops_and_quests')).toBe('drops');
    expect(badgeKindOf('watch_streaks')).toBe('streaks');
    expect(badgeKindOf('promotions')).toBe('promotions');
    expect(badgeKindOf('recommended_content')).toBe('promotions');
    expect(badgeKindOf('something_new')).toBe('other');
  });
});

describe('countWanted', () => {
  const summary: NotificationsSummary = {
    unseenCount: 3,
    lastSeenAt: '2026-11-20T12:00:00Z',
    notifications: [
      note('gift_subscriptions', '2026-11-20T14:00:00Z'),
      note('watch_streaks', '2026-11-20T13:00:00Z'),
      note('promotions', '2026-11-20T12:30:00Z'),
      note('gift_subscriptions', '2026-11-20T11:00:00Z'), // seen already
    ],
  };

  it('counts only new notifications of the wanted kinds', () => {
    expect(countWanted(summary, DEFAULT_SETTINGS.badges)).toBe(1);
    expect(countWanted(summary, { ...DEFAULT_SETTINGS.badges, streaks: true, promotions: true })).toBe(3);
  });

  it('counts nothing once Twitch says everything was seen', () => {
    expect(countWanted({ ...summary, unseenCount: 0 }, DEFAULT_SETTINGS.badges)).toBe(0);
  });

  it('falls back to the newest ones when the dates do not tell', () => {
    const undated = { ...summary, lastSeenAt: '2030-01-01T00:00:00Z', unseenCount: 1 };
    expect(countWanted(undated, DEFAULT_SETTINGS.badges)).toBe(1);
  });
});

describe('readTwitchCount', () => {
  it('reads the bell count, if any', () => {
    const bell = document.createElement('div');
    expect(readTwitchCount(bell)).toBe(0);
    bell.innerHTML = '<div class="tw-number-badge"><div class="tw-number-badge__badge">12</div></div>';
    expect(readTwitchCount(bell)).toBe(12);
  });
});

describe('titleWithout', () => {
  it('takes the hidden notifications off the count', () => {
    expect(titleWithout('(3) Twitch', 3, 2, 0)).toBe('(1) Twitch');
    expect(titleWithout('(3) Twitch', 3, 3, 0)).toBe('Twitch');
    expect(titleWithout('(3) Twitch', 3, 0, 0)).toBe('(3) Twitch');
    expect(titleWithout('Twitch', 0, 0, 2)).toBe('Twitch');
  });

  it('only takes whispers off when the title counts them', () => {
    expect(titleWithout('(5) Twitch', 3, 0, 2)).toBe('(3) Twitch');
    expect(titleWithout('(3) Twitch', 3, 0, 2)).toBe('(3) Twitch');
    expect(titleWithout('(5) Twitch', 3, 3, 2)).toBe('Twitch');
  });
});

describe('NotificationBadges', () => {
  it('keeps the hidden notifications out of the tab title, even when Twitch sets it again', async () => {
    document.body.innerHTML =
      '<div class="onsite-notifications"><button></button><div class="tw-number-badge">3</div></div>';
    document.title = '(3) Twitch';
    const off = { giftSubs: false, drops: false, streaks: false, promotions: false, other: false, whispers: true };
    const badges = new NotificationBadges(() => ({ ...DEFAULT_SETTINGS, badges: off }), async () => {
      throw new Error('not needed');
    });
    badges.start();
    badges.update();
    expect(document.title).toBe('Twitch');

    document.title = '(4) Somebody - Twitch';
    await new Promise((r) => setTimeout(r, 0));
    expect(document.title).toBe('(1) Somebody - Twitch');
  });
});

describe('fetchNotifications', () => {
  it("sends the user's token and reads the summary and list", async () => {
    let init: RequestInit | undefined;
    const result = await fetchNotifications(async (_url, i) => {
      init = i;
      return {
        data: {
          currentUser: {
            summary: { summary: { unseenCount: 2, lastSeenAt: '2026-11-20T12:00:00Z' } },
            list: { edges: [{ node: note('promotions', '2026-11-20T13:00:00Z') }, null] },
          },
        },
      };
    }, 'tok');
    expect((init?.headers as Record<string, string>).Authorization).toBe('OAuth tok');
    expect(result).toEqual({
      unseenCount: 2,
      lastSeenAt: '2026-11-20T12:00:00Z',
      notifications: [note('promotions', '2026-11-20T13:00:00Z')],
    });
  });

  it('fails when Twitch returns no user, e.g. on an expired session', async () => {
    await expect(fetchNotifications(async () => ({ data: { currentUser: null } }), 'tok')).rejects.toThrow();
  });
});
