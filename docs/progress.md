# Progress — IV Server Manager

Status legend: ⬜ todo · 🟨 in progress · ✅ done · ⚠️ blocked

## Steps
- ✅ 1. Create `plan.md` + `progress.md`
- 🟨 2. Scaffold `package.json` + folders, install deps (`node-pty` native build check)
- ✅ 3. Main bootstrap (`src/main/index.js`) + secure window
- ✅ 4. Config module (`servers.json`)
- ✅ 5. Shells module + Git Bash detection
- ✅ 6. Server manager (node-pty spawn/restart/stop, taskkill tree)
- ✅ 7. Preload `window.api`
- ✅ 8. Renderer UI (sidebar, terminal, add/edit modal, copy/save)
- ✅ 9. Package to `.exe` — all three built:
       - `dist/win-unpacked/IV Server Manager.exe` (folder build)
       - `dist/IV Server Manager Setup 1.0.0.exe` (NSIS installer, 80MB)
       - `dist/IV-Server-Manager-Portable.exe` (single-file portable, 79MB)
- ✅ 10. Verification — module-level (config, 3 shells, pty stream, taskkill) + app boots clean.
        Remaining: manual GUI click-test (run/restart/stop, copy/save, persistence).

## Build note: winCodeSign symlink (RESOLVED)
Single-file build first failed: winCodeSign 7za "Cannot create symbolic link" on darwin/*.dylib.
Fixed by enabling Windows Developer Mode, then `npm run dist`. To rebuild later, keep Dev Mode ON
(or build from an elevated terminal).

## v1.1 changes (post-release)
- Drag-to-reorder servers in sidebar (grip handle; order persisted via `config:reorder`).
- Optional per-server **Port** field. On Stop/Restart the port is freed PC-wide: `taskkill /T /F`
  the pty tree, then `netstat`-find + kill any process still LISTENING on the port
  (`src/main/ports.js`). Restart waits until port free (≤5s) before respawn.
  Fixes orphaned nodemon `node` holding port 5000. Verified: freePorts killed a detached
  listener on :5599 and confirmed free.

## v1.2 changes
- Fixed: after Restart All, some servers showed no green dot though running. Cause: the OLD
  pty's late `onExit` deleted the newly-started entry + emitted `stopped`. Fix: `onExit` now
  no-ops if the map entry for that id is no longer the same pty (identity guard in
  `serverManager.start`).
- Added: git branch per server. `src/main/git.js` runs `git -C <folder> rev-parse
  --abbrev-ref HEAD`; null if not a repo / git missing. Shown under command in sidebar and
  in panel header. Verified: repo→branch, non-repo→null, detached→"(detached)".

## v1.3 changes
- Fixed: git branch label went stale when switching branches outside the app. Branch now
  polls every 4s (`setInterval(loadBranches, 4000)`) and refreshes on any server 'running'
  state change; `loadBranches` re-renders only when a branch value actually changed.
  (`src/renderer/app.js`). Branch is fetched at launch/add/edit/run + poll; async, never
  blocks spawning.
- Build gotcha: rebuild once left stale single-file exes because a leftover boot-test
  `electron.exe` locked the output. Always close the app before `npm run dist`.
- Added: git dirty indicator. `getBranch` now returns `{branch, dirty}` (dirty via
  `git status --porcelain`); UI shows an amber dot after the branch when uncommitted changes
  exist. `src/main/git.js` + `src/renderer/app.js` (branches map now holds an object).

## v1.4 changes
- Added: collapsible scratch terminal docked right (`#scratchDock`). Interactive shell for
  ad-hoc commands, opens in active server's folder + shell (fallback default). Expand via
  rail, drag left edge to resize (≤50vw), Hide minimizes (pty stays alive). Auto-follows the
  active server: switching server reopens the scratch shell in that folder (only while
  expanded, so a running command isn't killed). Reuses pty pipeline under reserved id `__scratch__`
  (`ServerManager.SCRATCH_ID`); `resolveShell` now supports empty command = interactive shell.
  New IPC `scratch:start`/`scratch:stop`. Verified: interactive cmd shell echoes typed input.

## v1.5 changes
- Added: server groups. Optional `group` field per server (config + Add/Edit modal with
  datalist of existing groups). Sidebar renders collapsible group headers with per-group
  Run/Restart/Stop; ungrouped servers under "Ungrouped"; flat list when no groups.
  serverManager gains `stopMany`/`restartMany` (reused by stopAll/restartAll); IPC
  `server:runGroup|stopGroup|restartGroup`. `src/renderer/app.js` renderList regrouped.

## v1.6 changes (roadmap batch)
- Confirm dialog before Stop All / Restart All (top-bar mass actions).
- Auto-detect port from command (`-p/--port` flag or trailing number) → fills Port field.
- Copy button copies the terminal selection when present, else the whole buffer.
- Search in logs: Ctrl+F find bar (next/prev, match count) via `@xterm/addon-search`.
- Clickable links: `@xterm/addon-web-links`; URLs open via `shell.openExternal` (IPC
  `open:external`). Both addons loaded on server + scratch terminals (`loadCommonAddons`).

## v1.7 changes
- Cross-platform support. `shells.js`, `ports.js`, `serverManager.killPidTree`, and
  `config.js` are now platform-aware:
  - Windows: cmd/powershell/Git-bash, `netstat`+`taskkill /T`, `.ico`.
  - macOS/Linux: bash/zsh/sh (detected on PATH), `lsof -t`+`kill -9`, process-group
    `kill(-pid)`; default shell `bash`.
  - Config shell validation broadened to a cross-OS superset; renderer builds the shell
    dropdown dynamically from the platform's available shells (`buildShellOptions`).
  - Build targets added: mac (dmg/zip), linux (AppImage/deb) + `dist:mac`/`dist:linux`
    scripts. Must be built on the respective OS. Windows behavior unchanged.

## v1.7.0 changes — Auto-update
- Added: auto-update via `electron-updater` + GitHub Releases. New `src/main/updater.js`
  (`initAutoUpdate` / `quitAndInstall`); wired in `index.js` on app-ready (`update:status`
  events → renderer) + IPC `update:install` (stops servers, then `quitAndInstall`). Preload
  exposes `onUpdateStatus` / `installUpdate`. Renderer shows a top-bar banner
  (`#updateBar`, `wireUpdates` in `app.js`): "downloading… %" → "ready" + **Restart &
  Update** button. `package.json`: added `electron-updater` dep, `build.publish` (github,
  iftekharweb/iv-server-manager), and bumped `version` 1.0.0 → 1.7.0 (was stale; updater
  compares this against the release feed).
- Guards: checks run only when `app.isPackaged` — `npm start` and portable builds carry no
  `app-update.yml`, so they skip silently (feed errors are swallowed, no user-facing noise).
  Unsigned exe still triggers SmartScreen on each install (code-signing deferred).
- Publish a release: set `GH_TOKEN` then `npm run dist:publish` (=`electron-builder --win
  --publish always`; uploads exe + `latest.yml` to a GitHub Release). Must bump `version`
  each release or nothing updates.
- Verified: dev boot clean (electron ran ~10s, no stderr, updater skipped as unpackaged);
  `node --check` passed on all four changed JS files.

## v1.7.1 changes
- Reduce bundle size: added `electronLanguages: ["en-US"]` to `build` in package.json, so the
  packaged app ships one locale `.pak` instead of 55. Windows NSIS installer 79.5 MB → 72.4 MB
  (~7 MB). Verified by diffing dist output + counting `win-unpacked/locales/*.pak` (55 → 1).
- Added: app version shown in the top bar next to the brand (`#appVersion`, dim `vX.Y.Z`).
  `app.getVersion()` via IPC `app:version` → preload `getVersion` → set in `init`. Makes an
  auto-update visually confirmable (version changes after Restart & Update).
- First release used to exercise the auto-update flow: baseline v1.7.0 installer built +
  installed, then v1.7.1 published to GitHub Releases; installed 1.7.0 detected/downloaded/
  installed it via the banner.

## v1.7.2 changes
- Fixed GPU/disk cache warnings on launch. On Windows, `src/main/index.js` relocates
  `sessionData` to `%LOCALAPPDATA%\iv-server-manager\cache` (+ `disk-cache-dir` switch) before
  app ready, so Chromium's GPUCache/Cache/Code Cache no longer live under the OneDrive-synced
  tree where cache writes intermittently failed. `servers.json` stays in userData (`%APPDATA%`)
  — only caches moved, no migration. Verified: dev boot creates GPUCache/Cache/DawnWebGPUCache
  etc. under LOCALAPPDATA, app boots clean.

## v1.8.0 changes — Theme options + font size
- Added a **Settings modal** (gear button right of Add Server, `#settingsOverlay`) with two
  tabs: **Appearance** and **About** (`wireSettings` in `src/renderer/app.js`).
- Appearance: **Dark/Light theme** segmented toggle + **terminal font-size** stepper (10–20px).
  Both apply live and persist in `servers.json` (`theme`, `fontSize` — added to `config.js`
  defaults/validation; new IPC `config:setSettings`, preload `setSettings`).
- Light theme: `styles.css` gained a `:root[data-theme="light"]` block; hardcoded hexes were
  promoted to CSS vars (`--bg-hover`, `--bg-active`, `--term-bg`, `--accent-bg`, `--accent-text`,
  `--scrollbar*`, `--overlay`, `--shadow`) so one attribute flips the whole app. Colored buttons
  get light-specific hues for contrast. Terminals switch to `XTERM_THEME_LIGHT` live.
- Font size: `applyFontSize` sets `term.options.fontSize` on every terminal (server + scratch)
  and refits; both xterm ctors now read `state.fontSize` / `currentXtermTheme()`.
- `applyTheme` paints `data-theme` on `<html>` at launch from saved config, before first render.
- Verified: dev boot clean; both themes rendered via headless preview (real styles.css) —
  layout, segmented control, stepper, font preview, About grid all correct in dark and light.
- Bump to 1.8.0.

## v1.9.0 changes — Per-server scratch terminals
- Fixed: switching the active project killed a command running in the scratch terminal (e.g.
  `yarn install`). Cause: one shared scratch pty (`__scratch__`) that `selectServer` respawned
  in the new server's folder on every switch (`autoFollowScratch` → `startScratch` →
  `scratch.term.reset()` + `scratchStart`, and main `startScratch` did `stop(SCRATCH_ID)` then
  respawn). Per-server *log* terminals were already safe (own xterm each; switch only toggles a
  `.visible` class) — only the scratch dock was affected.
- Change: the scratch terminal is now **one pty + xterm per server**, keyed
  `__scratch__<serverId>` (bare prefix = default/global scratch when no server selected).
  Spawned lazily on first open, shown/hidden by toggling `.visible` like the log terminals, and
  **never respawned on switch** — so a command survives switching projects. Renderer replaced
  the `scratch` singleton with a `scratches` Map + helpers (`scratchIdFor`, `isScratchPtyId`,
  `ensureScratchTerm(serverId)`, `ensureScratchStarted`, `showScratch`, `syncScratchToActive`
  replacing `autoFollowScratch`). `handleData`/`handleState` route scratch by id prefix
  (`handleState` clears `started` on a scratch `stopped` so typing `exit` lets it respawn).
  `forEachTerm`/`applyFontSize`/`activeSearch`/`deleteServer` updated for the Map.
- Main: `startScratch(scratchId, shell, folder)` + `stopScratch(scratchId)` now take an id;
  added `ServerManager.isScratchId`. IPC `scratch:start`/`scratch:stop` pass `{ id, … }`; preload
  `scratchStart(id, shell, folder)`/`scratchStop(id)` + new `scratchPrefix`. `config:deleteServer`
  now also stops that server's scratch pty. Quit cleanup unchanged (`stopAll` covers all ids).
  CSS: `.scratch-term` gained `position: relative` (+ dropped its padding) so the per-server
  `.term-host` children (absolute, inset:0) layer inside it.
- Incidental fix: `src/renderer/app.js` had a stray NUL byte (offset 5150) in `branchKey`'s
  template literal where a space belonged — replaced with a space (made the file read as binary).
- Verified: `node --check` on all 4 changed JS files; dev boot clean (electron up ~9s, no
  stderr). Interactive test matrix (switch mid-`yarn install`, delete-while-running, theme/font
  refit, quit cleanup) left for manual GUI click-test. Bump 1.8.0 → 1.9.0.

## v1.9.1 changes — Remove Port field from modal
- Removed the **Port (optional)** input (and its hint) from the Add/Edit Server modal; Shell
  is now a full-width field. `src/renderer/index.html`.
- Port is still auto-detected from the command on save (`detectPort` — `-p/--port` flag or a
  trailing number) so PC-wide port-freeing on Stop/Restart keeps working with no UI. Editing a
  server preserves its existing saved port when the command yields none. Dropped the
  `fCommand`→`fPort` auto-fill listener and `fPort` reads in `openModal`/`onSubmitServer`
  (`src/renderer/app.js`). No changes to `config.js` (port still a valid stored field) or the
  main-process port logic.
- Docs: MANUAL updated (Add-a-server + "Port already in use" troubleshooting now describe
  auto-detect, no field). Bump 1.9.0 → 1.9.1.
- Verified: `node --check` on app.js; no remaining `fPort` references.

## v1.9.2 changes — About section developer info
- Settings ▸ About now credits the developer: **Iftekhar Md Shishir** — Software Engineer at
  ImpleVista, University of Rajshahi, iftekharweb@gmail.com. Added Role / Education / Contact
  rows to the About grid (`src/renderer/index.html`); email is plain selectable text (the
  renderer's `openExternal` only allows http(s), so a mailto link wouldn't open). Bump → 1.9.2.

## v1.10.0 changes — Renderer migrated to React + Vite
Renderer rewritten from one ~1000-line vanilla `app.js` to a React app bundled by Vite;
`react-icons` (Feather) replaces the unicode glyph buttons. Main process + preload + the whole
`window.api` IPC surface are UNCHANGED — behavior is identical. Delivered in staged commits.
- **Toolchain**: `vite.config.js` (root `src/renderer`, `base:'./'` for file://, outDir
  `build/renderer` — NOT `dist/`, which electron-builder owns; `modulePreload.polyfill:false`).
  `scripts/dev.js` starts Vite then spawns Electron with `VITE_DEV_SERVER_URL`. `src/main/index.js`
  loads that URL in dev, else `build/renderer/index.html` in prod.
- **Scripts**: `npm run dev` (Vite + Electron + HMR) for development; `npm start` loads the built
  renderer; `build:renderer` = `vite build`; every `dist*` now runs `vite build` first.
- **Architecture**: the xterm engine stays IMPERATIVE in a singleton
  `src/renderer/lib/terminalManager.js` (owns all xterm instances, hosts, copy/save buffer, IPC
  data/state routing, fit/resize, theme/font, per-server scratch, search) — because terminals
  persist across selection (toggle `.visible`, never unmount) and are lazily created on IPC data
  even for unselected servers, which fights React's model. React owns chrome + declarative state
  via `store/AppStore.jsx` (Context + useReducer) and `components/*` (TopBar, UpdateBanner,
  ServerList/ServerItem/GroupHeader, TerminalPanel/SearchBar, ScratchDock, AddEditModal,
  SettingsModal). React feeds the manager through refs + callbacks; the manager appends into
  empty `.term-mount`/`.scratch-mount` layers so React never reconciles manager-owned DOM.
  StrictMode/HMR-safe (guarded init/subscribe; singleton on `globalThis`).
- **Security**: strict CSP injected into the built `index.html` only (dev needs Vite's inline
  react-refresh preamble); `style-src 'unsafe-inline'` for xterm's injected styles.
- **Packaging**: `@xterm/*` + `react*` moved to devDependencies (Vite bundles them; electron-builder
  prunes them from the shipped `node_modules`); `dependencies` now just `@lydell/node-pty` +
  `electron-updater`. `files` ships `src/main/**` + `src/preload.js` + `build/renderer/**` (not
  `src/renderer` sources). `asarUnpack` @lydell kept. Deleted the old `src/renderer/app.js`.
- Verified: `vite build` clean (58 modules); full `npm run dist` packages NSIS + portable; the
  packaged app boots with the strict CSP and NO violations/errors; asar audit shows
  `build/renderer` present, `@xterm`/`react` absent from `node_modules`, `@lydell` node-pty intact.
  Bump 1.9.2 → 1.10.0. (Live UI parity is a manual click-test.)

## Notes
- Swapped `node-pty` → `@lydell/node-pty` 1.2.0-beta.12 (prebuilt N-API, no VS C++ compiler needed;
  original node-pty failed: VS Build Tools C++ workload absent).
- xterm UMD globals: `window.Terminal`, `window.FitAddon.FitAddon` (loader handles both shapes).
- Generated `assets/icon.ico` via `scripts/gen-icon.js` (no external deps).
- Toolchain: node v22.13.1, npm 11.13.0, yarn 1.22.22, git 2.47.1 (Git Bash present).
- Electron ^33, node-pty ^1.0, @xterm/xterm ^5.5. `postinstall` runs electron-rebuild for node-pty.
- Dropped `assets/icon.ico` requirement for now (builder uses default icon); window icon set only if file exists. Add a real .ico later for branded exe.
- All source written (steps 3–8). Awaiting `npm install` result to verify node-pty builds against Electron ABI, then `npm start` smoke test.
