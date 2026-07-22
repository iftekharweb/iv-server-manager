import { FiPlay, FiRefreshCw, FiSquare, FiEdit2, FiTrash2, FiGitBranch } from 'react-icons/fi';
import { RxDragHandleDots2 } from 'react-icons/rx';
import { useApp } from '../store/AppStore.jsx';
import { mini, dotClass, dotBase } from '../ui.js';

// `server-item` is kept as a marker class only (querySelector hook for drag-reorder).
const ITEM_BASE =
  'server-item border rounded-lg px-2.5 py-[9px] mb-1.5 cursor-pointer bg-l-bg3 dark:bg-d-bg3';
const ITEM_IDLE = 'border-transparent hover:border-l-bd dark:hover:border-d-bd';
const ITEM_ACTIVE = 'border-accentL dark:border-accent bg-l-ac dark:bg-d-ac';
const TAG = 'text-[10.5px] text-l-dim dark:text-d-dim border border-l-bd dark:border-d-bd rounded px-[5px]';

export default function ServerItem({ server: s }) {
  const { state, actions } = useApp();
  const st = state.statuses[s.id] || 'stopped';
  const running = st === 'running';
  const info = state.branches[s.id];
  const active = s.id === state.activeId;

  const onCardClick = (e) => {
    if (e.target.closest('.mini')) return;
    actions.select(s.id);
  };

  const run = () => { actions.select(s.id); window.api.start(s.id); };
  const restart = () => { actions.select(s.id); window.api.restart(s.id); };
  const stop = () => window.api.stop(s.id);
  const edit = () => actions.openModal(s);
  const del = () => { if (confirm(`Delete server "${s.name}"?`)) actions.removeServer(s.id); };

  return (
    <li className={`${ITEM_BASE} ${active ? ITEM_ACTIVE : ITEM_IDLE}`} data-id={s.id} draggable onClick={onCardClick}>
      <div className="flex items-center gap-2">
        <span className="mini-grip inline-flex items-center text-grayL dark:text-gray cursor-grab text-[12px] leading-none mr-0.5" title="Drag to reorder"><RxDragHandleDots2 /></span>
        <span className={`${dotBase} ${dotClass(st)}`}></span>
        <span className="font-semibold flex-1 overflow-hidden text-ellipsis whitespace-nowrap" title={s.name}>{s.name}</span>
        {s.port ? <span className={TAG} title="Port freed on stop/restart">:{s.port}</span> : null}
        <span className={TAG}>{s.shell}</span>
      </div>
      <div className="text-l-dim dark:text-d-dim text-[11px] mt-1 overflow-hidden text-ellipsis whitespace-nowrap" title={`${s.folder} — ${s.command}`}>{s.command}</div>
      {info ? (
        <div className="flex items-center gap-1 text-l-atx dark:text-d-atx text-[10.5px] mt-[3px] overflow-hidden text-ellipsis whitespace-nowrap" title={`git branch${info.dirty ? ' (uncommitted changes)' : ''}`}>
          <FiGitBranch /> {info.branch}
          {info.dirty ? <span className="text-amberL dark:text-amber text-[9px] align-middle" title="uncommitted changes"> ●</span> : null}
        </div>
      ) : null}
      <div className="flex gap-1 mt-2">
        <button className={`mini ${mini} flex-1`} onClick={run}><FiPlay /> {running ? 'Running' : 'Run'}</button>
        <button className={`mini ${mini} flex-1`} title="Restart" onClick={restart}><FiRefreshCw /></button>
        <button className={`mini ${mini} flex-1`} title="Stop" onClick={stop}><FiSquare /></button>
        <button className={`mini ${mini} flex-none basis-7`} title="Edit" onClick={edit}><FiEdit2 /></button>
        <button className={`mini ${mini} flex-none basis-7`} title="Delete" onClick={del}><FiTrash2 /></button>
      </div>
    </li>
  );
}
