import type { Variables } from '../graphql/client';
import { useMutation, type UseMutationResult } from './useMutation';
import { useTenant } from './useTenant';

type TenantVars<TVars> = Omit<TVars, 'tenantId'>;

// useMutation with the current tenant added to variables
export function useTenantMutation<TData, TVars extends Variables = Variables>(
  query: string,
  options: { variables?: TenantVars<TVars>; throwError?: boolean } = {},
): UseMutationResult<TData, TenantVars<TVars>> {
  const { tenantId } = useTenant();

  const result = useMutation<TData, Variables>(query, {
    variables: { ...options.variables, tenantId },
    throwError: options.throwError,
  });

  return {
    ...result,
    // tenantId always last so a caller can't override it
    mutateData: (vars, replace) => result.mutateData({ ...vars, tenantId }, replace),
  };
}
