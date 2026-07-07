'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let configPath;

function getConfigPath() {
  if (!configPath) {
    configPath = path.join(app.getPath('userData'), 'servers.json');
  }
  return configPath;
}

function defaultConfig() {
  return { defaultShell: 'cmd', servers: [] };
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
    shell: ['cmd', 'powershell', 'bash'].includes(s.shell) ? s.shell : 'cmd',
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
      defaultShell: ['cmd', 'powershell', 'bash'].includes(parsed.defaultShell)
        ? parsed.defaultShell
        : 'cmd',
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
    defaultShell: ['cmd', 'powershell', 'bash'].includes(config.defaultShell)
      ? config.defaultShell
      : 'cmd',
    servers: Array.isArray(config.servers) ? config.servers.map(sanitizeServer) : [],
  };
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(clean, null, 2), 'utf8');
  return clean;
}

module.exports = { load, save, newId, sanitizeServer, getConfigPath };
