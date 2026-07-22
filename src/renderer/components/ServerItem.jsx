import { useApp } from '../store/AppStore.jsx';

function dotClass(st) {
  return st === 'running' ? 'dot-running' : st === 'error' ? 'dot-error' : 'dot-stopped';
}

export default function ServerItem({ server: s }) {
  const { state, actions } = useApp();
  const st = state.statuses[s.id] || 'stopped';
  const running = st === 'running';
  const info = state.branches[s.id];
  const active = s.id === state.activeId;

  const onCardClick = (e) => {
    if (e.target.closest('.mini')) return; // action buttons handle themselves
    actions.select(s.id);
  };

  const run = () => { actions.select(s.id); window.api.start(s.id); };
  const restart = () => { actions.select(s.id); window.api.restart(s.id); };
  const stop = () => window.api.stop(s.id);
  const edit = () => actions.openModal(s);
  const del = () => { if (confirm(`Delete server "${s.name}"?`)) actions.removeServer(s.id); };

  return (
    <li className={'server-item' + (active ? ' active' : '')} data-id={s.id} draggable onClick={onCardClick}>
      <div className="row1">
        <span className="grip" title="Drag to reorder">⠿</span>
        <span className={'dot ' + dotClass(st)}></span>
        <span className="name" title={s.name}>{s.name}</span>
        {s.port ? (
          <span className="shell-tag" title="Port freed on stop/restart">:{s.port}</span>
        ) : null}
        <span className="shell-tag">{s.shell}</span>
      </div>
      <div className="cmd" title={`${s.folder} — ${s.command}`}>{s.command}</div>
      {info ? (
        <div className="branch" title={`git branch${info.dirty ? ' (uncommitted changes)' : ''}`}>
          ⎇ {info.branch}
          {info.dirty ? <span className="dirty" title="uncommitted changes"> ●</span> : null}
        </div>
      ) : null}
      <div className="actions">
        <button className="mini" data-act="run" onClick={run}>{running ? '▶ Running' : '▶ Run'}</button>
        <button className="mini" data-act="restart" onClick={restart}>⟳</button>
        <button className="mini" data-act="stop" onClick={stop}>■</button>
        <button className="mini icon" data-act="edit" title="Edit" onClick={edit}>✎</button>
        <button className="mini icon" data-act="delete" title="Delete" onClick={del}>🗑</button>
      </div>
    </li>
  );
}
