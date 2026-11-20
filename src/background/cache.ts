interface Entry {
  expires: number;
  value: unknown;
}

const PREFIX = 'cache:';
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Caches results in chrome.storage.local so they survive the service worker being stopped.
 * Concurrent calls for the same key share one load. Failed loads are not cached.
 */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const storageKey = PREFIX + key;
  const stored = (await chrome.storage.local.get(storageKey))[storageKey] as Entry | undefined;
  if (stored && stored.expires > Date.now()) return stored.value as T;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = load()
    .then(async (value) => {
      const entry: Entry = { expires: Date.now() + ttlMs, value };
      await chrome.storage.local.set({ [storageKey]: entry });
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

/** Removes expired entries so storage does not grow with every channel visited. */
export async function pruneCache(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const now = Date.now();
  const expired = Object.entries(all)
    .filter(([k, v]) => k.startsWith(PREFIX) && (v as Entry).expires <= now)
    .map(([k]) => k);
  if (expired.length) await chrome.storage.local.remove(expired);
}
