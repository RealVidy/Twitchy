import type { NotificationsSummary } from '../providers/twitch';
import type { BadgeKind, Settings } from '../shared/settings';
import { SEL } from './selectors';

type BellKind = Exclude<BadgeKind, 'whispers'>;
const BELL_KINDS: BellKind[] = ['giftSubs', 'drops', 'streaks', 'promotions', 'other'];

/** Which badge setting a Twitch notification category falls under. */
export function badgeKindOf(category: string): BellKind {
  switch (category) {
    case 'gift_subscriptions':
      return 'giftSubs';
    case 'transactional':
    case 'drops_and_quests':
      return 'drops';
    case 'watch_streaks':
      return 'streaks';
    case 'promotions':
    case 'recommended_content':
      return 'promotions';
    default:
      return 'other';
  }
}

/** How many of the notifications Twitch counts as new are of a kind the user wants a badge for. */
export function countWanted(summary: NotificationsSummary, badges: Settings['badges']): number {
  if (summary.unseenCount <= 0) return 0;
  const since = summary.lastSeenAt ? Date.parse(summary.lastSeenAt) : Number.NEGATIVE_INFINITY;
  const time = (s: string) => Date.parse(s) || 0;
  let unseen = summary.notifications.filter((n) => Math.max(time(n.createdAt), time(n.updatedAt)) > since);
  // Twitch says some are new but the dates don't show which: take the newest ones.
  if (unseen.length === 0) unseen = summary.notifications.slice(0, summary.unseenCount);
  return unseen.filter((n) => badges[badgeKindOf(n.category)]).length;
}

/** Twitch's own count on the bell, or 0 when it shows none. */
export function readTwitchCount(bell: Element | null): number {
  const badge = bell?.querySelector(SEL.countBadge);
  if (!badge) return 0;
  const n = parseInt(badge.textContent ?? '', 10);
  return Number.isFinite(n) ? n : 1;
}

function authToken(): string | null {
  const match = /(?:^|;\s*)auth-token=([^;]+)/.exec(document.cookie);
  return match ? decodeURIComponent(match[1]) : null;
}

const RECHECK_MS = 5 * 60_000;

/**
 * Replaces Twitch's red count on the bell with one that only counts the kinds of notifications
 * chosen in the settings, and hides the whispers count unless wanted.
 */
export class NotificationBadges {
  private summary: NotificationsSummary | null = null;
  private twitchCount = -1;
  private failed = false;
  private loading = false;
  private queued = false;

  constructor(
    private readonly settings: () => Settings,
    private readonly load: (token: string) => Promise<NotificationsSummary>,
  ) {}

  /** Only when some kinds are wanted and others not do we need to look at the notifications. */
  private mode(): 'all' | 'none' | 'filter' {
    const on = BELL_KINDS.filter((k) => this.settings().badges[k]).length;
    return on === BELL_KINDS.length ? 'all' : on === 0 ? 'none' : 'filter';
  }

  start(): void {
    new MutationObserver(() => {
      if (this.queued) return;
      this.queued = true;
      requestAnimationFrame(() => {
        this.queued = false;
        this.check();
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener(
      'click',
      (e) => {
        // Opening the bell marks everything as seen.
        if ((e.target as Element | null)?.closest?.(SEL.notificationsButton)) {
          if (this.summary) this.summary = { ...this.summary, unseenCount: 0 };
          this.render();
          window.setTimeout(() => void this.refresh(), 3000);
        }
      },
      true,
    );
    window.setInterval(() => void this.refresh(), RECHECK_MS);
    void this.refresh();
  }

  /** Call when the settings change. */
  update(): void {
    if (this.mode() === 'filter' && !this.summary) void this.refresh();
    this.render();
  }

  private check(): void {
    const count = readTwitchCount(document.querySelector(SEL.notifications));
    if (count !== this.twitchCount) {
      this.twitchCount = count;
      void this.refresh();
    }
    this.render();
  }

  private async refresh(): Promise<void> {
    if (this.loading || this.mode() !== 'filter') return;
    const token = authToken();
    if (!token) return;
    this.loading = true;
    try {
      this.summary = await this.load(token);
      this.failed = false;
    } catch (err) {
      // Better a badge for everything than missing the ones the user wants.
      console.warn('[twitchy] could not load notifications, showing Twitch badge', err);
      this.failed = true;
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private render(): void {
    const s = this.settings();
    const mode = this.mode();
    const root = document.documentElement;
    root.classList.toggle('twitchy-hide-bell-badge', mode === 'none' || (mode === 'filter' && !this.failed));
    root.classList.toggle('twitchy-hide-whispers-badge', !s.badges.whispers);

    const bell = document.querySelector(SEL.notifications);
    if (!bell) return;
    const count = mode === 'filter' && !this.failed && this.summary ? countWanted(this.summary, s.badges) : 0;
    let badge = bell.querySelector<HTMLElement>('.twitchy-bell-count');
    if (count === 0) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'twitchy-bell-count';
      bell.append(badge);
    }
    const text = count > 99 ? '99+' : String(count);
    if (badge.textContent !== text) badge.textContent = text;
  }
}
