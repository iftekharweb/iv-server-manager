import { useEffect, useRef, useState } from 'react';
import { FiCopy, FiX, FiDownload } from 'react-icons/fi';
import { useApp } from '../store/AppStore.jsx';
import { terminalManager as tm } from '../lib/terminalManager.js';
import SearchBar from './SearchBar.jsx';
import { btnGhost, dotClass, dotBase } from '../ui.js';

export default function TerminalPanel() {
  const { state, actions } = useApp();
  const { activeId } = state;
  const mountRef = useRef(null);
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [saveLabel, setSaveLabel] = useState('Save');

  useEffect(() => {
    tm.attach(mountRef.current);
  }, []);

  // Global Ctrl/Cmd+F opens search when focus isn't inside a terminal (the
  // manager intercepts it while a terminal has focus via onRequestSearch).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (tm.hasSearchTarget(state.activeId, state.ui.scratchOpen)) {
          actions.setUi({ searchOpen: true });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.activeId, state.ui.scratchOpen, actions]);

  const server = state.config.servers.find((s) => s.id === activeId) || null;
  const st = server ? state.statuses[server.id] || 'stopped' : null;
  const info = server ? state.branches[server.id] : null;

  const flash = (setter, base, msg) => {
    setter(msg);
    setTimeout(() => setter(base), 1000);
  };

  const onCopy = () => {
    const r = tm.copy(activeId);
    if (r) flash(setCopyLabel, 'Copy', r.mode === 'selection' ? 'Copied selection' : 'Copied all');
  };
  const onClear = () => tm.clear(activeId);
  const onSave = async () => {
    if (!activeId) return;
    const res = await tm.save(activeId, server ? server.name : 'server');
    if (res && res.saved) flash(setSaveLabel, 'Save', 'Saved!');
  };

  const branchTxt = info ? ` · ⎇ ${info.branch}${info.dirty ? ' ●' : ''}` : '';

  return (
    <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-l-bg dark:bg-d-bg">
      <div className="flex items-center justify-between px-3.5 py-[9px] border-b border-l-bd dark:border-d-bd bg-l-bg2 dark:bg-d-bg2">
        <div className="flex items-center gap-[9px] font-semibold min-w-0">
          <span className={`${dotBase} ${server ? dotClass(st) : 'bg-grayL dark:bg-gray'}`}></span>
          <span>{server ? server.name : 'No server selected'}</span>
          <span className="text-l-dim dark:text-d-dim font-normal text-[11.5px]">
            {server ? `· ${st} · ${server.shell}${branchTxt} · ${server.command}` : ''}
          </span>
        </div>
        <div className="flex gap-1.5">
          <button className={btnGhost} title="Copy selection, or all logs if nothing is selected" onClick={onCopy}><FiCopy /> {copyLabel}</button>
          <button className={btnGhost} title="Clear the view" onClick={onClear}><FiX /> Clear</button>
          <button className={btnGhost} title="Save logs to a file" onClick={onSave}><FiDownload /> {saveLabel}</button>
        </div>
      </div>
      <div className="flex-1 relative min-h-0">
        {/* Manager appends .term-host children here; React keeps it empty. */}
        <div className="absolute inset-0" ref={mountRef} />
        {!activeId && (
          <div className="absolute inset-0 flex items-center justify-center text-l-dim dark:text-d-dim text-center p-5">Select a server, then press Run to see its live output here.</div>
        )}
        {state.ui.searchOpen && <SearchBar />}
      </div>
    </main>
  );
}
