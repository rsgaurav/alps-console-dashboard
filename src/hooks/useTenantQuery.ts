import type { Variables } from '../graphql/client';
import { useQuery, type UseQueryResult } from './useQuery';
import { useTenant } from './useTenant';

type TenantVars<TVars> = Omit<TVars, 'tenantId'>;

// useQuery with the current tenant added to variables and queryKey.
// call sites can't forget the tenant because they can't pass it.
export function useTenantQuery<TData, TVars extends Variables = Variables>(
  query: string,
  options: {
    variables?: TenantVars<TVars>;
    fetchFirst?: boolean;
    queryKey: string; // required so every tenant query can be invalidated
  },
): UseQueryResult<TData, TenantVars<TVars>> {
  const { tenantId } = useTenant();

  // tenantId goes last so it always wins
  const result = useQuery<TData, Variables>(query, {
    variables: { ...options.variables, tenantId },
    fetchFirst: options.fetchFirst,
    queryKey: `${tenantId}:${options.queryKey}`,
  });

  return {
    ...result,
    // add it here too, otherwise replace: true would drop tenantId
    refetch: (vars, replace) => result.refetch({ ...vars, tenantId }, replace),
    reset: (key) => result.reset(key ? `${tenantId}:${key}` : undefined),
  };
}
