import { useState } from 'react';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import {
  LIST_DEVICE_HISTORY,
  type ListDeviceHistoryData,
  type ListDeviceHistoryVars,
} from '../../operations';

const PAGE_SIZE = 5;

type Props = { deviceId: string };

export function HistoryList({ deviceId }: Props) {
  const [page, setPage] = useState(1);

  const { data, loading, errors } = useTenantQuery<ListDeviceHistoryData, ListDeviceHistoryVars>(
    LIST_DEVICE_HISTORY,
    {
      variables: { deviceId, page, pageSize: PAGE_SIZE },
      fetchFirst: true,
      queryKey: `device:${deviceId}:history`,
    },
  );

  const rows = data?.listDeviceHistory.histories ?? [];
  const total = data?.listDeviceHistory.pageInfo.total_count;
  const totalPages = total === undefined ? undefined : Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="history">
      <h2>History</h2>
      {loading && <span>Loading…</span>}
      {errors.length > 0 && <p className="error">{errors.join(', ')}</p>}
      {!loading && data && rows.length === 0 && <p>No history yet.</p>}

      {rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Action</th>
              <th>Policy</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h, i) => (
              <tr key={`${h.createdAt}-${i}`}>
                <td>{new Date(h.createdAt).toLocaleString()}</td>
                <td>{h.type}</td>
                <td>{h.actionName}</td>
                <td>
                  {h.policyName} → {h.nextPolicyName}
                </td>
                <td>{h.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Prev
        </button>{' '}
        Page {page} of {totalPages ?? '?'}{' '}
        <button
          disabled={totalPages === undefined || page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
