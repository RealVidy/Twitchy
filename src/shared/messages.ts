import type { NotificationsSummary } from '../providers/twitch';
import type { ChannelEmotes } from '../providers/types';

export interface LoadChannelRequest {
  type: 'load-channel';
  login: string;
}

export interface LoadNotificationsRequest {
  type: 'load-notifications';
  token: string;
}

export type Request = LoadChannelRequest | LoadNotificationsRequest;

export type Response<T> = { ok: true; data: T } | { ok: false; error: string };

async function send<T>(req: Request): Promise<T> {
  const res = (await chrome.runtime.sendMessage(req)) as Response<T> | undefined;
  if (!res) throw new Error('no response from the background worker');
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export function loadChannel(login: string): Promise<ChannelEmotes> {
  return send({ type: 'load-channel', login });
}

export function loadNotifications(token: string): Promise<NotificationsSummary> {
  return send({ type: 'load-notifications', token });
}
