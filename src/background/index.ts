import { loadChannelEmotes } from '../providers';
import type { GetJson } from '../providers/types';
import type { Request, Response } from '../shared/messages';
import { cached, pruneCache } from './cache';

const getJson: GetJson = async (url, init) => {
  const res = await fetch(url, init);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
};

chrome.runtime.onMessage.addListener((msg: Request, _sender, sendResponse) => {
  if (msg?.type !== 'load-channel') return false;

  loadChannelEmotes(getJson, cached, msg.login)
    .then((data) => sendResponse({ ok: true, data } satisfies Response<typeof data>))
    .catch((err: unknown) =>
      sendResponse({ ok: false, error: String(err) } satisfies Response<never>),
    );
  return true; // keeps the channel open for the async response
});

chrome.runtime.onStartup.addListener(() => void pruneCache());
chrome.runtime.onInstalled.addListener(() => void pruneCache());
