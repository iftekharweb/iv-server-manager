'use strict';

// Auto-update via electron-updater + GitHub Releases.
//
// On launch (packaged NSIS install only) the app checks the GitHub Releases feed
// declared in package.json `build.publish`. A newer version downloads in the
// background; the renderer shows a small banner and, once ready, a "Restart &
// Update" button. Portable / unpacked / dev builds carry no `app-update.yml`, so
// checks are skipped there — never a hard error for those users.

const { app } = require('electron');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (_) {
  autoUpdater = null; // dependency missing — feature simply off
}

let started = false;

/**
 * Wire the updater. `emit(status, info)` forwards state to the renderer.
 * status ∈ 'checking' | 'available' | 'none' | 'downloading' | 'downloaded' | 'error'
 */
function initAutoUpdate(emit) {
  // Only packaged installs have an update feed; skip in `npm start` and portable.
  if (started || !autoUpdater || !app.isPackaged) return;
  started = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const say = (status, info) => {
    try {
      emit(status, info || {});
    } catch (_) {
      /* renderer gone */
    }
  };

  autoUpdater.on('checking-for-update', () => say('checking'));
  autoUpdater.on('update-available', (i) => say('available', { version: i && i.version }));
  autoUpdater.on('update-not-available', () => say('none'));
  autoUpdater.on('download-progress', (p) =>
    say('downloading', { percent: Math.round((p && p.percent) || 0) })
  );
  autoUpdater.on('update-downloaded', (i) => say('downloaded', { version: i && i.version }));
  autoUpdater.on('error', (err) =>
    say('error', { message: String((err && err.message) || err || 'update error') })
  );

  // Fire and forget; a dead feed (offline / portable) rejects harmlessly.
  autoUpdater.checkForUpdates().catch((err) =>
    say('error', { message: String((err && err.message) || err) })
  );
}

/** Quit and install a downloaded update. Caller must stop servers first. */
function quitAndInstall() {
  if (!autoUpdater || !app.isPackaged) return;
  // isSilent=false, isForceRunAfter=true → relaunch the app post-install.
  autoUpdater.quitAndInstall(false, true);
}

module.exports = { initAutoUpdate, quitAndInstall };
