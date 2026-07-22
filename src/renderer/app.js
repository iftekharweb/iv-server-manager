'use strict';

/* global Terminal, FitAddon */

// Resolve xterm globals defensively (UMD builds expose different shapes).
const XTerm = window.Terminal;
const FitAddonCtor =
  (window.FitAddon && (window.FitAddon.FitAddon || window.FitAddon)) || null;
const SearchAddonCtor =
  (window.SearchAddon && (window.SearchAddon.SearchAddon || window.SearchAddon)) || null;
const WebLinksAddonCtor =
  (window.WebLinksAddon && (window.WebLinksAddon.WebLinksAddon || window.WebLinksAddon)) || null;

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

const currentXtermTheme = () => (state.theme === 'light' ? XTERM_THEME_LIGHT : XTERM_THEME_DARK);

const MAX_BUFFER = 500000; // chars kept per server for copy/save
const FONT_MIN = 10;
const FONT_MAX = 20;

const state = {
  config: { defaultShell: 'cmd', servers: [] },
  shells: { cmd: true, powershell: true, bash: true },
  activeId: null,
  theme: 'dark',
  fontSize: 13,
};

/** Run cb(term) for every live xterm instance (server terminals + scratch). */
function forEachTerm(cb) {
  terms.forEach((entry) => entry.term && cb(entry.term));
  scratches.forEach((entry) => entry.term && cb(entry.term));
}

/** Apply a theme app-wide: CSS variables (via data-theme) + every terminal. */
function applyTheme(theme) {
  state.theme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = state.theme;
  const t = currentXtermTheme();
  forEachTerm((term) => {
    term.options.theme = t;
  });
}

/** Apply a terminal font size to every terminal and refit them. */
function applyFontSize(n) {
  state.fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, parseInt(n, 10) || 13));
  forEachTerm((term) => {
    term.options.fontSize = state.fontSize;
  });
  // Refit so rows/cols and the pty match the new glyph size.
  terms.forEach((entry) => {
    if (entry.fit) {
      try {
        entry.fit.fit();
        window.api.resize(entry.host.dataset.id, entry.term.cols, entry.term.rows);
      } catch (_) {
        /* ignore */
      }
    }
  });
  // Refit every scratch terminal too (including hidden/background ones).
  scratches.forEach((entry, key) => {
    if (entry.fit) {
      try {
        entry.fit.fit();
        window.api.resize(scratchIdFor(key), entry.term.cols, entry.term.rows);
      } catch (_) {
        /* ignore */
      }
    }
  });
}

/** id -> { term, fit, host, resizeObs, buffer } */
const terms = new Map();
/** id -> 'running' | 'stopped' | 'error' */
const statuses = new Map();
/** id -> { branch, dirty } or null if not a repo */
const branches = new Map();

// ---------- element refs ----------
const el = (id) => document.getElementById(id);
const listEl = el('serverList');
const emptyHint = el('emptyHint');
const countEl = el('serverCount');
const termsHost = el('terminals');
const noTerm = el('noTerm');

// ============================================================
// Init
// ============================================================
async function init() {
  const { config, shells } = await window.api.getConfig();
  state.config = config;
  state.shells = shells;
  state.theme = config.theme || 'dark';
  state.fontSize = config.fontSize || 13;
  applyTheme(state.theme); // paints CSS vars before anything renders

  buildShellOptions(el('defaultShell'));
  el('defaultShell').value = config.defaultShell;

  window.api.getVersion().then((v) => {
    if (v) el('appVersion').textContent = `v${v}`;
  });

  wireTopBar();
  wireModal();
  wirePanelActions();
  wireDragReorder();
  wireScratch();
  wireSearch();
  wireUpdates();
  wireSettings();

  window.api.onData(({ id, data }) => handleData(id, data));
  window.api.onState(({ id, state: st }) => handleState(id, st));

  // Reflect any servers already running (e.g. after a renderer reload).
  const running = await window.api.runningIds();
  running.forEach((id) => statuses.set(id, 'running'));

  renderList();
  loadBranches();
  // Pick up branch switches made outside the app (which often auto-restart the
  // server via the dev watcher). Cheap `git rev-parse` per server; re-renders
  // only when a branch actually changed.
  setInterval(loadBranches, 4000);
}

/**
 * Fetch the git branch for every server's folder. Re-renders only if something
 * actually changed, so it's safe to call on a timer without disrupting the UI.
 * Servers without a git repo simply show no branch.
 */
function branchKey(info) {
  return info ? `${info.branch} ${info.dirty ? 1 : 0}` : '';
}

async function loadBranches() {
  let changed = false;
  await Promise.all(
    state.config.servers.map(async (s) => {
      let info = null;
      try {
        info = await window.api.getBranch(s.folder);
      } catch (_) {
        info = null;
      }
      if (branchKey(branches.get(s.id)) !== branchKey(info)) {
        branches.set(s.id, info);
        changed = true;
      }
    })
  );
  if (changed) {
    renderList();
    updatePanelHeader();
  }
}

/** Build the branch label HTML (with a dirty `*`), or '' when no repo. */
function branchLabel(id) {
  const info = branches.get(id);
  if (!info) return '';
  const star = info.dirty ? '<span class="dirty" title="uncommitted changes"> ●</span>' : '';
  return `<div class="branch" title="git branch${info.dirty ? ' (uncommitted changes)' : ''}">⎇ ${esc(info.branch)}${star}</div>`;
}

// ============================================================
// Server list
// ============================================================
function statusOf(id) {
  return statuses.get(id) || 'stopped';
}

function dotClass(id) {
  const s = statusOf(id);
  return s === 'running' ? 'dot-running' : s === 'error' ? 'dot-error' : 'dot-stopped';
}

/** Collapsed group names (in-memory; resets on relaunch). */
const collapsedGroups = new Set();

function createServerLi(s) {
  const li = document.createElement('li');
  li.className = 'server-item' + (s.id === state.activeId ? ' active' : '');
  li.dataset.id = s.id;

  const running = statusOf(s.id) === 'running';
  const portTag = s.port ? `<span class="shell-tag" title="Port freed on stop/restart">:${esc(s.port)}</span>` : '';
  li.innerHTML = `
    <div class="row1">
      <span class="grip" title="Drag to reorder">⠿</span>
      <span class="dot ${dotClass(s.id)}"></span>
      <span class="name" title="${esc(s.name)}">${esc(s.name)}</span>
      ${portTag}
      <span class="shell-tag">${esc(s.shell)}</span>
    </div>
    <div class="cmd" title="${esc(s.folder)} — ${esc(s.command)}">${esc(s.command)}</div>
    ${branchLabel(s.id)}
    <div class="actions">
      <button class="mini" data-act="run">${running ? '▶ Running' : '▶ Run'}</button>
      <button class="mini" data-act="restart">⟳</button>
      <button class="mini" data-act="stop">■</button>
      <button class="mini icon" data-act="edit" title="Edit">✎</button>
      <button class="mini icon" data-act="delete" title="Delete">🗑</button>
    </div>`;

  li.addEventListener('click', (ev) => {
    const act = ev.target.dataset && ev.target.dataset.act;
    if (act) {
      ev.stopPropagation();
      handleServerAction(s, act);
    } else {
      selectServer(s.id);
    }
  });

  // Only allow dragging when the gesture starts off the action buttons/inputs.
  li.draggable = true;
  li.addEventListener('mousedown', (ev) => {
    li.draggable = !ev.target.closest('.mini');
  });
  li.addEventListener('dragstart', (ev) => {
    li.classList.add('dragging');
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', s.id);
  });
  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    persistOrder();
  });

  return li;
}

function createGroupHeader(name, servers) {
  const li = document.createElement('li');
  const collapsed = collapsedGroups.has(name);
  li.className = 'group-head' + (collapsed ? ' collapsed' : '');
  const running = servers.filter((s) => statusOf(s.id) === 'running').length;
  const label = name === '' ? 'Ungrouped' : name;
  li.innerHTML = `
    <span class="caret">${collapsed ? '▸' : '▾'}</span>
    <span class="group-name" title="${esc(label)}">${esc(label)}</span>
    <span class="group-count">${running}/${servers.length}</span>
    <span class="group-actions">
      <button class="mini" data-gact="run" title="Run group">▶</button>
      <button class="mini" data-gact="restart" title="Restart group">⟳</button>
      <button class="mini" data-gact="stop" title="Stop group">■</button>
    </span>`;

  li.addEventListener('click', (ev) => {
    const gact = ev.target.dataset && ev.target.dataset.gact;
    if (gact) {
      ev.stopPropagation();
      handleGroupAction(name, gact);
    } else {
      if (collapsedGroups.has(name)) collapsedGroups.delete(name);
      else collapsedGroups.add(name);
      renderList();
    }
  });
  return li;
}

function renderList() {
  const { servers } = state.config;
  countEl.textContent = String(servers.length);
  emptyHint.classList.toggle('hidden', servers.length > 0);
  listEl.innerHTML = '';

  const hasGroups = servers.some((s) => (s.group || '').trim() !== '');

  if (!hasGroups) {
    servers.forEach((s) => listEl.appendChild(createServerLi(s)));
    return;
  }

  // Group names in first-appearance order; ungrouped ('') always last.
  const order = [];
  servers.forEach((s) => {
    const g = (s.group || '').trim();
    if (!order.includes(g)) order.push(g);
  });
  order.sort((a, b) => (a === '' ? 1 : b === '' ? -1 : 0));

  order.forEach((g) => {
    const inGroup = servers.filter((s) => (s.group || '').trim() === g);
    listEl.appendChild(createGroupHeader(g, inGroup));
    if (!collapsedGroups.has(g)) inGroup.forEach((s) => listEl.appendChild(createServerLi(s)));
  });
}

async function handleGroupAction(name, act) {
  if (act === 'run') await window.api.runGroup(name);
  else if (act === 'restart') await window.api.restartGroup(name);
  else if (act === 'stop') await window.api.stopGroup(name);
}

// ---------- drag-to-reorder ----------
function getDragAfterElement(y) {
  const items = [...listEl.querySelectorAll('.server-item:not(.dragging)')];
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  for (const child of items) {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) closest = { offset, element: child };
  }
  return closest.element;
}

function wireDragReorder() {
  listEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragging = listEl.querySelector('.dragging');
    if (!dragging) return;
    const after = getDragAfterElement(e.clientY);
    if (after == null) listEl.appendChild(dragging);
    else listEl.insertBefore(dragging, after);
  });
}

async function persistOrder() {
  const ids = [...listEl.querySelectorAll('.server-item')].map((li) => li.dataset.id);
  const current = state.config.servers.map((s) => s.id);
  if (ids.join() === current.join()) return; // no change
  const { config } = await window.api.reorder(ids);
  state.config = config;
  renderList();
}

function handleServerAction(server, act) {
  switch (act) {
    case 'run':
      selectServer(server.id);
      window.api.start(server.id);
      break;
    case 'restart':
      selectServer(server.id);
      window.api.restart(server.id);
      break;
    case 'stop':
      window.api.stop(server.id);
      break;
    case 'edit':
      openModal(server);
      break;
    case 'delete':
      if (confirm(`Delete server "${server.name}"?`)) deleteServer(server.id);
      break;
  }
}

async function deleteServer(id) {
  const { config } = await window.api.deleteServer(id);
  state.config = config;
  const t = terms.get(id);
  if (t) {
    t.resizeObs && t.resizeObs.disconnect();
    t.host.remove();
    t.term.dispose();
    terms.delete(id);
  }
  // Tear down this server's scratch terminal too (main already killed its pty).
  const sc = scratches.get(id);
  if (sc) {
    sc.resizeObs && sc.resizeObs.disconnect();
    sc.host.remove();
    sc.term.dispose();
    scratches.delete(id);
  }
  statuses.delete(id);
  branches.delete(id);
  if (state.activeId === id) {
    state.activeId = null;
    updatePanelHeader();
    noTerm.classList.remove('hidden');
  }
  renderList();
}

// ============================================================
// Terminals
// ============================================================
/**
 * Attach the search + web-links addons to a term. Opening a matched link goes
 * through the main process (shell.openExternal). Returns the search addon.
 */
function loadCommonAddons(term) {
  // Intercept Ctrl/Cmd+F so xterm doesn't send ^F to the shell; open our search instead.
  term.attachCustomKeyEventHandler((e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key && e.key.toLowerCase() === 'f') {
      if (e.type === 'keydown') openSearch();
      return false; // don't let xterm handle / forward it
    }
    return true;
  });
  if (WebLinksAddonCtor) {
    term.loadAddon(
      new WebLinksAddonCtor((_e, uri) => window.api.openExternal(uri))
    );
  }
  let search = null;
  if (SearchAddonCtor) {
    search = new SearchAddonCtor();
    term.loadAddon(search);
    if (search.onDidChangeResults) {
      search.onDidChangeResults(({ resultIndex, resultCount }) => {
        if (!el('searchBar').classList.contains('hidden')) updateSearchCount(resultIndex, resultCount);
      });
    }
  }
  return search;
}

function updateSearchCount(index, count) {
  const label = count > 0 ? `${index + 1}/${count}` : count === 0 ? 'no matches' : '';
  el('searchCount').textContent = label;
}

function ensureTerm(id) {
  if (terms.get(id)) return terms.get(id);

  const host = document.createElement('div');
  host.className = 'term-host';
  host.dataset.id = id;
  termsHost.appendChild(host);

  const term = new XTerm({
    fontFamily: 'Consolas, "Cascadia Mono", monospace',
    fontSize: state.fontSize,
    cursorBlink: true,
    scrollback: 5000,
    allowProposedApi: true, // required for search-match decorations (highlighting)
    theme: currentXtermTheme(),
  });

  let fit = null;
  if (FitAddonCtor) {
    fit = new FitAddonCtor();
    term.loadAddon(fit);
  }
  const search = loadCommonAddons(term);
  term.open(host);

  // Forward user keystrokes to the pty.
  term.onData((data) => window.api.sendInput(id, data));

  // Keep pty sized to the terminal element.
  const doFit = () => {
    if (!fit) return;
    try {
      fit.fit();
      window.api.resize(id, term.cols, term.rows);
    } catch (_) {
      /* ignore */
    }
  };
  const resizeObs = new ResizeObserver(() => doFit());
  resizeObs.observe(host);

  const entry = { term, fit, search, host, resizeObs, buffer: '' };
  terms.set(id, entry);
  return entry;
}

function selectServer(id) {
  state.activeId = id;
  const entry = ensureTerm(id);

  noTerm.classList.add('hidden');
  terms.forEach((t, tid) => t.host.classList.toggle('visible', tid === id));

  // fit + focus after paint
  requestAnimationFrame(() => {
    if (entry.fit) {
      try {
        entry.fit.fit();
        window.api.resize(id, entry.term.cols, entry.term.rows);
      } catch (_) {}
    }
    entry.term.focus();
  });

  updatePanelHeader();
  renderList();
  syncScratchToActive();
}

function handleData(id, data) {
  if (isScratchPtyId(id)) {
    const e = scratches.get(scratchKeyFromPtyId(id));
    if (e) e.term.write(data);
    return;
  }
  const entry = ensureTerm(id);
  entry.term.write(data);
  entry.buffer += data;
  if (entry.buffer.length > MAX_BUFFER) {
    entry.buffer = entry.buffer.slice(entry.buffer.length - MAX_BUFFER);
  }
}

function handleState(id, st) {
  if (isScratchPtyId(id)) {
    // Scratch terminals aren't in the server list. If one exited (e.g. user
    // typed `exit`), clear its started flag so the next open respawns it.
    if (st === 'stopped') {
      const e = scratches.get(scratchKeyFromPtyId(id));
      if (e) e.started = false;
    }
    return;
  }
  statuses.set(id, st);
  renderList();
  if (id === state.activeId) updatePanelHeader();
  // A (re)start often follows a branch switch — refresh branches promptly.
  if (st === 'running') loadBranches();
}

function updatePanelHeader() {
  const dot = el('activeDot');
  const nameEl = el('activeName');
  const metaEl = el('activeMeta');
  const server = state.config.servers.find((s) => s.id === state.activeId);

  if (!server) {
    dot.className = 'dot dot-off';
    nameEl.textContent = 'No server selected';
    metaEl.textContent = '';
    return;
  }
  dot.className = 'dot ' + dotClass(server.id);
  nameEl.textContent = server.name;
  const st = statusOf(server.id);
  const info = branches.get(server.id);
  const branchTxt = info ? ` · ⎇ ${info.branch}${info.dirty ? ' ●' : ''}` : '';
  metaEl.textContent = `· ${st} · ${server.shell}${branchTxt} · ${server.command}`;
}

// ============================================================
// Panel actions (copy / clear / save)
// ============================================================
function wirePanelActions() {
  el('copyLogs').addEventListener('click', async () => {
    const entry = terms.get(state.activeId);
    if (!entry) return;
    // Copy the current selection if there is one, otherwise the whole buffer.
    const hasSel = entry.term.hasSelection();
    const text = hasSel ? entry.term.getSelection() : stripAnsi(entry.buffer);
    await window.api.copyText(text);
    flash(el('copyLogs'), hasSel ? 'Copied selection' : 'Copied all');
  });

  el('clearLogs').addEventListener('click', () => {
    const entry = terms.get(state.activeId);
    if (!entry) return;
    entry.term.clear();
    entry.buffer = '';
  });

  el('saveLogs').addEventListener('click', async () => {
    const entry = terms.get(state.activeId);
    if (!entry) return;
    const server = state.config.servers.find((s) => s.id === state.activeId);
    const res = await window.api.saveLogs(server ? server.name : 'server', stripAnsi(entry.buffer));
    if (res.saved) flash(el('saveLogs'), 'Saved!');
  });
}

// ============================================================
// Top bar
// ============================================================
function wireTopBar() {
  el('runAll').addEventListener('click', () => window.api.runAll());
  // Guard the mass actions — one misclick shouldn't nuke every server.
  el('restartAll').addEventListener('click', () => {
    const n = state.config.servers.length;
    if (n && confirm(`Restart all ${n} server(s)?`)) window.api.restartAll();
  });
  el('stopAll').addEventListener('click', () => {
    const running = [...statuses.values()].filter((s) => s === 'running').length;
    if (running && confirm(`Stop all ${running} running server(s)?`)) window.api.stopAll();
  });
  el('addServer').addEventListener('click', () => openModal(null));

  el('defaultShell').addEventListener('change', async (e) => {
    const { config } = await window.api.setDefaultShell(e.target.value);
    state.config.defaultShell = config.defaultShell;
  });
}

// ============================================================
// Modal (add / edit)
// ============================================================
function wireModal() {
  el('cancelModal').addEventListener('click', closeModal);
  el('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
  el('browseFolder').addEventListener('click', async () => {
    const folder = await window.api.pickFolder();
    if (folder) el('fFolder').value = folder;
  });
  el('serverForm').addEventListener('submit', onSubmitServer);
}

/** Guess a port from a run command: explicit -p/--port flag, else a trailing number. */
function detectPort(command) {
  const cmd = String(command || '');
  const flag = cmd.match(/(?:-p|--port)[=\s]+(\d{2,5})\b/i);
  const trailing = cmd.match(/\b(\d{2,5})\s*$/);
  const n = parseInt((flag && flag[1]) || (trailing && trailing[1]) || '', 10);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : null;
}

function openModal(server) {
  el('modalTitle').textContent = server ? 'Edit Server' : 'Add Server';
  // Suggest existing group names.
  const groups = [...new Set(state.config.servers.map((s) => (s.group || '').trim()).filter(Boolean))];
  el('groupList').innerHTML = groups.map((g) => `<option value="${esc(g)}"></option>`).join('');
  el('fGroup').value = server ? server.group || '' : '';
  el('fId').value = server ? server.id : '';
  el('fName').value = server ? server.name : '';
  el('fFolder').value = server ? server.folder : '';
  el('fCommand').value = server ? server.command : '';
  buildShellOptions(el('fShell'));
  el('fShell').value = server ? server.shell : state.config.defaultShell;
  el('formError').textContent = '';
  el('modalOverlay').classList.remove('hidden');
  el('fName').focus();
}

function closeModal() {
  el('modalOverlay').classList.add('hidden');
}

async function onSubmitServer(e) {
  e.preventDefault();
  const server = {
    id: el('fId').value || '',
    name: el('fName').value.trim(),
    group: el('fGroup').value.trim(),
    folder: el('fFolder').value.trim(),
    command: el('fCommand').value.trim(),
    shell: el('fShell').value,
  };
  // No manual Port field anymore — auto-detect it from the command so Stop/Restart
  // can still free the port PC-wide. Keep an existing server's saved port if the
  // command yields none.
  const existing = state.config.servers.find((s) => s.id === server.id);
  const p = detectPort(server.command);
  server.port = p ? String(p) : (existing && existing.port) || '';
  if (!server.name || !server.command) {
    el('formError').textContent = 'Name and command are required.';
    return;
  }
  const { config, saved } = await window.api.saveServer(server);
  state.config = config;
  closeModal();
  renderList();
  selectServer(saved.id);
  // Folder may have changed — refresh this server's branch.
  window.api.getBranch(saved.folder).then((info) => {
    branches.set(saved.id, info);
    renderList();
    updatePanelHeader();
  });
}

// ============================================================
// Helpers
// ============================================================
/** Populate a shell <select> from the platform's available shells. */
function buildShellOptions(selectEl) {
  const shells = state.shells || {};
  selectEl.innerHTML = Object.keys(shells)
    .map((sh) => {
      const ok = shells[sh];
      const label = ok ? sh : `${sh} (not found)`;
      return `<option value="${sh}"${ok ? '' : ' disabled'}>${label}</option>`;
    })
    .join('');
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
}

function flash(btn, text) {
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(() => (btn.textContent = old), 1000);
}

// ============================================================
// Search in logs (Ctrl+F)
// ============================================================
/** The search addon of whatever terminal is currently front-and-center. */
function activeSearch() {
  const e = terms.get(state.activeId);
  if (e && e.search) return e.search;
  if (!el('scratchDock').classList.contains('collapsed')) {
    const sc = scratches.get(activeScratchKey());
    if (sc && sc.search) return sc.search;
  }
  return null;
}

function doSearch(dir) {
  const s = activeSearch();
  if (!s) return;
  const q = el('searchInput').value;
  if (!q) {
    s.clearDecorations && s.clearDecorations();
    updateSearchCount(-1, -1);
    el('searchCount').textContent = '';
    return;
  }
  if (dir === 'prev') s.findPrevious(q, SEARCH_DECOR);
  else s.findNext(q, { ...SEARCH_DECOR, incremental: dir === 'incremental' });
}

function openSearch() {
  if (!activeSearch()) return;
  el('searchBar').classList.remove('hidden');
  const input = el('searchInput');
  input.focus();
  input.select();
  if (input.value) doSearch('next');
}

function closeSearch() {
  el('searchBar').classList.add('hidden');
  const s = activeSearch();
  if (s && s.clearDecorations) s.clearDecorations();
  const e = terms.get(state.activeId);
  if (e) e.term.focus();
}

function wireSearch() {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      openSearch();
    }
  });
  el('searchInput').addEventListener('input', () => doSearch('incremental'));
  el('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSearch(e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    }
  });
  el('searchNext').addEventListener('click', () => doSearch('next'));
  el('searchPrev').addEventListener('click', () => doSearch('prev'));
  el('searchClose').addEventListener('click', closeSearch);
}

// ============================================================
// Scratch (ad-hoc) terminal dock
// ============================================================
// One scratch pty per server so switching servers never kills a running command.
// Keyed by server id ('' = the default/global scratch when no server is selected).
const SCRATCH_PREFIX = window.api.scratchPrefix;
/** serverId -> { term, fit, search, host, resizeObs, started, cwd } */
const scratches = new Map();
const scratchIdFor = (serverId) => SCRATCH_PREFIX + (serverId || '');
const activeScratchKey = () => state.activeId || '';
const isScratchPtyId = (id) => typeof id === 'string' && id.startsWith(SCRATCH_PREFIX);
const scratchKeyFromPtyId = (id) => id.slice(SCRATCH_PREFIX.length);

/** Lazily create (and cache) a server's scratch xterm. Mirrors ensureTerm: each
 *  scratch gets its own `.term-host` inside #scratchTerm, toggled via `.visible`
 *  and never disposed on switch. */
function ensureScratchTerm(serverId) {
  const existing = scratches.get(serverId);
  if (existing) return existing;

  const ptyId = scratchIdFor(serverId);
  const host = document.createElement('div');
  host.className = 'term-host';
  host.dataset.id = ptyId;
  el('scratchTerm').appendChild(host);

  const term = new XTerm({
    fontFamily: 'Consolas, "Cascadia Mono", monospace',
    fontSize: state.fontSize,
    cursorBlink: true,
    scrollback: 5000,
    allowProposedApi: true, // required for search-match decorations (highlighting)
    theme: currentXtermTheme(),
  });

  let fit = null;
  if (FitAddonCtor) {
    fit = new FitAddonCtor();
    term.loadAddon(fit);
  }
  const search = loadCommonAddons(term);
  term.open(host);
  term.onData((data) => window.api.sendInput(ptyId, data));

  // Only the visible scratch needs refitting; fitScratch targets the active one.
  const resizeObs = new ResizeObserver(() => {
    if (host.classList.contains('visible')) fitScratch();
  });
  resizeObs.observe(host);

  const entry = { term, fit, search, host, resizeObs, started: false, cwd: '' };
  scratches.set(serverId, entry);
  return entry;
}

/** Fit the currently-shown scratch terminal to its host and resize its pty. */
function fitScratch() {
  const key = activeScratchKey();
  const entry = scratches.get(key);
  if (!entry || !entry.fit) return;
  try {
    entry.fit.fit();
    window.api.resize(scratchIdFor(key), entry.term.cols, entry.term.rows);
  } catch (_) {
    /* ignore */
  }
}

/** Show one server's scratch host, hide the rest, and update the cwd label. */
function showScratch(serverId) {
  scratches.forEach((entry, key) => {
    entry.host.classList.toggle('visible', key === serverId);
  });
  const entry = scratches.get(serverId);
  el('scratchCwd').textContent = (entry && entry.cwd) || '(home)';
}

/** Ensure the given server's scratch pty exists and is shown. Spawns it exactly
 *  once (first open); a command already running is left untouched — this never
 *  resets or respawns, so switching servers can't kill it. */
async function ensureScratchStarted(serverId) {
  const entry = ensureScratchTerm(serverId);
  showScratch(serverId);
  if (entry.started) return entry;
  const s = state.config.servers.find((x) => x.id === serverId) || null;
  const shell = s ? s.shell : state.config.defaultShell;
  const folder = s ? s.folder : '';
  // Mark started before the await so a rapid double-switch can't double-spawn.
  entry.started = true;
  entry.cwd = folder;
  el('scratchCwd').textContent = folder || '(home)';
  await window.api.scratchStart(scratchIdFor(serverId), shell, folder);
  return entry;
}

/** Show the active server's scratch when the dock is open (spawning once on
 *  first open). No-op while collapsed. Never touches another server's scratch,
 *  so a command left running there keeps going. Does not steal focus — the
 *  server log terminal keeps focus on a plain switch. */
function syncScratchToActive() {
  if (el('scratchDock').classList.contains('collapsed')) return;
  ensureScratchStarted(activeScratchKey());
  requestAnimationFrame(fitScratch);
}

function expandScratch() {
  el('scratchDock').classList.remove('collapsed');
  ensureScratchStarted(activeScratchKey());
  requestAnimationFrame(() => {
    fitScratch();
    const entry = scratches.get(activeScratchKey());
    if (entry) entry.term.focus();
  });
}

function collapseScratch() {
  // Keep every scratch pty alive (running commands persist); just hide the dock.
  el('scratchDock').classList.add('collapsed');
}

function wireScratch() {
  el('scratchRail').addEventListener('click', expandScratch);
  el('scratchCollapse').addEventListener('click', collapseScratch);
  el('scratchClear').addEventListener('click', () => {
    const entry = scratches.get(activeScratchKey());
    if (entry) entry.term.clear();
  });

  // Drag the left edge to resize (clamped to 300px .. 50vw).
  const dock = el('scratchDock');
  const resizer = el('scratchResizer');
  let dragging = false;
  resizer.addEventListener('mousedown', (e) => {
    dragging = true;
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const w = Math.min(window.innerWidth * 0.5, Math.max(300, window.innerWidth - e.clientX));
    dock.style.width = `${w}px`;
    fitScratch();
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    fitScratch();
  });
}

// ============================================================
// Auto-update banner
// ============================================================
function wireUpdates() {
  const bar = el('updateBar');
  const text = el('updateText');
  const installBtn = el('updateInstall');
  if (!bar || !window.api.onUpdateStatus) return;

  installBtn.addEventListener('click', () => {
    installBtn.disabled = true;
    text.textContent = 'Restarting…';
    window.api.installUpdate();
  });

  window.api.onUpdateStatus(({ status, version, percent, message }) => {
    switch (status) {
      case 'available':
        bar.classList.remove('hidden');
        text.textContent = `Update ${version || ''} found — downloading…`.trim();
        break;
      case 'downloading':
        bar.classList.remove('hidden');
        text.textContent = `Downloading update… ${percent || 0}%`;
        break;
      case 'downloaded':
        bar.classList.remove('hidden');
        text.textContent = `Update ${version || ''} ready.`.trim();
        installBtn.classList.remove('hidden');
        break;
      // 'checking' / 'none' / 'error' stay silent — no update, no noise.
      default:
        break;
    }
  });
}

// ============================================================
// Settings modal (appearance + about)
// ============================================================
function wireSettings() {
  const overlay = el('settingsOverlay');
  const preview = el('fontPreview');
  const fontValue = el('fontValue');
  const segBtns = [...document.querySelectorAll('#themeSeg .seg-btn')];

  const syncControls = () => {
    segBtns.forEach((b) => b.classList.toggle('active', b.dataset.theme === state.theme));
    fontValue.textContent = `${state.fontSize}px`;
    preview.style.fontSize = `${state.fontSize}px`;
    el('fontDown').disabled = state.fontSize <= FONT_MIN;
    el('fontUp').disabled = state.fontSize >= FONT_MAX;
  };

  function showTab(name) {
    const isApp = name === 'appearance';
    el('tabAppearance').classList.toggle('hidden', !isApp);
    el('tabAbout').classList.toggle('hidden', isApp);
    el('tabBtnAppearance').classList.toggle('active', isApp);
    el('tabBtnAbout').classList.toggle('active', !isApp);
  }

  const openSettings = () => {
    window.api.getVersion().then((v) => {
      if (v) el('aboutVersion').textContent = v;
    });
    showTab('appearance');
    syncControls();
    overlay.classList.remove('hidden');
  };
  const closeSettings = () => overlay.classList.add('hidden');

  el('openSettings').addEventListener('click', openSettings);
  el('closeSettings').addEventListener('click', closeSettings);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSettings();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeSettings();
  });

  el('tabBtnAppearance').addEventListener('click', () => showTab('appearance'));
  el('tabBtnAbout').addEventListener('click', () => showTab('about'));

  // Theme toggle — apply live, then persist.
  segBtns.forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.theme === state.theme) return;
      applyTheme(b.dataset.theme);
      syncControls();
      window.api.setSettings({ theme: state.theme });
    });
  });

  // Font-size stepper — apply live, then persist.
  const bumpFont = (delta) => {
    const next = state.fontSize + delta;
    if (next < FONT_MIN || next > FONT_MAX) return;
    applyFontSize(next);
    syncControls();
    window.api.setSettings({ fontSize: state.fontSize });
  };
  el('fontDown').addEventListener('click', () => bumpFont(-1));
  el('fontUp').addEventListener('click', () => bumpFont(1));

  el('aboutRepo').addEventListener('click', (e) => {
    e.preventDefault();
    window.api.openExternal('https://github.com/iftekharweb/iv-server-manager');
  });
}

init();
