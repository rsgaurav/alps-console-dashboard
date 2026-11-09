import { useCallback, useRef, useState } from 'react';
import { gqlFetch, type Variables } from '../graphql/client';

export type UseMutationResult<TData, TVars> = {
  loading: boolean;
  errors: string[];
  mutateData: (variables?: TVars, replace?: boolean) => Promise<TData | undefined>;
};

type MutationOptions<TVars> = {
  variables?: TVars;
  throwError?: boolean;
};

// mutations don't go through the cache - running the same one twice should
// hit the server twice
export function useMutation<TData, TVars extends Variables = Variables>(
  query: string,
  options: MutationOptions<TVars> = {},
): UseMutationResult<TData, TVars> {
  const { variables, throwError = false } = options;
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const lastRequestId = useRef(0);

  const mutateData = useCallback(
    async (vars?: TVars, replace = false) => {
      const requestId = ++lastRequestId.current;
      const allVars = replace ? vars : ({ ...variables, ...vars } as TVars);
      setLoading(true);
      setErrors([]);

      const res = await gqlFetch<TData>(query, allVars);
      const isLatest = requestId === lastRequestId.current;
      if (isLatest) setLoading(false);

      if (res.errors.length) {
        // TODO: with throwError we lose res.data on a partial response.
        // fine for assignAction (just a Boolean), not in general.
        if (throwError) throw new Error(res.errors.join('; '));
        if (isLatest) setErrors(res.errors);
      }
      return res.data;
    },
    // variables compared by reference here - fine since call sites pass vars
    // to mutateData() instead of options
    [query, variables, throwError],
  );

  return { loading, errors, mutateData };
}
