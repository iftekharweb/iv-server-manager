'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let configPath;

// Superset of shell ids across platforms — kept as-is so a config authored on
// one OS survives a round-trip through another. resolveShell() maps an unusable
// id to a local shell at spawn time.
const KNOWN_SHELLS = ['cmd', 'powershell', 'bash', 'zsh', 'sh'];
const DEFAULT_SHELL = process.platform === 'win32' ? 'cmd' : 'bash';

const THEMES = ['dark', 'light'];
const DEFAULT_THEME = 'dark';
const DEFAULT_FONT_SIZE = 13;
const FONT_MIN = 10;
const FONT_MAX = 20;

const normTheme = (t) => (THEMES.includes(t) ? t : DEFAULT_THEME);
function clampFont(n) {
  const v = parseInt(n, 10);
  if (!Number.isInteger(v)) return DEFAULT_FONT_SIZE;
  return Math.min(FONT_MAX, Math.max(FONT_MIN, v));
}

function getConfigPath() {
  if (!configPath) {
    configPath = path.join(app.getPath('userData'), 'servers.json');
  }
  return configPath;
}

function defaultConfig() {
  return { defaultShell: DEFAULT_SHELL, theme: DEFAULT_THEME, fontSize: DEFAULT_FONT_SIZE, servers: [] };
}

/**
 * Generate a unique-enough id without external deps.
 * Uses a counter + time seeded once at load to avoid collisions in a session.
 */
let idCounter = 0;
function newId() {
  idCounter += 1;
  return `srv_${Date.now().toString(36)}_${idCounter}`;
}

function sanitizeServer(s) {
  return {
    id: typeof s.id === 'string' && s.id ? s.id : newId(),
    name: String(s.name || 'Unnamed').trim(),
    group: String(s.group || '').trim(),
    folder: String(s.folder || '').trim(),
    command: String(s.command || '').trim(),
    shell: KNOWN_SHELLS.includes(s.shell) ? s.shell : DEFAULT_SHELL,
    // Optional port(s) freed on stop/restart, e.g. "5000" or "5000, 5173".
    port: String(s.port || '').trim(),
  };
}

/**
 * Load config from disk, returning defaults if missing or corrupt.
 * @returns {{defaultShell: string, servers: Array}}
 */
function load() {
  const p = getConfigPath();
  try {
    if (!fs.existsSync(p)) return defaultConfig();
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      defaultShell: KNOWN_SHELLS.includes(parsed.defaultShell) ? parsed.defaultShell : DEFAULT_SHELL,
      theme: normTheme(parsed.theme),
      fontSize: clampFont(parsed.fontSize),
      servers: Array.isArray(parsed.servers) ? parsed.servers.map(sanitizeServer) : [],
    };
  } catch (err) {
    // Corrupt file — back it up and start fresh so the app still opens.
    try {
      fs.renameSync(p, `${p}.corrupt-${Date.now()}`);
    } catch (_) {
      /* ignore */
    }
    return defaultConfig();
  }
}

/**
 * Persist config to disk (pretty-printed). Creates the directory if needed.
 * @param {{defaultShell: string, servers: Array}} config
 */
function save(config) {
  const p = getConfigPath();
  const clean = {
    defaultShell: KNOWN_SHELLS.includes(config.defaultShell) ? config.defaultShell : DEFAULT_SHELL,
    theme: normTheme(config.theme),
    fontSize: clampFont(config.fontSize),
    servers: Array.isArray(config.servers) ? config.servers.map(sanitizeServer) : [],
  };
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(clean, null, 2), 'utf8');
  return clean;
}

module.exports = { load, save, newId, sanitizeServer, getConfigPath };
