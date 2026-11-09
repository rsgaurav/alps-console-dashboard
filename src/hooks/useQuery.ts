import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cacheKey, evict, fetchQuery, getEntry, subscribe } from '../graphql/cache';
import type { Variables } from '../graphql/client';
import { stableKey } from '../graphql/stableKey';

export type UseQueryResult<TData, TVars> = {
  loading: boolean;
  errors: string[];
  data: TData | undefined;
  refetch: (variables?: TVars, replace?: boolean) => Promise<void>;
  reset: (queryKey?: string) => void;
};

type QueryOptions<TVars> = {
  variables?: TVars;
  fetchFirst?: boolean;
  queryKey?: string;
};

export function useQuery<TData, TVars extends Variables = Variables>(
  query: string,
  options: QueryOptions<TVars> = {},
): UseQueryResult<TData, TVars> {
  const { variables, fetchFirst = false, queryKey } = options;
  const varsString = stableKey(variables); // compare by value, not reference

  // vars passed to refetch() - used until the hook's own variables change
  const [refetchVars, setRefetchVars] = useState<{ from: string; vars?: TVars }>();
  const currentVars = refetchVars?.from === varsString ? refetchVars.vars : variables;
  const key = cacheKey(query, currentVars);

  const [loading, setLoading] = useState(fetchFirst);
  const [errors, setErrors] = useState<string[]>([]);
  const lastRequestId = useRef(0);

  // read from the cache so optimistic patches show up here too
  const cached = useSyncExternalStore(subscribe, () => getEntry(key)?.data) as TData | undefined;

  // keep showing the last data while new vars load (no flicker while typing),
  // but only for the same queryKey. tenant + device id are in the queryKey,
  // so switching either one clears it.
  const [last, setLast] = useState<{ data: TData; queryKey?: string }>();
  if (cached !== undefined && (cached !== last?.data || queryKey !== last.queryKey)) {
    setLast({ data: cached, queryKey });
  }
  // TODO: if the new request fails we still show the old rows next to the
  // error. Should probably clear them once the request has settled.
  const data = cached ?? (last && last.queryKey === queryKey ? last.data : undefined);

  // only true after invalidate(), not after evict/reset (entry is gone then)
  const isStale = useSyncExternalStore(subscribe, () => getEntry(key)?.stale === true);

  const optsRef = useRef({ query, variables, currentVars, queryKey });
  useEffect(() => {
    optsRef.current = { query, variables, currentVars, queryKey };
  });

  const doFetch = useCallback(async (vars: TVars | undefined, force: boolean) => {
    const requestId = ++lastRequestId.current;
    const { query, queryKey } = optsRef.current;
    setLoading(true);
    try {
      const res = await fetchQuery<TData>(query, vars, queryKey, force);
      if (requestId !== lastRequestId.current) return; // newer request started
      // partial response: data is already in the cache, errors go here,
      // UI shows both
      setErrors(res.errors);
    } catch (e) {
      if (requestId !== lastRequestId.current) return;
      const err = e as Error;
      if (err.name !== 'AbortError') setErrors([err.message]);
    } finally {
      if (requestId === lastRequestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fetchFirst) doFetch(optsRef.current.currentVars, false);
  }, [fetchFirst, key, isStale, doFetch]);

  // TODO: abort the request on unmount. right now it finishes and fills the
  // cache, which is fine since the lastRequestId check stops any state update

  const refetch = useCallback(
    async (vars?: TVars, replace = false) => {
      const base = optsRef.current.variables;
      const newVars = replace ? vars : ({ ...base, ...vars } as TVars);
      setRefetchVars({ from: stableKey(base), vars: newVars });
      await doFetch(newVars, true);
    },
    [doFetch],
  );

  const reset = useCallback((resetKey?: string) => {
    lastRequestId.current++; // ignore whatever is still in flight
    const k = resetKey ?? optsRef.current.queryKey;
    // TODO: can't cancel without a queryKey, only local state gets cleared
    if (k) evict(k);
    setRefetchVars(undefined);
    setLast(undefined);
    setErrors([]);
    setLoading(false);
  }, []);

  return { loading, errors, data, refetch, reset };
}
