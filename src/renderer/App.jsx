import { useEffect, useRef } from 'react';
import { terminalManager as tm } from './lib/terminalManager.js';

// Stage 1 test harness — proves the TerminalManager works under Vite:
// xterm imported from npm, addons load, IPC streams, fit/theme/font work.
// It auto-opens an interactive scratch shell (no server config needed) and
// streams its output. Replaced by the real App shell in Stage 2.
export default function App() {
  const scratchHostRef = useRef(null);
  const termsHostRef = useRef(null);

  useEffect(() => {
    tm.attach(termsHostRef.current);
    tm.attachScratch(scratchHostRef.current);
    tm.init({
      getServers: () => [],
      getDefaultShell: () => 'cmd',
      getActiveId: () => null,
      onStatusChange: (id, st) => console.log('[stage1] status', id, st),
      onScratchExit: (key) => console.log('[stage1] scratch exit', key),
      onSearchResults: (i, c) => console.log('[stage1] search', i, c),
      onRequestSearch: () => console.log('[stage1] Ctrl+F'),
    });
    const unsub = tm.subscribeIpc();

    // Temporary streaming probe (stdout via ELECTRON_ENABLE_LOGGING).
    const probe = window.api.onData(({ id, data }) =>
      console.log('[stage1] rx', id, `${data.length}b`)
    );

    // Open the global interactive scratch shell to prove end-to-end streaming.
    tm.ensureScratchStarted('');
    requestAnimationFrame(() => tm.fitScratch(''));

    return () => {
      probe && probe();
      unsub && unsub();
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: 8, display: 'flex', gap: 8, alignItems: 'center', flex: '0 0 auto' }}>
        <strong>Stage 1 — TerminalManager</strong>
        <button onClick={() => tm.setTheme('light')}>Light</button>
        <button onClick={() => tm.setTheme('dark')}>Dark</button>
        <button onClick={() => tm.setFontSize(tm.fontSize + 1)}>A+</button>
        <button onClick={() => tm.setFontSize(tm.fontSize - 1)}>A-</button>
      </div>
      {/* Manager-owned hosts: React never renders children inside these. */}
      <div ref={termsHostRef} className="terminals" style={{ display: 'none' }} />
      <div ref={scratchHostRef} className="scratch-term" style={{ flex: '1 1 auto', position: 'relative' }} />
    </div>
  );
}
