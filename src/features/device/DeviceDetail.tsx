import type { ReactNode } from 'react';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { DEVICE_DETAIL, type DeviceDetailData, type DeviceDetailVars } from '../../operations';
import { DeviceActions } from './DeviceActions';

type Props = { deviceId: string };

const FIELD_ERROR = /^deviceDetail\.([A-Za-z]+)[.:]/;

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : '-';
}

function Swatch({ color }: { color?: string | null }) {
  if (!color) return null;
  return <span className="swatch" style={{ background: color }} />;
}

export function DeviceDetail({ deviceId }: Props) {
  const { data, loading, errors } = useTenantQuery<DeviceDetailData, DeviceDetailVars>(
    DEVICE_DETAIL,
    {
      variables: { deviceId },
      fetchFirst: true,
      queryKey: `device:${deviceId}:detail`,
    },
  );

  const d = data?.deviceDetail;

  // a partial response has data plus errors that point at single fields.
  // show those next to the field, everything else at the top.
  const fieldErrors = new Map<string, string>();
  const generalErrors: string[] = [];
  for (const e of errors) {
    const m = FIELD_ERROR.exec(e);
    if (m && d) fieldErrors.set(m[1], e.slice(e.indexOf(':') + 1).trim());
    else generalErrors.push(e);
  }

  function field(name: string, label: string, value: ReactNode) {
    const err = fieldErrors.get(name);
    return (
      <>
        <dt>{label}</dt>
        <dd>{err ? <span className="error">Unavailable: {err}</span> : (value ?? '-')}</dd>
      </>
    );
  }

  return (
    <section className="device-detail">
      <h2>Device {d?.serialNumber ?? deviceId}</h2>
      {loading && <span>Loading…</span>}
      {generalErrors.length > 0 && <p className="error">{generalErrors.join(', ')}</p>}

      {d && (
        <>
          <dl>
            {field('serialNumber', 'Serial', d.serialNumber)}
            {field('deviceBrandName', 'Brand', d.deviceBrandName)}
            {field('deviceModelMarketingName', 'Model', d.deviceModelMarketingName)}
            {field(
              'IMEIs',
              'IMEIs',
              d.IMEIs?.map((i) => (
                <div key={i.imei}>
                  {i.imei}
                  {i.isPrimary ? ' (primary)' : ''}
                </div>
              )),
            )}
            {field('imsi', 'IMSI', d.imsi)}
            {field('locale', 'Locale', d.locale)}
            {field('state', 'State', d.state?.name)}
            {field(
              'policy',
              'Policy',
              d.policy && (
                <>
                  <Swatch color={d.policy.color} /> {d.policy.name}
                </>
              ),
            )}
            {field('serviceType', 'Service', d.serviceType?.label)}
            {field(
              'lastCheckin',
              d.lastCheckin?.label ?? 'Last check-in',
              d.lastCheckin && (
                <>
                  <Swatch color={d.lastCheckin.color} /> {formatDate(d.lastCheckin.date)}
                </>
              ),
            )}
            {field('firstEnrollAt', 'First enrolled', formatDate(d.firstEnrollAt))}
          </dl>

          <DeviceActions deviceId={deviceId} stateId={d.state?.id} />
        </>
      )}
    </section>
  );
}
