import { createContext } from 'react';

// in production this comes from the signed-in user's token
export const TENANTS = ['tenant-alpha', 'tenant-beta'];

export type TenantContextValue = {
  tenantId: string;
  setTenantId: (id: string) => void;
};

export const TenantContext = createContext<TenantContextValue | null>(null);
