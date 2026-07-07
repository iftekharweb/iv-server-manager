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

## Notes
- Swapped `node-pty` → `@lydell/node-pty` 1.2.0-beta.12 (prebuilt N-API, no VS C++ compiler needed;
  original node-pty failed: VS Build Tools C++ workload absent).
- xterm UMD globals: `window.Terminal`, `window.FitAddon.FitAddon` (loader handles both shapes).
- Generated `assets/icon.ico` via `scripts/gen-icon.js` (no external deps).
- Toolchain: node v22.13.1, npm 11.13.0, yarn 1.22.22, git 2.47.1 (Git Bash present).
- Electron ^33, node-pty ^1.0, @xterm/xterm ^5.5. `postinstall` runs electron-rebuild for node-pty.
- Dropped `assets/icon.ico` requirement for now (builder uses default icon); window icon set only if file exists. Add a real .ico later for branded exe.
- All source written (steps 3–8). Awaiting `npm install` result to verify node-pty builds against Electron ABI, then `npm start` smoke test.
