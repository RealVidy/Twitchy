import { loadChannelEmotes } from '../providers';
import { fetchNotifications } from '../providers/twitch';
import type { GetJson } from '../providers/types';
import type { Request, Response } from '../shared/messages';
import { cached, pruneCache } from './cache';

// A provider that never answers must not hold back the emotes of the others.
const TIMEOUT_MS = 10_000;

const getJson: GetJson = async (url, init) => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
};

function handle(msg: Request): Promise<unknown> | null {
  switch (msg?.type) {
    case 'load-channel':
      return loadChannelEmotes(getJson, cached, msg.login);
    case 'load-notifications':
      return fetchNotifications(getJson, msg.token);
    default:
      return null;
  }
}

chrome.runtime.onMessage.addListener((msg: Request, _sender, sendResponse) => {
  const work = handle(msg);
  if (!work) return false;
  work
    .then((data) => sendResponse({ ok: true, data } satisfies Response<unknown>))
    .catch((err: unknown) =>
      sendResponse({ ok: false, error: String(err) } satisfies Response<never>),
    );
  return true; // keeps the channel open for the async response
});

chrome.runtime.onStartup.addListener(() => void pruneCache());
chrome.runtime.onInstalled.addListener(() => void pruneCache());
