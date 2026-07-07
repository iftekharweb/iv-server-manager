# CLAUDE.md — project guide for AI assistants

**IV Server Manager** — Electron Windows desktop app to run/restart/stop any dev server,
view/copy/save live interactive logs, switch shell (cmd/powershell/bash), drag-reorder
servers, show each server's git branch, and free a server's port PC-wide on stop/restart.
Packaged to `.exe` via electron-builder. Replaces the old `iv_trip_servers.bat`.

## Resume with minimal tokens
Read these FIRST — do not re-scan all source:
1. `docs/progress.md` — full change log, decisions, blockers (v1.0 → v1.2).
2. `git log --oneline` — commit-level summary.
3. `docs/ROADMAP.md` — backlog / next work.

Then open only the specific `src/` file a task touches.

## Docs
- `README.md` — quick start.
- `docs/MANUAL.md` — usage, config, shells, building/updating, architecture, troubleshooting.
- `docs/plan.md` — original design.
- `docs/progress.md` — build status + change log.
- `docs/ROADMAP.md` — future improvements + known limitations.

## Key facts (avoid re-discovering)
- Use `@lydell/node-pty`, NOT `node-pty` — this machine has no VS C++ compiler; @lydell is
  prebuilt N-API and works under Electron without a rebuild.
- Single-file `.exe` build needs Windows **Developer Mode ON** (already enabled) or an admin
  terminal — else winCodeSign 7z symlink extraction fails. Folder build is unaffected.
- Dev: `npm start`. Build: `npm run dist` → `dist/` (portable + NSIS installer + win-unpacked).
- Config persists at `%APPDATA%\iv-server-manager\servers.json` (outside the app; survives updates).
- Branch `main`; remote `origin` = https://github.com/iftekharweb/iv-server-manager.git
- GPU disk-cache errors on launch are harmless (OneDrive path).
- `rtk` wrapper is NOT on PATH in the Bash tool — call `git` directly.

## Source layout
```
src/main/index.js          window bootstrap + IPC + quit cleanup
src/main/config.js         load/save servers.json
src/main/shells.js         shell resolution + Git Bash detection
src/main/ports.js          find/free/wait on TCP ports (netstat + taskkill)
src/main/git.js            current branch of a folder
src/main/serverManager.js  pty spawn/restart/stop, taskkill trees
src/preload.js             contextBridge -> window.api
src/renderer/*             UI (index.html, styles.css, app.js)
```

## Architecture (one line)
Electron main process owns server lifecycle via node-pty; renderer is a sandboxed UI with
xterm terminals; they talk over IPC through the `window.api` bridge in `preload.js`.
See `docs/MANUAL.md` §9 for detail.
