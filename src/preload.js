'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // --- config ---
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveServer: (server) => ipcRenderer.invoke('config:saveServer', server),
  deleteServer: (id) => ipcRenderer.invoke('config:deleteServer', id),
  setDefaultShell: (shell) => ipcRenderer.invoke('config:setDefaultShell', shell),
  reorder: (orderedIds) => ipcRenderer.invoke('config:reorder', orderedIds),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
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

  // --- scratch (ad-hoc) terminal ---
  scratchStart: (shell, folder) => ipcRenderer.invoke('scratch:start', { shell, folder }),
  scratchStop: () => ipcRenderer.invoke('scratch:stop'),
  scratchId: '__scratch__',

  // --- logs / clipboard ---
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  saveLogs: (name, text) => ipcRenderer.invoke('logs:save', { name, text }),

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
