import { useEffect, useRef } from 'react';
import { FiTerminal, FiX, FiChevronsRight } from 'react-icons/fi';
import { useApp } from '../store/AppStore.jsx';
import { terminalManager as tm } from '../lib/terminalManager.js';

export default function ScratchDock() {
  const { state, actions } = useApp();
  const open = state.ui.scratchOpen;
  const activeKey = state.activeId || '';
  const mountRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    tm.attachScratch(mountRef.current);
  }, []);

  // Auto-follow the active server while the dock is open: show that server's
  // scratch (spawn once). Never kills another server's running command.
  useEffect(() => {
    if (!open) return;
    tm.ensureScratchStarted(activeKey);
    requestAnimationFrame(() => tm.fitScratch(activeKey));
  }, [open, activeKey]);

  // Resizer drag → set dock width + refit.
  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current) return;
      const w = Math.min(window.innerWidth * 0.5, Math.max(300, window.innerWidth - e.clientX));
      actions.setUi({ scratchWidth: w });
      tm.fitScratch(state.activeId || '');
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      tm.fitScratch(state.activeId || '');
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [actions, state.activeId]);

  const expand = () => {
    actions.setUi({ scratchOpen: true });
    tm.ensureScratchStarted(activeKey);
    requestAnimationFrame(() => {
      tm.fitScratch(activeKey);
      tm.focusScratch(activeKey);
    });
  };
  const collapse = () => actions.setUi({ scratchOpen: false });
  const clear = () => tm.clearScratch(activeKey);
  const startResize = (e) => {
    draggingRef.current = true;
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
  };

  const server = state.config.servers.find((s) => s.id === state.activeId) || null;
  const cwd = (server ? server.folder : '') || '(home)';
  const widthStyle = open && state.ui.scratchWidth ? { width: `${state.ui.scratchWidth}px` } : undefined;

  return (
    <section className={'scratch-dock' + (open ? '' : ' collapsed')} style={widthStyle}>
      <div className="scratch-resizer" title="Drag to resize" onMouseDown={startResize}></div>
      <button className="scratch-rail" title="Open a terminal" onClick={expand}><FiTerminal /> Terminal</button>
      <div className="scratch-body">
        <div className="scratch-head">
          <div className="scratch-title">
            <span><FiTerminal /> Terminal</span>
            <span className="scratch-cwd">{cwd}</span>
          </div>
          <div className="scratch-actions">
            <button className="btn btn-ghost" title="Clear" onClick={clear}><FiX /> Clear</button>
            <button className="btn btn-ghost" title="Minimize" onClick={collapse}><FiChevronsRight /> Hide</button>
          </div>
        </div>
        {/* Manager appends the per-server scratch .term-host children here. */}
        <div className="scratch-term">
          <div className="scratch-mount" ref={mountRef} />
        </div>
      </div>
    </section>
  );
}
