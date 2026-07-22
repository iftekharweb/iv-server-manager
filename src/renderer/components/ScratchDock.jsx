import { useEffect, useRef } from 'react';
import { FiTerminal, FiX, FiChevronsRight } from 'react-icons/fi';
import { useApp } from '../store/AppStore.jsx';
import { terminalManager as tm } from '../lib/terminalManager.js';
import { btnGhost } from '../ui.js';

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
    <section
      className={
        'relative flex-none flex flex-col min-h-0 bg-l-term dark:bg-d-term border-l border-l-bd dark:border-d-bd ' +
        (open ? 'w-[42vw] max-w-[50vw] min-w-[300px]' : 'w-9 min-w-9')
      }
      style={widthStyle}
    >
      <div
        className={(open ? '' : 'hidden ') + 'absolute -left-[3px] top-0 bottom-0 w-1.5 cursor-col-resize z-[5] hover:bg-accent/50'}
        title="Drag to resize"
        onMouseDown={startResize}
      ></div>
      <button
        className={
          (open ? 'hidden ' : 'inline-flex ') +
          'w-9 h-full border-0 cursor-pointer items-center justify-center gap-1.5 [writing-mode:vertical-rl] [text-orientation:mixed] text-[12px] tracking-[0.08em] ' +
          'bg-l-bg2 dark:bg-d-bg2 text-l-dim dark:text-d-dim hover:bg-l-bg3 dark:hover:bg-d-bg3 hover:text-l-tx dark:hover:text-d-tx'
        }
        title="Open a terminal"
        onClick={expand}
      >
        <FiTerminal /> Terminal
      </button>
      <div className={(open ? 'flex ' : 'hidden ') + 'flex-col flex-1 min-h-0'}>
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-l-bd dark:border-d-bd bg-l-bg2 dark:bg-d-bg2">
          <div className="flex items-baseline gap-2 font-semibold min-w-0">
            <span className="inline-flex items-center gap-1.5"><FiTerminal /> Terminal</span>
            <span className="text-l-dim dark:text-d-dim font-normal text-[11px] overflow-hidden text-ellipsis whitespace-nowrap [direction:rtl] max-w-[40vw]">{cwd}</span>
          </div>
          <div className="flex gap-1.5 flex-none">
            <button className={btnGhost} title="Clear" onClick={clear}><FiX /> Clear</button>
            <button className={btnGhost} title="Minimize" onClick={collapse}><FiChevronsRight /> Hide</button>
          </div>
        </div>
        {/* Manager appends the per-server scratch .term-host children here. */}
        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0" ref={mountRef} />
        </div>
      </div>
    </section>
  );
}
