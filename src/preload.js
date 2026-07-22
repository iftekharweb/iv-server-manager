'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // --- config ---
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveServer: (server) => ipcRenderer.invoke('config:saveServer', server),
  deleteServer: (id) => ipcRenderer.invoke('config:deleteServer', id),
  setDefaultShell: (shell) => ipcRenderer.invoke('config:setDefaultShell', shell),
  setSettings: (settings) => ipcRenderer.invoke('config:setSettings', settings),
  reorder: (orderedIds) => ipcRenderer.invoke('config:reorder', orderedIds),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  getVersion: () => ipcRenderer.invoke('app:version'),
  getBranch: (folder) => ipcRenderer.invoke('git:branch', folder),

  // --- server lifecycle ---
  start: (id) => ipcRenderer.invoke('server:start', id),
  stop: (id) => ipcRenderer.invoke('server:stop', id),
  restart: (id) => ipcRenderer.invoke('server:restart', id),
  runAll: () => ipcRenderer.invoke('server:runAll'),
  stopAll: () => ipcRenderer.invoke('server:stopAll'),
  restartAll: () => ipcRenderer.invoke('server:restartAll'),
  runGroup: (name) => ipcRenderer.invoke('server:runGroup', name),
  stopGroup: (name) => ipcRenderer.invoke('server:stopGroup', name),
  restartGroup: (name) => ipcRenderer.invoke('server:restartGroup', name),
  runningIds: () => ipcRenderer.invoke('server:runningIds'),

  // --- terminal io ---
  sendInput: (id, data) => ipcRenderer.send('server:input', { id, data }),
  resize: (id, cols, rows) => ipcRenderer.send('server:resize', { id, cols, rows }),

  // --- scratch (ad-hoc) terminal (one pty per server, keyed by scratch id) ---
  scratchStart: (id, shell, folder) => ipcRenderer.invoke('scratch:start', { id, shell, folder }),
  scratchStop: (id) => ipcRenderer.invoke('scratch:stop', { id }),
  scratchPrefix: '__scratch__',
  scratchId: '__scratch__', // default/global scratch (no server selected)

  // --- logs / clipboard ---
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  saveLogs: (name, text) => ipcRenderer.invoke('logs:save', { name, text }),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),

  // --- auto-update ---
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (cb) => {
    const h = (_e, payload) => cb(payload);
    ipcRenderer.on('update:status', h);
    return () => ipcRenderer.removeListener('update:status', h);
  },

  // --- events (main -> renderer) ---
  onData: (cb) => {
    const h = (_e, payload) => cb(payload);
    ipcRenderer.on('server:data', h);
    return () => ipcRenderer.removeListener('server:data', h);
  },
  onState: (cb) => {
    const h = (_e, payload) => cb(payload);
    ipcRenderer.on('server:state', h);
    return () => ipcRenderer.removeListener('server:state', h);
  },
});
