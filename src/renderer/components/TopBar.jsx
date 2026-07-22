import { FiPlay, FiRefreshCw, FiSquare, FiPlus, FiSettings } from 'react-icons/fi';
import { useApp } from '../store/AppStore.jsx';
import UpdateBanner from './UpdateBanner.jsx';
import { btnRun, btnRestart, btnStop, btnAdd, btnIcon, select } from '../ui.js';

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
    <header className="flex items-center justify-between gap-3 px-3.5 py-2 flex-none bg-l-bg2 dark:bg-d-bg2 border-b border-l-bd dark:border-d-bd">
      <div className="flex items-center gap-2 font-semibold">
        <span className="text-accentL dark:text-accent text-base">▚</span>
        <span>IV Server Manager</span>
        <span className="text-l-dim dark:text-d-dim text-[11px] font-normal ml-0.5">{version ? `v${version}` : ''}</span>
      </div>

      <UpdateBanner />

      <div className="flex items-center gap-2">
        <button className={btnRun} title="Start every server" onClick={runAll}><FiPlay /> Run All</button>
        <button className={btnRestart} title="Restart every server" onClick={restartAll}><FiRefreshCw /> Restart All</button>
        <button className={btnStop} title="Stop every server" onClick={stopAll}><FiSquare /> Stop All</button>
        <span className="w-px h-[22px] bg-l-bd dark:bg-d-bd mx-1"></span>
        <label className="text-l-dim dark:text-d-dim flex items-center gap-1.5">
          Default shell
          <select className={select} value={config.defaultShell} onChange={(e) => actions.setDefaultShell(e.target.value)}>
            {Object.keys(shells).map((sh) => (
              <option key={sh} value={sh} disabled={!shells[sh]}>
                {shells[sh] ? sh : `${sh} (not found)`}
              </option>
            ))}
          </select>
        </label>
        <button className={btnAdd} title="Add a new server" onClick={() => actions.openModal(null)}>
          <FiPlus /> Add Server
        </button>
        <button
          className={btnIcon}
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
