'use strict';

// Dev launcher: start the Vite dev server programmatically, wait until it is
// actually listening, then spawn Electron with VITE_DEV_SERVER_URL pointing at
// it. Doing it in this order avoids the race where Electron boots before Vite is
// ready (which would load a blank page). Cross-platform, no cross-env/wait-on.

const { spawn } = require('child_process');
const electron = require('electron'); // resolves to the electron binary path

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer(); // reads vite.config.js
  await server.listen();

  const urls = server.resolvedUrls && server.resolvedUrls.local;
  const url = (urls && urls[0]) || `http://localhost:${server.config.server.port}/`;
  server.printUrls();

  const child = spawn(electron, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: url },
  });

  const shutdown = () => {
    server.close().finally(() => process.exit(0));
  };
  child.on('close', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})().catch((err) => {
  console.error('[dev] failed to start:', err);
  process.exit(1);
});
