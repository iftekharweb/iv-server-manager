import { useEffect, useState } from 'react';

// Stage 0 scaffold page. Proves: React renders under Vite in Electron, the
// preload `window.api` bridge reaches React, and dev/build/package all boot.
// Replaced by the real UI in later stages.
export default function App() {
  const [version, setVersion] = useState('');

  useEffect(() => {
    if (window.api && window.api.getVersion) {
      window.api.getVersion().then((v) => v && setVersion(v));
    }
  }, []);

  return (
    <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}>
      <h1>IV Server Manager</h1>
      <p>React + Vite renderer — scaffold OK.</p>
      <p>
        App version via IPC bridge: <strong>{version || '…'}</strong>
      </p>
    </div>
  );
}
