'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog, clipboard } = require('electron');

const config = require('./config');
const { availableShells } = require('./shells');
const ServerManager = require('./serverManager');

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
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

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

  ipcMain.handle('server:runningIds', () => manager.runningIds());

  ipcMain.on('server:input', (_e, { id, data }) => manager.write(id, data));
  ipcMain.on('server:resize', (_e, { id, cols, rows }) => manager.resize(id, cols, rows));

  ipcMain.handle('clipboard:write', (_e, text) => {
    clipboard.writeText(text || '');
    return true;
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
