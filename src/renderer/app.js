'use strict';

/* global Terminal, FitAddon */

// Resolve xterm globals defensively (UMD builds expose different shapes).
const XTerm = window.Terminal;
const FitAddonCtor =
  (window.FitAddon && (window.FitAddon.FitAddon || window.FitAddon)) || null;

const XTERM_THEME = {
  background: '#0d0f14',
  foreground: '#e6e9ef',
  cursor: '#5b8cff',
  selectionBackground: '#33415e',
  black: '#12141a', red: '#f85149', green: '#3fb950', yellow: '#d29922',
  blue: '#5b8cff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#e6e9ef',
};

const MAX_BUFFER = 500000; // chars kept per server for copy/save

const state = {
  config: { defaultShell: 'cmd', servers: [] },
  shells: { cmd: true, powershell: true, bash: true },
  activeId: null,
};

/** id -> { term, fit, host, resizeObs, buffer } */
const terms = new Map();
/** id -> 'running' | 'stopped' | 'error' */
const statuses = new Map();

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

  el('defaultShell').value = config.defaultShell;
  applyShellAvailability(el('defaultShell'));

  wireTopBar();
  wireModal();
  wirePanelActions();
  wireDragReorder();

  window.api.onData(({ id, data }) => handleData(id, data));
  window.api.onState(({ id, state: st }) => handleState(id, st));

  // Reflect any servers already running (e.g. after a renderer reload).
  const running = await window.api.runningIds();
  running.forEach((id) => statuses.set(id, 'running'));

  renderList();
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

function renderList() {
  const { servers } = state.config;
  countEl.textContent = String(servers.length);
  emptyHint.classList.toggle('hidden', servers.length > 0);
  listEl.innerHTML = '';

  servers.forEach((s) => {
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

    listEl.appendChild(li);
  });
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
  statuses.delete(id);
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
function ensureTerm(id) {
  if (terms.get(id)) return terms.get(id);

  const host = document.createElement('div');
  host.className = 'term-host';
  host.dataset.id = id;
  termsHost.appendChild(host);

  const term = new XTerm({
    fontFamily: 'Consolas, "Cascadia Mono", monospace',
    fontSize: 13,
    cursorBlink: true,
    scrollback: 5000,
    theme: XTERM_THEME,
  });

  let fit = null;
  if (FitAddonCtor) {
    fit = new FitAddonCtor();
    term.loadAddon(fit);
  }
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

  const entry = { term, fit, host, resizeObs, buffer: '' };
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
}

function handleData(id, data) {
  const entry = ensureTerm(id);
  entry.term.write(data);
  entry.buffer += data;
  if (entry.buffer.length > MAX_BUFFER) {
    entry.buffer = entry.buffer.slice(entry.buffer.length - MAX_BUFFER);
  }
}

function handleState(id, st) {
  statuses.set(id, st);
  renderList();
  if (id === state.activeId) updatePanelHeader();
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
  metaEl.textContent = `· ${st} · ${server.shell} · ${server.command}`;
}

// ============================================================
// Panel actions (copy / clear / save)
// ============================================================
function wirePanelActions() {
  el('copyLogs').addEventListener('click', async () => {
    const entry = terms.get(state.activeId);
    if (!entry) return;
    await window.api.copyText(stripAnsi(entry.buffer));
    flash(el('copyLogs'), 'Copied!');
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
  el('restartAll').addEventListener('click', () => window.api.restartAll());
  el('stopAll').addEventListener('click', () => window.api.stopAll());
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
  applyShellAvailability(el('fShell'));
}

function openModal(server) {
  el('modalTitle').textContent = server ? 'Edit Server' : 'Add Server';
  el('fId').value = server ? server.id : '';
  el('fName').value = server ? server.name : '';
  el('fFolder').value = server ? server.folder : '';
  el('fCommand').value = server ? server.command : '';
  el('fShell').value = server ? server.shell : state.config.defaultShell;
  el('fPort').value = server ? server.port || '' : '';
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
    folder: el('fFolder').value.trim(),
    command: el('fCommand').value.trim(),
    shell: el('fShell').value,
    port: el('fPort').value.trim(),
  };
  if (!server.name || !server.command) {
    el('formError').textContent = 'Name and command are required.';
    return;
  }
  const { config, saved } = await window.api.saveServer(server);
  state.config = config;
  closeModal();
  renderList();
  selectServer(saved.id);
}

// ============================================================
// Helpers
// ============================================================
function applyShellAvailability(selectEl) {
  ['cmd', 'powershell', 'bash'].forEach((sh) => {
    const opt = selectEl.querySelector(`option[value="${sh}"]`);
    if (!opt) return;
    const ok = state.shells[sh];
    opt.disabled = !ok;
    opt.textContent = ok ? sh : `${sh} (not found)`;
  });
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

init();
