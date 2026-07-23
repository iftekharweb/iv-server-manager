// TerminalManager — the imperative xterm engine, kept OUTSIDE React.
//
// React owns all chrome + declarative state; this singleton owns the xterm
// instances, their DOM hosts, the copy/save buffer side-channel, IPC data/state
// routing, fit/resize, and theme/font application. React drives it through the
// small API below and hands it two container elements (the server-terminals host
// and the scratch host) via attach()/attachScratch().
//
// Why imperative: terminals must persist across selection (toggle `.visible`,
// never unmount) and are created lazily on incoming IPC data even for UNSELECTED
// servers — output must be captured before the user ever opens them. That fights
// React's mount/unmount model, and FitAddon + ResizeObserver + rAF timing is
// coupled to CSS visibility, not React commits. So the engine lives here.

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';

export const FONT_MIN = 10;
export const FONT_MAX = 20;
const MAX_BUFFER = 500000; // chars kept per server for copy/save

const SEARCH_DECOR = {
  decorations: {
    matchBackground: '#5b8cff66',
    activeMatchBackground: '#d29922',
    matchOverviewRuler: '#5b8cff',
    activeMatchColorOverviewRuler: '#d29922',
  },
};

const XTERM_THEME_DARK = {
  background: '#0d0f14',
  foreground: '#e6e9ef',
  cursor: '#5b8cff',
  selectionBackground: '#33415e',
  black: '#12141a', red: '#f85149', green: '#3fb950', yellow: '#d29922',
  blue: '#5b8cff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#e6e9ef',
};

const XTERM_THEME_LIGHT = {
  background: '#ffffff',
  foreground: '#1f2328',
  cursor: '#0969da',
  selectionBackground: '#b6d7ff',
  black: '#24292f', red: '#cf222e', green: '#1a7f37', yellow: '#9a6700',
  blue: '#0969da', magenta: '#8250df', cyan: '#1b7c83', white: '#6e7781',
};

function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
}

class TerminalManager {
  constructor() {
    /** id -> { term, fit, search, host, resizeObs, buffer } */
    this.terms = new Map();
    /** serverId ('' = global) -> { term, fit, search, host, resizeObs, started, cwd } */
    this.scratches = new Map();
    this.theme = 'dark';
    this.fontSize = 13;
    this.termsHost = null;
    this.scratchHost = null;
    this.cb = {};
    this._ipcUnsub = null;
    this._ipcSubscribed = false;
  }

  // ---------- wiring ----------
  /**
   * @param {object} cb
   *  getServers()      -> current servers array
   *  getDefaultShell() -> default shell string
   *  getActiveId()     -> selected server id or null
   *  onStatusChange(id, state)  server pty state change ('running'|'stopped'|'error')
   *  onScratchExit(key)         a scratch pty stopped
   *  onSearchResults(index, count)
   *  onRequestSearch()          Ctrl/Cmd+F pressed inside a terminal
   */
  init(cb = {}) {
    // Idempotent: refresh callbacks on every call (safe under StrictMode re-run).
    this.cb = { ...this.cb, ...cb };
  }

  subscribeIpc() {
    if (this._ipcSubscribed) return this._ipcUnsub;
    this._ipcSubscribed = true;
    const offData = window.api.onData(({ id, data }) => this.handleData(id, data));
    const offState = window.api.onState(({ id, state }) => this.handleState(id, state));
    this._ipcUnsub = () => {
      offData && offData();
      offState && offState();
      this._ipcSubscribed = false;
      this._ipcUnsub = null;
    };
    return this._ipcUnsub;
  }

  attach(hostEl) {
    this.termsHost = hostEl;
    // Re-home any hosts created before attach (or orphaned by HMR).
    this.terms.forEach((e) => { if (e.host.parentNode !== hostEl) hostEl.appendChild(e.host); });
  }

  attachScratch(hostEl) {
    this.scratchHost = hostEl;
    this.scratches.forEach((e) => { if (e.host.parentNode !== hostEl) hostEl.appendChild(e.host); });
  }

  // ---------- scratch id helpers ----------
  get scratchPrefix() {
    return (window.api && window.api.scratchPrefix) || '__scratch__';
  }
  scratchIdFor(key) { return this.scratchPrefix + (key || ''); }
  isScratchPtyId(id) { return typeof id === 'string' && id.startsWith(this.scratchPrefix); }
  scratchKeyFromPtyId(id) { return id.slice(this.scratchPrefix.length); }

  // ---------- theme / font ----------
  xtermTheme() { return this.theme === 'light' ? XTERM_THEME_LIGHT : XTERM_THEME_DARK; }

  _forEachTerm(fn) {
    this.terms.forEach((e) => e.term && fn(e.term));
    this.scratches.forEach((e) => e.term && fn(e.term));
  }

  setTheme(theme) {
    this.theme = theme === 'light' ? 'light' : 'dark';
    const t = this.xtermTheme();
    this._forEachTerm((term) => { term.options.theme = t; });
  }

  setFontSize(n) {
    this.fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, parseInt(n, 10) || 13));
    this._forEachTerm((term) => { term.options.fontSize = this.fontSize; });
    this.terms.forEach((e) => this._refit(e, e.host.dataset.id));
    this.scratches.forEach((e, key) => this._refit(e, this.scratchIdFor(key)));
    return this.fontSize;
  }

  _refit(entry, ptyId) {
    if (!entry.fit) return;
    try {
      entry.fit.fit();
      window.api.resize(ptyId, entry.term.cols, entry.term.rows);
    } catch (_) { /* ignore */ }
  }

  // ---------- addon wiring (shared by server + scratch terminals) ----------
  _loadCommonAddons(term) {
    term.attachCustomKeyEventHandler((e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key && e.key.toLowerCase() === 'f') {
        if (e.type === 'keydown') this.cb.onRequestSearch && this.cb.onRequestSearch();
        return false; // don't forward ^F to the shell
      }
      return true;
    });
    term.loadAddon(new WebLinksAddon((_e, uri) => window.api.openExternal(uri)));
    const search = new SearchAddon();
    term.loadAddon(search);
    if (search.onDidChangeResults) {
      search.onDidChangeResults(({ resultIndex, resultCount }) => {
        this.cb.onSearchResults && this.cb.onSearchResults(resultIndex, resultCount);
      });
    }
    return search;
  }

  _makeTerm() {
    return new Terminal({
      fontFamily: 'Consolas, "Cascadia Mono", monospace',
      fontSize: this.fontSize,
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true, // required for search-match decorations (highlighting)
      theme: this.xtermTheme(),
    });
  }

  // ---------- server terminals ----------
  ensureTerm(id) {
    if (this.terms.get(id)) return this.terms.get(id);

    const host = document.createElement('div');
    // Tailwind: fills the .term-mount layer; hidden until shown; xterm fills it.
    host.className =
      'absolute inset-0 hidden pt-1.5 pr-1 pb-1 pl-2 [&_.xterm]:h-full ' +
      '[&_.xterm-viewport]:[scrollbar-width:none] [&_.xterm-viewport::-webkit-scrollbar]:hidden';
    host.dataset.id = id;
    if (this.termsHost) this.termsHost.appendChild(host);

    const term = this._makeTerm();
    const fit = new FitAddon();
    term.loadAddon(fit);
    const search = this._loadCommonAddons(term);
    term.open(host);
    term.onData((data) => window.api.sendInput(id, data));

    const resizeObs = new ResizeObserver(() => {
      if (!host.classList.contains('hidden')) this._refit(this.terms.get(id), id);
    });
    resizeObs.observe(host);

    const entry = { term, fit, search, host, resizeObs, buffer: '' };
    this.terms.set(id, entry);
    return entry;
  }

  /** Show one server terminal, hide the rest; fit + focus after paint. */
  show(id) {
    const entry = this.ensureTerm(id);
    this.terms.forEach((t, tid) => t.host.classList.toggle('hidden', tid !== id));
    requestAnimationFrame(() => {
      this._refit(entry, id);
      entry.term.focus();
    });
    return entry;
  }

  copy(id) {
    const entry = this.terms.get(id);
    if (!entry) return null;
    const hasSel = entry.term.hasSelection();
    const text = hasSel ? entry.term.getSelection() : stripAnsi(entry.buffer);
    window.api.copyText(text);
    return { mode: hasSel ? 'selection' : 'all' };
  }

  clear(id) {
    const entry = this.terms.get(id);
    if (!entry) return;
    entry.term.clear();
    entry.buffer = '';
  }

  async save(id, serverName) {
    const entry = this.terms.get(id);
    if (!entry) return { saved: false };
    return window.api.saveLogs(serverName || 'server', stripAnsi(entry.buffer));
  }

  dispose(id) {
    const t = this.terms.get(id);
    if (t) {
      t.resizeObs && t.resizeObs.disconnect();
      t.host.remove();
      t.term.dispose();
      this.terms.delete(id);
    }
    const sc = this.scratches.get(id);
    if (sc) {
      sc.resizeObs && sc.resizeObs.disconnect();
      sc.host.remove();
      sc.term.dispose();
      this.scratches.delete(id);
    }
  }

  statusOfKnown() { /* statuses live in React; manager forwards via onStatusChange */ }

  // ---------- IPC routing ----------
  handleData(id, data) {
    if (this.isScratchPtyId(id)) {
      const e = this.scratches.get(this.scratchKeyFromPtyId(id));
      if (e) e.term.write(data);
      return;
    }
    const entry = this.ensureTerm(id);
    entry.term.write(data);
    entry.buffer += data;
    if (entry.buffer.length > MAX_BUFFER) {
      entry.buffer = entry.buffer.slice(entry.buffer.length - MAX_BUFFER);
    }
  }

  handleState(id, st) {
    if (this.isScratchPtyId(id)) {
      const key = this.scratchKeyFromPtyId(id);
      if (st === 'stopped') {
        const e = this.scratches.get(key);
        if (e) e.started = false;
        this.cb.onScratchExit && this.cb.onScratchExit(key);
      }
      return;
    }
    this.cb.onStatusChange && this.cb.onStatusChange(id, st);
  }

  // ---------- scratch terminals (one pty per server) ----------
  ensureScratchTerm(key) {
    const existing = this.scratches.get(key);
    if (existing) return existing;

    const ptyId = this.scratchIdFor(key);
    const host = document.createElement('div');
    host.className =
      'absolute inset-0 hidden pt-1.5 pr-1 pb-1 pl-2 [&_.xterm]:h-full ' +
      '[&_.xterm-viewport]:[scrollbar-width:none] [&_.xterm-viewport::-webkit-scrollbar]:hidden';
    host.dataset.id = ptyId;
    if (this.scratchHost) this.scratchHost.appendChild(host);

    const term = this._makeTerm();
    const fit = new FitAddon();
    term.loadAddon(fit);
    const search = this._loadCommonAddons(term);
    term.open(host);
    term.onData((data) => window.api.sendInput(ptyId, data));

    const entry = { term, fit, search, host, resizeObs: null, started: false, cwd: '' };
    entry.resizeObs = new ResizeObserver(() => {
      if (!host.classList.contains('hidden')) this._refit(entry, ptyId);
    });
    entry.resizeObs.observe(host);

    this.scratches.set(key, entry);
    return entry;
  }

  /** Show one server's scratch host, hide the rest. Returns the shown cwd. */
  showScratch(key) {
    this.scratches.forEach((entry, k) => {
      entry.host.classList.toggle('hidden', k !== key);
    });
    const entry = this.scratches.get(key);
    return (entry && entry.cwd) || '';
  }

  fitScratch(key) {
    const entry = this.scratches.get(key);
    if (entry) this._refit(entry, this.scratchIdFor(key));
  }

  /** Ensure a server's scratch pty exists + is shown; spawn exactly once. Never
   *  resets/respawns, so switching servers can't kill a running command. */
  async ensureScratchStarted(key) {
    const entry = this.ensureScratchTerm(key);
    this.showScratch(key);
    if (entry.started) return entry;
    const servers = (this.cb.getServers && this.cb.getServers()) || [];
    const s = servers.find((x) => x.id === key) || null;
    const shell = s ? s.shell : (this.cb.getDefaultShell && this.cb.getDefaultShell()) || 'cmd';
    const folder = s ? s.folder : '';
    entry.started = true; // set before await so a rapid double-switch can't double-spawn
    entry.cwd = folder;
    await window.api.scratchStart(this.scratchIdFor(key), shell, folder);
    return entry;
  }

  clearScratch(key) {
    const entry = this.scratches.get(key);
    if (entry) entry.term.clear();
  }

  focusScratch(key) {
    const entry = this.scratches.get(key);
    if (entry) entry.term.focus();
  }

  getScratchCwd(key) {
    const entry = this.scratches.get(key);
    return (entry && entry.cwd) || '';
  }

  // ---------- search ----------
  _searchAddon(activeId, scratchOpen) {
    const e = this.terms.get(activeId);
    if (e && e.search) return e.search;
    if (scratchOpen) {
      const sc = this.scratches.get(activeId || '');
      if (sc && sc.search) return sc.search;
    }
    return null;
  }

  hasSearchTarget(activeId, scratchOpen) {
    return !!this._searchAddon(activeId, scratchOpen);
  }

  search(dir, query, activeId, scratchOpen) {
    const s = this._searchAddon(activeId, scratchOpen);
    if (!s) return;
    if (!query) {
      s.clearDecorations && s.clearDecorations();
      this.cb.onSearchResults && this.cb.onSearchResults(-1, -1);
      return;
    }
    if (dir === 'prev') s.findPrevious(query, SEARCH_DECOR);
    else s.findNext(query, { ...SEARCH_DECOR, incremental: dir === 'incremental' });
  }

  clearSearch(activeId, scratchOpen) {
    const s = this._searchAddon(activeId, scratchOpen);
    if (s && s.clearDecorations) s.clearDecorations();
  }

  focusActive(activeId) {
    const e = this.terms.get(activeId);
    if (e) e.term.focus();
  }
}

// Survive Vite HMR: reuse the same instance so terminals/buffers aren't orphaned
// when this module re-evaluates during development.
export const terminalManager =
  globalThis.__ivTerminalManager || (globalThis.__ivTerminalManager = new TerminalManager());
