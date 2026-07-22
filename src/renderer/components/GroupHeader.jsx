import { FiChevronRight, FiChevronDown, FiPlay, FiRefreshCw, FiSquare } from 'react-icons/fi';
import { useApp } from '../store/AppStore.jsx';
import { mini } from '../ui.js';

export default function GroupHeader({ name, servers }) {
  const { state, actions } = useApp();
  const collapsed = state.ui.collapsedGroups.includes(name);
  const running = servers.filter((s) => (state.statuses[s.id] || 'stopped') === 'running').length;
  const label = name === '' ? 'Ungrouped' : name;

  const groupAct = (act) => {
    if (act === 'run') window.api.runGroup(name);
    else if (act === 'restart') window.api.restartGroup(name);
    else if (act === 'stop') window.api.stopGroup(name);
  };

  const onClick = (e) => {
    if (e.target.closest('.mini')) return;
    actions.toggleGroup(name);
  };

  return (
    <li className="flex items-center gap-[7px] px-2 py-1.5 mx-0.5 mt-2 mb-[5px] cursor-pointer select-none border-b border-l-bd dark:border-d-bd" onClick={onClick}>
      <span className="inline-flex items-center text-l-dim dark:text-d-dim text-[10px] w-[10px]">{collapsed ? <FiChevronRight /> : <FiChevronDown />}</span>
      <span className="text-[11px] tracking-[0.05em] uppercase font-bold text-l-tx dark:text-d-tx flex-1 overflow-hidden text-ellipsis whitespace-nowrap" title={label}>{label}</span>
      <span className="text-l-dim dark:text-d-dim text-[10.5px]">{running}/{servers.length}</span>
      <span className="flex gap-[3px]">
        <button className={`${mini} flex-none px-[7px] py-0.5`} title="Run group" onClick={() => groupAct('run')}><FiPlay /></button>
        <button className={`${mini} flex-none px-[7px] py-0.5`} title="Restart group" onClick={() => groupAct('restart')}><FiRefreshCw /></button>
        <button className={`${mini} flex-none px-[7px] py-0.5`} title="Stop group" onClick={() => groupAct('stop')}><FiSquare /></button>
      </span>
    </li>
  );
}
