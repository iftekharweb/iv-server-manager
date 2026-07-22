import TopBar from './components/TopBar.jsx';
import ServerList from './components/ServerList.jsx';
import TerminalPanel from './components/TerminalPanel.jsx';
import ScratchDock from './components/ScratchDock.jsx';
import AddEditModal from './components/AddEditModal.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { useApp } from './store/AppStore.jsx';

export default function App() {
  const { state } = useApp();
  return (
    <div id="app">
      <TopBar />
      <div className="body">
        <ServerList />
        <TerminalPanel />
        <ScratchDock />
      </div>
      {state.ui.modal && <AddEditModal />}
      {state.ui.settingsOpen && <SettingsModal />}
    </div>
  );
}
