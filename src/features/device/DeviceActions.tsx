import { useState } from 'react';
import { invalidate, patch } from '../../graphql/cache';
import { useTenant } from '../../hooks/useTenant';
import { useTenantMutation } from '../../hooks/useTenantMutation';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import {
  ASSIGN_ACTION,
  LIST_AVAILABLE_ACTIONS,
  STATES,
  type Action,
  type AssignActionData,
  type AssignActionVars,
  type DeviceDetailData,
  type DeviceState,
  type ListAvailableActionsData,
  type ListAvailableActionsVars,
  type ListDevicesData,
} from '../../operations';

type Props = {
  deviceId: string;
  stateId?: number;
};

function withState(data: unknown, deviceId: string, state: DeviceState): unknown {
  const detail = data as DeviceDetailData;
  if (detail?.deviceDetail?.id === deviceId) {
    return { ...detail, deviceDetail: { ...detail.deviceDetail, state } };
  }
  const list = data as ListDevicesData;
  if (list?.listDevices?.deviceList) {
    return {
      ...list,
      listDevices: {
        ...list.listDevices,
        deviceList: list.listDevices.deviceList.map((row) =>
          row.id === deviceId ? { ...row, state } : row,
        ),
      },
    };
  }
  return data;
}

export function DeviceActions({ deviceId, stateId }: Props) {
  const { tenantId } = useTenant();
  const [pendingId, setPendingId] = useState<string>();
  const [error, setError] = useState<string>();

  const actions = useTenantQuery<ListAvailableActionsData, ListAvailableActionsVars>(
    LIST_AVAILABLE_ACTIONS,
    {
      variables: { stateId: String(stateId) },
      fetchFirst: stateId !== undefined,
      queryKey: `device:${deviceId}:actions`,
    },
  );

  // throwError so a rejected transition reaches the catch below and the
  // optimistic update gets rolled back
  const { mutateData } = useTenantMutation<AssignActionData, AssignActionVars>(ASSIGN_ACTION, {
    throwError: true,
  });

  async function run(action: Action) {
    if (pendingId) return;
    setPendingId(action.id);
    setError(undefined);

    const nextState = STATES.find((s) => s.id === action.stateId) ?? {
      id: action.stateId,
      name: action.actionName,
    };
    const update = (data: unknown) => withState(data, deviceId, nextState);
    const rollbacks = [
      patch(`${tenantId}:device:${deviceId}:detail`, update),
      patch(`${tenantId}:devices`, update),
    ];

    try {
      const res = await mutateData({ deviceId, actionId: action.id });
      if (!res?.assignAction) throw new Error(`${action.actionName} was not applied`);
    } catch (e) {
      rollbacks.forEach((rollback) => rollback());
      setError((e as Error).message);
    } finally {
      setPendingId(undefined);
      // either way, get the real state, policy and history from the server
      invalidate(`${tenantId}:device:${deviceId}:`);
      invalidate(`${tenantId}:devices`);
    }
  }

  const list = actions.data?.listAvailableActions ?? [];

  return (
    <div className="device-actions">
      <h3>Actions</h3>
      {actions.loading && <span>Loading…</span>}
      {actions.errors.length > 0 && <p className="error">{actions.errors.join(', ')}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!actions.loading && actions.data && list.length === 0 && <p>No actions available.</p>}
      <div className="buttons">
        {list.map((a) => (
          <button
            key={a.id}
            disabled={!!pendingId}
            onClick={() => run(a)}
            title={`Applies policy: ${a.policyName}`}
          >
            {pendingId === a.id ? `${a.actionName}…` : a.actionName}
          </button>
        ))}
      </div>
    </div>
  );
}
