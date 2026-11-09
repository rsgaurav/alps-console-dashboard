import { useState } from 'react';
import { DeviceDetail } from './features/device/DeviceDetail';
import { HistoryList } from './features/device/HistoryList';
import { DeviceList } from './features/devices/DeviceList';
import { TenantProvider, TenantSwitcher } from './tenant/TenantContext';
import './App.css';

// lives inside TenantProvider, so it remounts (and selection resets) on
// tenant switch
function Console() {
  const [selectedId, setSelectedId] = useState<string>();

  return (
    <main className="console">
      <header>
        <h1>ALPS Device Console</h1>
        <TenantSwitcher />
      </header>
      <DeviceList selectedId={selectedId} onSelect={setSelectedId} />
      {selectedId && (
        // keyed so history page, action errors etc. reset per device
        <div className="device-panel" key={selectedId}>
          <DeviceDetail deviceId={selectedId} />
          <HistoryList deviceId={selectedId} />
        </div>
      )}
    </main>
  );
}

export default function App() {
  return (
    <TenantProvider>
      <Console />
    </TenantProvider>
  );
}
