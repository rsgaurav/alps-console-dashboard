// Shared request cache used by all the query hooks.
// Key = query + variables. Each entry also stores its queryKey
// (e.g. "tenant-alpha:device:dev-0042:detail") so we can patch/invalidate
// by prefix, like everything for one device or one tenant.

import { gqlFetch, type GraphQLResult, type Variables } from './client';
import { stableKey } from './stableKey';

// 30s - device state can be changed by other operators, so don't keep it
// too long. Our own mutations invalidate directly, so TTL only matters for
// changes made by someone else.
export const TTL_MS = 30_000;

type Entry = {
  data: unknown;
  errors: string[];
  fetchedAt: number;
  promise?: Promise<GraphQLResult<unknown>>;
  controller?: AbortController;
  generation: number; // goes up with every new request for this key
  queryKey?: string;
  stale: boolean; // if true, refetch on next read even if TTL not over
};

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();

export function cacheKey(query: string, variables: Variables | undefined): string {
  return stableKey({ query, variables });
}

export function getEntry(key: string): Readonly<Entry> | undefined {
  return entries.get(key);
}

// hooks subscribe here so they re-render when something patches the cache
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((l) => l());
}

export function isFresh(entry: Entry | undefined): boolean {
  return !!entry && !entry.stale && Date.now() - entry.fetchedAt < TTL_MS;
}

// Cached data if fresh, the in-flight promise if one exists, otherwise a new
// request. Promise is saved before any await so two calls in the same tick
// share one request.
export function fetchQuery<TData>(
  query: string,
  variables: Variables | undefined,
  queryKey?: string,
  force = false,
): Promise<GraphQLResult<TData>> {
  const key = cacheKey(query, variables);
  const existing = entries.get(key);

  if (existing?.promise) return existing.promise as Promise<GraphQLResult<TData>>;
  if (!force && existing && isFresh(existing)) {
    return Promise.resolve({ data: existing.data as TData, errors: existing.errors });
  }

  const entry: Entry = existing ?? {
    data: undefined,
    errors: [],
    fetchedAt: 0,
    generation: 0,
    stale: true,
  };
  entry.queryKey = queryKey ?? entry.queryKey;
  const generation = ++entry.generation;
  const controller = new AbortController();
  entry.controller = controller;
  entries.set(key, entry);

  const promise = gqlFetch<TData>(query, variables, controller.signal).then(
    (result) => {
      // ignore if a newer request started for this key, or the entry got
      // evicted (tenant switch)
      if (entry.generation === generation && entries.get(key) === entry) {
        entry.data = result.data;
        entry.errors = result.errors;
        entry.fetchedAt = Date.now();
        // no data at all = failed, don't cache it
        entry.stale = result.data === undefined;
        entry.promise = undefined;
        entry.controller = undefined;
        notify();
      }
      return result;
    },
    (err) => {
      if (entry.generation === generation) {
        entry.promise = undefined;
        entry.controller = undefined;
      }
      throw err; // abort errors get ignored by the hook
    },
  );
  entry.promise = promise as Promise<GraphQLResult<unknown>>;
  return promise;
}

function matching(prefix: string): Entry[] {
  return [...entries.values()].filter((e) => e.queryKey?.startsWith(prefix));
}

function cancel(entry: Entry) {
  entry.controller?.abort();
  entry.generation++; // so a late response is ignored
  entry.promise = undefined;
  entry.controller = undefined;
}

// mark as stale, mounted hooks will refetch on notify
export function invalidate(prefix: string) {
  matching(prefix).forEach((e) => (e.stale = true));
  notify();
}

// abort in-flight requests and remove the entries
export function evict(prefix: string) {
  for (const [key, e] of entries) {
    if (e.queryKey?.startsWith(prefix)) {
      cancel(e);
      entries.delete(key);
    }
  }
  notify();
}

// Optimistic update. Runs updater on every matching entry and returns a
// rollback fn that puts the old data back.
export function patch(prefix: string, updater: (data: unknown) => unknown): () => void {
  const saved = matching(prefix)
    .filter((e) => e.data !== undefined)
    .map((e) => {
      const before = e.data;
      e.data = updater(before);
      return { e, before };
    });
  notify();

  // TODO: if a refetch lands between patch and rollback, this restores data
  // that is older than the server's. Could check the entry is unchanged
  // before restoring and invalidate otherwise.
  return () => {
    saved.forEach(({ e, before }) => (e.data = before));
    notify();
  };
}

// for tests - abort everything and clear
export function clearCache() {
  entries.forEach(cancel);
  entries.clear();
  notify();
}
