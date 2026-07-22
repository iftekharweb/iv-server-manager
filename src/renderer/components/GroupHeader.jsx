import { FiChevronRight, FiChevronDown, FiPlay, FiRefreshCw, FiSquare } from 'react-icons/fi';
import { useApp } from '../store/AppStore.jsx';

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
    <li className={'group-head' + (collapsed ? ' collapsed' : '')} onClick={onClick}>
      <span className="caret">{collapsed ? <FiChevronRight /> : <FiChevronDown />}</span>
      <span className="group-name" title={label}>{label}</span>
      <span className="group-count">{running}/{servers.length}</span>
      <span className="group-actions">
        <button className="mini" data-gact="run" title="Run group" onClick={() => groupAct('run')}><FiPlay /></button>
        <button className="mini" data-gact="restart" title="Restart group" onClick={() => groupAct('restart')}><FiRefreshCw /></button>
        <button className="mini" data-gact="stop" title="Stop group" onClick={() => groupAct('stop')}><FiSquare /></button>
      </span>
    </li>
  );
}
