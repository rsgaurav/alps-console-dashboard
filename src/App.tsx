import { useEffect, useState } from 'react';
import { gqlFetch } from './graphql/client';

const QUERY = `
  query ListDevices($tenantId: String) {
    listDevices(tenantId: $tenantId) { pageInfo { total_count } }
  }
`;

export default function App() {
  const [result, setResult] = useState<unknown>(null);

  useEffect(() => {
    gqlFetch(
  `query DeviceDetail($tenantId: String!, $deviceId: String!) {
     deviceDetail(tenantId: $tenantId, deviceId: $deviceId) { id serialNumber imsi policy { name } }
   }`,
  { tenantId: 'tenant-alpha', deviceId: 'dev-poison' },
).then(setResult);
  }, []);

  return <pre>{JSON.stringify(result, null, 2)}</pre>;
}