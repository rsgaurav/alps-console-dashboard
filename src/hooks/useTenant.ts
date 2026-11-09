import { useContext } from 'react';
import { TenantContext } from '../tenant/context';

export function useTenant() {
  const ctx = useContext(TenantContext);
  // no provider = we'd send requests without a tenant. fail loudly instead
  if (!ctx) throw new Error('useTenant must be used inside <TenantProvider>');
  return ctx;
}
