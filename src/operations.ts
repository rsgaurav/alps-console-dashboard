
export type DeviceState = { id: number; name: string };
export type Policy = { id: string; name: string; color: string };

export const STATES: DeviceState[] = [
  { id: 1, name: 'ENROLLED' },
  { id: 2, name: 'ACTIVE' },
  { id: 3, name: 'LOCKED' },
  { id: 4, name: 'RELEASED' },
];

export type DeviceRow = {
  id: string;
  serialNumber: string;
  modelMarketingName: string;
  brandName: string;
  IMEIs: { imei: string; isPrimary: boolean }[];
  state: DeviceState;
  policy: Policy;
  lastCheckin: string;
};

export type ListDevicesData = {
  listDevices: { pageInfo: { total_count: number }; deviceList: DeviceRow[] };
};

export type ListDevicesVars = {
  tenantId: string;
  imei?: string;
  serialNumber?: string;
  stateId?: number;
  page?: number;
  pageSize?: number;
};

export const LIST_DEVICES = `
  query ListDevices(
    $tenantId: String
    $imei: String
    $serialNumber: String
    $stateId: Int
    $page: Int
    $pageSize: Int
  ) {
    listDevices(
      tenantId: $tenantId
      imei: $imei
      serialNumber: $serialNumber
      stateId: $stateId
      page: $page
      pageSize: $pageSize
    ) {
      pageInfo { total_count }
      deviceList {
        id
        serialNumber
        modelMarketingName
        brandName
        IMEIs { imei isPrimary }
        state { id name }
        policy { id name color }
        lastCheckin
      }
    }
  }
`;

export type DeviceDetail = {
  id: string;
  serialNumber: string | null;
  deviceBrandName: string | null;
  deviceModelMarketingName: string | null;
  IMEIs: { imei: string; isPrimary: boolean }[] | null;
  imsi: string | null;
  locale: string | null;
  state: DeviceState | null;
  policy: Policy | null;
  serviceType: { id: string; name: string; label: string } | null;
  lastCheckin: { label: string; date: string; color: string } | null;
  firstEnrollAt: string | null;
};

export type DeviceDetailData = { deviceDetail: DeviceDetail | null };
export type DeviceDetailVars = { tenantId: string; deviceId: string };

export const DEVICE_DETAIL = `
  query DeviceDetail($tenantId: String!, $deviceId: String!) {
    deviceDetail(tenantId: $tenantId, deviceId: $deviceId) {
      id
      serialNumber
      deviceBrandName
      deviceModelMarketingName
      IMEIs { imei isPrimary }
      imsi
      locale
      state { id name }
      policy { id name color }
      serviceType { id name label }
      lastCheckin { label date color }
      firstEnrollAt
    }
  }
`;

export type HistoryRow = {
  type: string;
  createdAt: string;
  email: string;
  policyName: string;
  nextPolicyName: string;
  actionName: string;
};

export type ListDeviceHistoryData = {
  listDeviceHistory: { pageInfo: { total_count: number }; histories: HistoryRow[] };
};

export type ListDeviceHistoryVars = {
  tenantId: string;
  deviceId: string;
  page?: number;
  pageSize?: number;
};

export const LIST_DEVICE_HISTORY = `
  query ListDeviceHistory($tenantId: String!, $deviceId: String!, $page: Int, $pageSize: Int) {
    listDeviceHistory(tenantId: $tenantId, deviceId: $deviceId, page: $page, pageSize: $pageSize) {
      pageInfo { total_count }
      histories {
        type
        createdAt
        email
        policyName
        nextPolicyName
        actionName
      }
    }
  }
`;

export type Action = {
  id: string;
  actionName: string;
  policyName: string;
  stateId: number;
  serviceName: string;
};

export type ListAvailableActionsData = { listAvailableActions: Action[] };
export type ListAvailableActionsVars = { tenantId: string; stateId: string };

export const LIST_AVAILABLE_ACTIONS = `
  query ListAvailableActions($tenantId: String, $stateId: String) {
    listAvailableActions(tenantId: $tenantId, stateId: $stateId) {
      id
      actionName
      policyName
      stateId
      serviceName
    }
  }
`;

export type AssignActionData = { assignAction: boolean | null };
export type AssignActionVars = { tenantId: string; deviceId: string; actionId: string };

export const ASSIGN_ACTION = `
  mutation AssignAction($tenantId: String!, $deviceId: String!, $actionId: String!) {
    assignAction(tenantId: $tenantId, deviceId: $deviceId, actionId: $actionId)
  }
`;
