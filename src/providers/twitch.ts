import type { GetJson } from './types';

const GQL = 'https://gql.twitch.tv/gql';
// Public client id of the Twitch website. Needed for its GQL endpoint; no user token is sent.
const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

interface UserResponse {
  data?: { user?: { id?: string } | null };
}

export async function fetchTwitchId(getJson: GetJson, login: string): Promise<string | null> {
  const res = (await getJson(GQL, {
    method: 'POST',
    headers: { 'Client-ID': CLIENT_ID, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'query($login: String!) { user(login: $login) { id } }',
      variables: { login },
    }),
  })) as UserResponse | null;
  return res?.data?.user?.id ?? null;
}

export interface OnsiteNotification {
  /** Twitch's grouping, e.g. gift_subscriptions, watch_streaks, promotions. */
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsSummary {
  /** What Twitch shows on the bell: notifications that arrived since you last opened it. */
  unseenCount: number;
  lastSeenAt: string | null;
  /** Newest first. */
  notifications: OnsiteNotification[];
}

interface NotificationsResponse {
  data?: {
    currentUser?: {
      summary?: { summary?: { unseenCount?: number; lastSeenAt?: string | null } | null } | null;
      list?: { edges?: ({ node?: OnsiteNotification | null } | null)[] | null } | null;
    } | null;
  } | null;
}

/** The signed-in user's latest bell notifications. `token` is the user's own Twitch session. */
export async function fetchNotifications(getJson: GetJson, token: string): Promise<NotificationsSummary> {
  const res = (await getJson(GQL, {
    method: 'POST',
    headers: {
      'Client-ID': CLIENT_ID,
      Authorization: `OAuth ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `query {
        currentUser {
          summary: notifications { summary { unseenCount lastSeenAt } }
          list: notifications(first: 30, displayType: VIEWER) {
            edges { node { category createdAt updatedAt } }
          }
        }
      }`,
    }),
  })) as NotificationsResponse | null;
  const user = res?.data?.currentUser;
  if (!user) throw new Error('Twitch did not return your notifications');
  return {
    unseenCount: user.summary?.summary?.unseenCount ?? 0,
    lastSeenAt: user.summary?.summary?.lastSeenAt ?? null,
    notifications: (user.list?.edges ?? []).flatMap((e) => (e?.node ? [e.node] : [])),
  };
}
