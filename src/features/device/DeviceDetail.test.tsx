import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearCache } from '../../graphql/cache';
import { mockGraphQL } from '../../test/fetchMock';
import { TenantProvider } from '../../tenant/TenantContext';
import { DeviceDetail } from './DeviceDetail';

afterEach(() => {
  cleanup();
  clearCache();
  vi.unstubAllGlobals();
});

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dev-1',
    serialNumber: 'SN-1',
    deviceBrandName: 'Nokia',
    deviceModelMarketingName: 'G22',
    IMEIs: [{ imei: '111', isPrimary: true }],
    imsi: '2140',
    locale: 'en-GB',
    state: { id: 2, name: 'ACTIVE' },
    policy: { id: 'pol-1', name: 'Financing Baseline', color: '#2f8f4e' },
    serviceType: { id: '1', name: 'DEVICE_FINANCING', label: 'Device Financing' },
    lastCheckin: { label: 'Last seen', date: new Date().toISOString(), color: '#2f8f4e' },
    firstEnrollAt: new Date().toISOString(),
    ...overrides,
  };
}

const lockAction = {
  id: 'act-lock',
  actionName: 'Lock device',
  policyName: 'Hard Lock',
  stateId: 3,
  serviceName: 'DEVICE_FINANCING',
};

function renderDetail() {
  return render(
    <TenantProvider>
      <DeviceDetail deviceId="dev-1" />
    </TenantProvider>,
  );
}

describe('DeviceDetail', () => {
  it('sends the tenant with every request', async () => {
    const { calls } = mockGraphQL({
      DeviceDetail: () => ({ data: { deviceDetail: detail() } }),
      ListAvailableActions: () => ({ data: { listAvailableActions: [] } }),
    });
    renderDetail();
    await screen.findByText('No actions available.');
    expect(calls.length).toBeGreaterThan(0);
    calls.forEach((c) => expect(c.variables.tenantId).toBe('tenant-alpha'));
  });

  it('shows partial data with the failed fields marked', async () => {
    mockGraphQL({
      DeviceDetail: () => ({
        data: { deviceDetail: detail({ imsi: null, policy: null }) },
        errors: [
          { message: 'Subscriber record unavailable', path: ['deviceDetail', 'imsi'] },
          { message: 'Policy service timed out', path: ['deviceDetail', 'policy'] },
        ],
      }),
      ListAvailableActions: () => ({ data: { listAvailableActions: [] } }),
    });
    renderDetail();
    expect(await screen.findByText('Unavailable: Subscriber record unavailable')).toBeTruthy();
    expect(screen.getByText('Unavailable: Policy service timed out')).toBeTruthy();
    expect(screen.getByText('Nokia')).toBeTruthy();
  });

  it('applies an action optimistically and rolls back when it fails', async () => {
    let finish!: () => void;
    mockGraphQL({
      DeviceDetail: () => ({ data: { deviceDetail: detail() } }),
      ListAvailableActions: (vars) => ({
        data: { listAvailableActions: vars.stateId === '2' ? [lockAction] : [] },
      }),
      AssignAction: () =>
        new Promise((resolve) => {
          finish = () =>
            resolve({ errors: [{ message: 'Device is already locked (state transition rejected)' }] });
        }),
    });
    renderDetail();

    fireEvent.click(await screen.findByText('Lock device'));
    expect(await screen.findByText('LOCKED')).toBeTruthy();

    finish();
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Device is already locked (state transition rejected)',
    );
    await waitFor(() => expect(screen.getByText('ACTIVE')).toBeTruthy());
  });
});
