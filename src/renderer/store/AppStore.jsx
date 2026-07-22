import { createContext, useContext, useReducer, useRef, useEffect, useCallback, useMemo } from 'react';
import { terminalManager as tm } from '../lib/terminalManager.js';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const initialState = {
  config: { defaultShell: 'cmd', servers: [], theme: 'dark', fontSize: 13 },
  shells: { cmd: true, powershell: true, bash: true },
  statuses: {}, // id -> 'running' | 'stopped' | 'error'
  branches: {}, // id -> { branch, dirty } | null
  activeId: null,
  version: '',
  theme: 'dark',
  fontSize: 13,
  ui: {
    modal: null, // null | { server }  (server null => Add)
    settingsOpen: false,
    settingsTab: 'appearance',
    searchOpen: false,
    searchResult: { index: -1, count: -1 },
    scratchOpen: false,
    scratchWidth: null,
    collapsedGroups: [],
  },
};

function reducer(state, a) {
  switch (a.type) {
    case 'INIT':
      return {
        ...state,
        config: a.config,
        shells: a.shells,
        theme: a.config.theme || 'dark',
        fontSize: a.config.fontSize || 13,
      };
    case 'SET_CONFIG':
      return { ...state, config: a.config };
    case 'SET_VERSION':
      return { ...state, version: a.version };
    case 'SET_STATUS':
      return { ...state, statuses: { ...state.statuses, [a.id]: a.st } };
    case 'SET_BRANCHES':
      return { ...state, branches: a.branches };
    case 'SELECT':
      return { ...state, activeId: a.id };
    case 'SET_THEME':
      return { ...state, theme: a.theme };
    case 'SET_FONT':
      return { ...state, fontSize: a.fontSize };
    case 'TOGGLE_GROUP': {
      const cg = state.ui.collapsedGroups;
      const next = cg.includes(a.name) ? cg.filter((g) => g !== a.name) : [...cg, a.name];
      return { ...state, ui: { ...state.ui, collapsedGroups: next } };
    }
    case 'SET_UI':
      return { ...state, ui: { ...state.ui, ...a.ui } };
    case 'DELETE_SERVER': {
      const statuses = { ...state.statuses };
      const branches = { ...state.branches };
      delete statuses[a.id];
      delete branches[a.id];
      return {
        ...state,
        statuses,
        branches,
        activeId: state.activeId === a.id ? null : state.activeId,
      };
    }
    default:
      return state;
  }
}

const branchKey = (info) => (info ? `${info.branch} ${info.dirty ? 1 : 0}` : '');

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Always-current snapshot so the manager's getters/callbacks read fresh state.
  const stateRef = useRef(state);
  stateRef.current = state;

  const refreshBranches = useCallback(async () => {
    const servers = stateRef.current.config.servers;
    const cur = stateRef.current.branches;
    const next = { ...cur };
    let changed = false;
    await Promise.all(
      servers.map(async (s) => {
        let info = null;
        try {
          info = await window.api.getBranch(s.folder);
        } catch (_) {
          info = null;
        }
        if (branchKey(cur[s.id]) !== branchKey(info)) {
          next[s.id] = info;
          changed = true;
        }
      })
    );
    if (changed) dispatch({ type: 'SET_BRANCHES', branches: next });
  }, []);
  const refreshRef = useRef(refreshBranches);
  refreshRef.current = refreshBranches;

  const select = useCallback((id) => {
    tm.show(id);
    dispatch({ type: 'SELECT', id });
  }, []);

  const actions = useMemo(
    () => ({
      select,
      refreshBranches,
      openModal: (server = null) => dispatch({ type: 'SET_UI', ui: { modal: { server } } }),
      closeModal: () => dispatch({ type: 'SET_UI', ui: { modal: null } }),
      setUi: (ui) => dispatch({ type: 'SET_UI', ui }),
      toggleGroup: (name) => dispatch({ type: 'TOGGLE_GROUP', name }),

      async saveServer(server) {
        const { config, saved } = await window.api.saveServer(server);
        dispatch({ type: 'SET_CONFIG', config });
        select(saved.id);
        window.api.getBranch(saved.folder).then((info) => {
          const next = { ...stateRef.current.branches, [saved.id]: info };
          dispatch({ type: 'SET_BRANCHES', branches: next });
        });
        return saved;
      },
      async removeServer(id) {
        const { config } = await window.api.deleteServer(id);
        tm.dispose(id);
        dispatch({ type: 'DELETE_SERVER', id });
        dispatch({ type: 'SET_CONFIG', config });
      },
      async reorder(ids) {
        const { config } = await window.api.reorder(ids);
        dispatch({ type: 'SET_CONFIG', config });
      },
      async setDefaultShell(value) {
        const { config } = await window.api.setDefaultShell(value);
        dispatch({ type: 'SET_CONFIG', config });
      },
      setTheme(theme) {
        dispatch({ type: 'SET_THEME', theme });
        window.api.setSettings({ theme });
      },
      setFont(fontSize) {
        dispatch({ type: 'SET_FONT', fontSize });
        window.api.setSettings({ fontSize });
      },
    }),
    [select, refreshBranches]
  );

  // One-time bootstrap: wire the manager, subscribe to IPC, load config/version,
  // seed running statuses, start the 4s branch poll. Guarded pieces make the
  // StrictMode double-invocation harmless.
  useEffect(() => {
    tm.init({
      getServers: () => stateRef.current.config.servers,
      getDefaultShell: () => stateRef.current.config.defaultShell,
      getActiveId: () => stateRef.current.activeId,
      onStatusChange: (id, st) => {
        dispatch({ type: 'SET_STATUS', id, st });
        if (st === 'running') refreshRef.current();
      },
      onScratchExit: () => {},
      onSearchResults: (index, count) =>
        dispatch({ type: 'SET_UI', ui: { searchResult: { index, count } } }),
      onRequestSearch: () => dispatch({ type: 'SET_UI', ui: { searchOpen: true } }),
    });
    const unsub = tm.subscribeIpc();

    (async () => {
      const { config, shells } = await window.api.getConfig();
      dispatch({ type: 'INIT', config, shells });
      window.api.getVersion().then((v) => v && dispatch({ type: 'SET_VERSION', version: v }));
      const running = await window.api.runningIds();
      running.forEach((id) => dispatch({ type: 'SET_STATUS', id, st: 'running' }));
      refreshRef.current();
    })();

    const iv = setInterval(() => refreshRef.current(), 4000);
    return () => {
      clearInterval(iv);
      unsub && unsub();
    };
  }, []);

  // Apply theme (CSS vars via data-theme + every terminal) and font size.
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme === 'light' ? 'light' : 'dark';
    tm.setTheme(state.theme);
  }, [state.theme]);
  useEffect(() => {
    tm.setFontSize(state.fontSize);
  }, [state.fontSize]);

  const value = useMemo(() => ({ state, dispatch, actions }), [state, actions]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
