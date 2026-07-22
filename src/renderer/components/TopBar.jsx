import { FiPlay, FiRefreshCw, FiSquare, FiPlus, FiSettings } from 'react-icons/fi';
import { useApp } from '../store/AppStore.jsx';
import UpdateBanner from './UpdateBanner.jsx';

export default function TopBar() {
  const { state, actions } = useApp();
  const { config, shells, statuses, version } = state;

  const runAll = () => window.api.runAll();
  const restartAll = () => {
    const n = config.servers.length;
    if (n && confirm(`Restart all ${n} server(s)?`)) window.api.restartAll();
  };
  const stopAll = () => {
    const running = Object.values(statuses).filter((s) => s === 'running').length;
    if (running && confirm(`Stop all ${running} running server(s)?`)) window.api.stopAll();
  };

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">▚</span>
        <span className="brand-name">IV Server Manager</span>
        <span className="app-version">{version ? `v${version}` : ''}</span>
      </div>

      <UpdateBanner />

      <div className="top-actions">
        <button className="btn btn-run" title="Start every server" onClick={runAll}><FiPlay /> Run All</button>
        <button className="btn btn-restart" title="Restart every server" onClick={restartAll}><FiRefreshCw /> Restart All</button>
        <button className="btn btn-stop" title="Stop every server" onClick={stopAll}><FiSquare /> Stop All</button>
        <span className="divider"></span>
        <label className="shell-label">
          Default shell
          <select
            className="select"
            value={config.defaultShell}
            onChange={(e) => actions.setDefaultShell(e.target.value)}
          >
            {Object.keys(shells).map((sh) => (
              <option key={sh} value={sh} disabled={!shells[sh]}>
                {shells[sh] ? sh : `${sh} (not found)`}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-add" title="Add a new server" onClick={() => actions.openModal(null)}>
          <FiPlus /> Add Server
        </button>
        <button
          className="btn btn-icon"
          title="Settings"
          aria-label="Settings"
          onClick={() => actions.setUi({ settingsOpen: true, settingsTab: 'appearance' })}
        >
          <FiSettings />
        </button>
      </div>
    </header>
  );
}
