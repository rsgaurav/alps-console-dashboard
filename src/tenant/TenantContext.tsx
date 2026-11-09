import { useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { evict } from '../graphql/cache';
import { TENANTS, TenantContext } from './context';

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenantId, setTenant] = useState(TENANTS[0]);

  const setTenantId = useCallback(
    (next: string) => {
      if (next === tenantId) return;
      // tenantId is part of every cache key so we wouldn't read the old
      // data anyway, but it would still be sitting in memory and in-flight
      // requests would still land. Drop and abort all of it.
      evict(`${tenantId}:`);
      setTenant(next);
    },
    [tenantId],
  );

  const value = useMemo(() => ({ tenantId, setTenantId }), [tenantId, setTenantId]);

  // key={tenantId} remounts everything below on switch, so selected device,
  // page, search etc. all reset and nothing from the old tenant renders
  return (
    <TenantContext.Provider value={value}>
      <div key={tenantId}>{children}</div>
    </TenantContext.Provider>
  );
}

export function TenantSwitcher() {
  const ctx = useContext(TenantContext);
  if (!ctx) return null;
  return (
    <label>
      Tenant{' '}
      <select value={ctx.tenantId} onChange={(e) => ctx.setTenantId(e.target.value)}>
        {TENANTS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}
