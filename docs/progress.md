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

## Notes
- Swapped `node-pty` → `@lydell/node-pty` 1.2.0-beta.12 (prebuilt N-API, no VS C++ compiler needed;
  original node-pty failed: VS Build Tools C++ workload absent).
- xterm UMD globals: `window.Terminal`, `window.FitAddon.FitAddon` (loader handles both shapes).
- Generated `assets/icon.ico` via `scripts/gen-icon.js` (no external deps).
- Toolchain: node v22.13.1, npm 11.13.0, yarn 1.22.22, git 2.47.1 (Git Bash present).
- Electron ^33, node-pty ^1.0, @xterm/xterm ^5.5. `postinstall` runs electron-rebuild for node-pty.
- Dropped `assets/icon.ico` requirement for now (builder uses default icon); window icon set only if file exists. Add a real .ico later for branded exe.
- All source written (steps 3–8). Awaiting `npm install` result to verify node-pty builds against Electron ABI, then `npm start` smoke test.
