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
- Renderer is **React + Vite** (since v1.10.0). Dev: `npm run dev` (Vite dev server + Electron +
  HMR, via `scripts/dev.js`). `npm start` runs Electron against the last `build/renderer` build
  (no dev server). Build: `npm run dist` (runs `vite build` → `build/renderer/` first, then
  electron-builder) → `dist/`. Renderer bundle output is `build/renderer/` (gitignored), NOT `dist/`.
- xterm engine stays imperative in `src/renderer/lib/terminalManager.js` (outside React); React
  owns chrome + state (`store/AppStore.jsx` Context+reducer, `components/*`). Icons via `react-icons`.
  `@xterm/*` + `react*` are devDependencies (Vite bundles them); runtime deps are just
  `@lydell/node-pty` + `electron-updater`.
- Config persists at `%APPDATA%\iv-server-manager\servers.json` (outside the app; survives updates).
- Branch `main`; remote `origin` = https://github.com/iftekharweb/iv-server-manager.git
- GPU disk-cache errors on launch are harmless (OneDrive path).
- Close/kill any running app instance before `npm run dist` — a live `IV Server Manager.exe`
  locks the output exe and the single-file packaging fails (folder build updates, portable/
  installer stay stale). Kill `electron.exe` + `IV Server Manager.exe`, then rebuild.
- `rtk` wrapper is NOT on PATH in the Bash tool — call `git` directly.
- Git branch per server: fetched at launch/add/edit/run + polled every 4s; async, never
  blocks spawning. Logic in `src/renderer/app.js` (`loadBranches`) + `src/main/git.js`.

## Source layout
```
src/main/index.js          window bootstrap + IPC + quit cleanup
src/main/config.js         load/save servers.json
src/main/shells.js         shell resolution + Git Bash detection
src/main/ports.js          find/free/wait on TCP ports (netstat + taskkill)
src/main/git.js            current branch of a folder
src/main/updater.js        auto-update via electron-updater + GitHub Releases feed
src/main/serverManager.js  pty spawn/restart/stop, taskkill trees; scratch terminal (SCRATCH_ID)
src/preload.js             contextBridge -> window.api
src/renderer/index.html    Vite entry (root div + module script + prod CSP)
src/renderer/main.jsx      React bootstrap (imports styles.css + xterm css)
src/renderer/App.jsx       layout shell
src/renderer/store/        AppStore.jsx (Context + useReducer, actions, bootstrap)
src/renderer/lib/          terminalManager.js (imperative xterm engine, outside React)
src/renderer/components/   TopBar, ServerList/ServerItem/GroupHeader, TerminalPanel/SearchBar,
                           ScratchDock, AddEditModal, SettingsModal, UpdateBanner
src/renderer/styles.css    theme + layout (class-based, data-theme)
vite.config.js             renderer build (root src/renderer, base './', outDir build/renderer)
scripts/dev.js             dev launcher (Vite server + Electron with VITE_DEV_SERVER_URL)
```

## Features
Run/restart/stop servers (+ all), interactive live logs (copy/clear/save), per-server shell,
drag-reorder, per-server git branch + dirty dot, free port on stop/restart, and a collapsible
right-docked **scratch terminal** for ad-hoc commands (opens in active server's folder/shell).

## Architecture (one line)
Electron main process owns server lifecycle via node-pty; renderer is a sandboxed UI with
xterm terminals; they talk over IPC through the `window.api` bridge in `preload.js`.
See `docs/MANUAL.md` §9 for detail.
