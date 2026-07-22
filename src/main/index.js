'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog, clipboard, shell } = require('electron');

const config = require('./config');
const { availableShells } = require('./shells');
const { getBranch } = require('./git');
const ServerManager = require('./serverManager');
const { initAutoUpdate, quitAndInstall } = require('./updater');

// Keep Chromium's caches (GPUCache, disk cache, code cache) on a fast, always-writable
// local path. When the app runs from a synced folder (e.g. OneDrive), Chromium's cache
// writes intermittently fail with noisy "GPU disk cache" errors on launch. Relocating
// sessionData to %LOCALAPPDATA% (never synced) silences them. Must run before app ready.
// servers.json stays in userData (%APPDATA%) — only the caches move.
if (process.platform === 'win32') {
  try {
    const cacheBase = process.env.LOCALAPPDATA || app.getPath('temp');
    const cacheDir = path.join(cacheBase, 'iv-server-manager', 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    app.setPath('sessionData', cacheDir);
    app.commandLine.appendSwitch('disk-cache-dir', path.join(cacheDir, 'http'));
  } catch (_) {
    /* fall back to Electron defaults */
  }
}

let mainWindow = null;
let manager = null;

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 820,
    minHeight: 520,
    backgroundColor: '#12141a',
    title: 'IV Server Manager',
    ...(fs.existsSync(path.join(__dirname, '..', '..', 'assets', 'icon.ico'))
      ? { icon: path.join(__dirname, '..', '..', 'assets', 'icon.ico') }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload needs Node require for the bridge
    },
  });

  mainWindow.removeMenu();
  // Dev: load the Vite dev server (set by scripts/dev.js). Packaged/prod: load the
  // built renderer from build/renderer (base:'./' makes its assets resolve under
  // file:// inside the asar). Using the env var — not app.isPackaged — means an
  // unpackaged `npm start` with no dev server still loads the built file.
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'build', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.handle('config:get', () => ({
    config: config.load(),
    shells: availableShells(),
  }));

  ipcMain.handle('config:saveServer', (_e, server) => {
    const cfg = config.load();
    const clean = config.sanitizeServer(server);
    if (!server.id) clean.id = config.newId();
    const idx = cfg.servers.findIndex((s) => s.id === clean.id);
    if (idx >= 0) cfg.servers[idx] = clean;
    else cfg.servers.push(clean);
    config.save(cfg);
    return { config: cfg, saved: clean };
  });

  ipcMain.handle('config:deleteServer', async (_e, id) => {
    if (manager.isRunning(id)) await manager.stop(id);
    // Also tear down this server's ad-hoc scratch pty, if any.
    const scratchId = ServerManager.SCRATCH_ID + id;
    if (manager.isRunning(scratchId)) await manager.stopScratch(scratchId);
    const cfg = config.load();
    cfg.servers = cfg.servers.filter((s) => s.id !== id);
    config.save(cfg);
    return { config: cfg };
  });

  ipcMain.handle('config:setDefaultShell', (_e, shell) => {
    const cfg = config.load();
    cfg.defaultShell = shell;
    config.save(cfg);
    return { config: cfg };
  });

  ipcMain.handle('config:setSettings', (_e, { theme, fontSize } = {}) => {
    const cfg = config.load();
    if (theme !== undefined) cfg.theme = theme;
    if (fontSize !== undefined) cfg.fontSize = fontSize;
    return { config: config.save(cfg) }; // save() normalizes/clamps
  });

  ipcMain.handle('config:reorder', (_e, orderedIds) => {
    const cfg = config.load();
    const byId = new Map(cfg.servers.map((s) => [s.id, s]));
    const reordered = [];
    orderedIds.forEach((id) => {
      if (byId.has(id)) {
        reordered.push(byId.get(id));
        byId.delete(id);
      }
    });
    // Append any servers not present in the incoming order (safety).
    byId.forEach((s) => reordered.push(s));
    cfg.servers = reordered;
    config.save(cfg);
    return { config: cfg };
  });

  ipcMain.handle('app:version', () => app.getVersion());

  ipcMain.handle('git:branch', (_e, folder) => getBranch(folder));

  ipcMain.handle('dialog:pickFolder', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select server folder',
    });
    return res.canceled ? null : res.filePaths[0];
  });

  const serverById = (id) => config.load().servers.find((s) => s.id === id);

  ipcMain.handle('server:start', (_e, id) => {
    const s = serverById(id);
    if (s) manager.start(s);
  });

  ipcMain.handle('server:stop', (_e, id) => manager.stop(id, serverById(id)));

  ipcMain.handle('server:restart', (_e, id) => {
    const s = serverById(id);
    if (s) return manager.restart(s);
  });

  ipcMain.handle('server:runAll', () => manager.startAll(config.load().servers));
  ipcMain.handle('server:stopAll', () => manager.stopAll());
  ipcMain.handle('server:restartAll', () => manager.restartAll(config.load().servers));

  const serversInGroup = (name) =>
    config.load().servers.filter((s) => (s.group || '').trim() === String(name || '').trim());

  ipcMain.handle('server:runGroup', (_e, name) => manager.startAll(serversInGroup(name)));
  ipcMain.handle('server:stopGroup', (_e, name) => manager.stopMany(serversInGroup(name)));
  ipcMain.handle('server:restartGroup', (_e, name) => manager.restartMany(serversInGroup(name)));

  ipcMain.handle('server:runningIds', () => manager.runningIds());

  ipcMain.on('server:input', (_e, { id, data }) => manager.write(id, data));
  ipcMain.on('server:resize', (_e, { id, cols, rows }) => manager.resize(id, cols, rows));

  ipcMain.handle('scratch:start', (_e, { id, shell, folder }) => manager.startScratch(id, shell, folder));
  ipcMain.handle('scratch:stop', (_e, { id }) => manager.stopScratch(id));

  ipcMain.handle('clipboard:write', (_e, text) => {
    clipboard.writeText(text || '');
    return true;
  });

  ipcMain.handle('open:external', (_e, url) => {
    if (/^https?:\/\//i.test(String(url || ''))) shell.openExternal(url);
  });

  ipcMain.handle('update:install', async () => {
    // Stop servers cleanly, then let electron-updater relaunch the app.
    if (manager && manager.runningIds().length) await manager.stopAll();
    cleaningUp = true; // before-quit must not re-run stopAll / cancel the quit
    quitAndInstall();
  });

  ipcMain.handle('logs:save', async (_e, { name, text }) => {
    const safe = String(name || 'server').replace(/[^a-z0-9_-]+/gi, '_');
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Save logs',
      defaultPath: `${safe}.log`,
      filters: [{ name: 'Log files', extensions: ['log', 'txt'] }],
    });
    if (res.canceled || !res.filePath) return { saved: false };
    fs.writeFileSync(res.filePath, text || '', 'utf8');
    return { saved: true, path: res.filePath };
  });
}

app.whenReady().then(() => {
  manager = new ServerManager(
    (id, data) => send('server:data', { id, data }),
    (id, state, info) => send('server:state', { id, state, info })
  );

  registerIpc();
  createWindow();

  // Check GitHub Releases for a newer version (packaged NSIS installs only).
  initAutoUpdate((status, info) => send('update:status', { status, ...info }));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Kill all child process trees before quitting so nothing is orphaned.
let cleaningUp = false;
app.on('before-quit', async (e) => {
  if (cleaningUp || !manager || manager.runningIds().length === 0) return;
  e.preventDefault();
  cleaningUp = true;
  await manager.stopAll();
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
