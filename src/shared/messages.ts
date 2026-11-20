import type { ChannelEmotes } from '../providers/types';

export interface LoadChannelRequest {
  type: 'load-channel';
  login: string;
}

export type Request = LoadChannelRequest;

export type Response<T> = { ok: true; data: T } | { ok: false; error: string };

export async function loadChannel(login: string): Promise<ChannelEmotes> {
  const req: LoadChannelRequest = { type: 'load-channel', login };
  const res = (await chrome.runtime.sendMessage(req)) as Response<ChannelEmotes> | undefined;
  if (!res) throw new Error('no response from the background worker');
  if (!res.ok) throw new Error(res.error);
  return res.data;
}
