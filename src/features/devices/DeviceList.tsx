import { useState } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import {
  LIST_DEVICES,
  STATES,
  type ListDevicesData,
  type ListDevicesVars,
} from '../../operations';

const PAGE_SIZE = 10;

type Props = {
  selectedId?: string;
  onSelect: (id: string) => void;
};

export function DeviceList({ selectedId, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [stateId, setStateId] = useState<number>();
  const [page, setPage] = useState(1);
  const term = useDebouncedValue(search.trim(), 300);

  // one search box. the mock ANDs imei + serialNumber, so we can't send both.
  // all digits -> imei, anything else -> serial number.
  // TODO: send two queries and merge if we need "match either"
  const isImei = /^\d+$/.test(term);

  const { data, loading, errors } = useTenantQuery<ListDevicesData, ListDevicesVars>(
    LIST_DEVICES,
    {
      variables: {
        imei: isImei ? term : undefined,
        serialNumber: !isImei && term ? term : undefined,
        stateId,
        page,
        pageSize: PAGE_SIZE,
      },
      fetchFirst: true,
      queryKey: 'devices',
    },
  );

  const rows = data?.listDevices.deviceList ?? [];
  const total = data?.listDevices.pageInfo.total_count;
  // no "pages" or "next" from the api, so work it out from total_count
  const totalPages = total === undefined ? undefined : Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section>
      <h2>Devices</h2>
      <div>
        <input
          placeholder="Search IMEI or serial"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />{' '}
        <select
          value={stateId ?? ''}
          onChange={(e) => {
            setStateId(e.target.value ? Number(e.target.value) : undefined);
            setPage(1);
          }}
        >
          <option value="">All states</option>
          {STATES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>{' '}
        {loading && <span>Loading…</span>}
      </div>

      {errors.length > 0 && <p className="error">{errors.join(', ')}</p>}

      {!loading && data && rows.length === 0 && <p>No devices found.</p>}

      {rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Serial</th>
              <th>Primary IMEI</th>
              <th>Model</th>
              <th>State</th>
              <th>Last check-in</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr
                key={d.id}
                onClick={() => onSelect(d.id)}
                className={d.id === selectedId ? 'selected' : undefined}
              >
                <td>{d.serialNumber}</td>
                <td>{d.IMEIs.find((i) => i.isPrimary)?.imei ?? '-'}</td>
                <td>{d.modelMarketingName}</td>
                <td>{d.state.name}</td>
                <td>{new Date(d.lastCheckin).toLocaleString()}</td>
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
