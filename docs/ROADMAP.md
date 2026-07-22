# Roadmap / Future Improvements

Ideas for future versions of IV Server Manager. Not committed work — a backlog.
Roughly ordered by value vs. effort. Check items off as they ship.

## High value / low effort
- [ ] **Auto-start servers on launch** — per-server "start on app open" toggle.
- [x] **Server groups / profiles** — optional per-server group; sidebar shows collapsible
      group headers with per-group Run/Restart/Stop. Ungrouped servers under an "Ungrouped"
      header; flat list when no groups exist.
- [ ] **Status bar counts** — "3 running / 4" summary in the top bar.
- [x] **Confirm before Stop All / Restart All** — confirm dialog guards the mass actions.
- [x] **Auto-detect port from command** — parses `-p/--port` flag or a trailing number
      (e.g. `yarn dev 7003`) to auto-fill the Port field.
- [x] **Copy only selection** — Copy copies the terminal selection when there is one,
      otherwise the whole buffer.
- [x] **Search within logs** — Ctrl+F opens a find bar (next/prev, match count) using
      `@xterm/addon-search`.
- [x] **Clickable links in logs** — `@xterm/addon-web-links`; URLs open in the default
      browser via `shell.openExternal`.

## Medium
- [x] **Live git branch refresh** — branch polls every 4s + refreshes on server start, so
      switching branches while the app is open updates within seconds.
- [x] **Git dirty indicator** — amber dot after the branch name when the repo has
      uncommitted changes (`git status --porcelain`).
- [ ] **Per-server env vars** — key/value list injected into the spawn env.
- [ ] **Restart on crash** — optional auto-restart with backoff when a server exits non-zero.
- [ ] **Log persistence to disk** — rolling log file per server, survives app restart.
- [ ] **Health check / port-up indicator** — poll the server's port and show "listening"
      vs "starting" vs "down" distinctly.
- [ ] **Reorder-safe multi-select** — bulk actions on selected servers.
- [ ] **Duplicate server** — clone an existing config as a starting point.
- [ ] **Import from .bat / package.json scripts** — bulk-add servers by parsing an existing
      `wt` batch file or a project's `scripts`.

## Larger / nice-to-have
- [x] **Ad-hoc scratch terminal** — collapsible right-docked interactive shell for one-off
      commands (install, git switch, migrations), opens in the active server's folder/shell.
      **Per-server & persistent (v1.9.0):** each server keeps its own scratch pty, so switching
      projects shows that server's terminal and never interrupts a running command.
- [ ] **Split / tiled terminals** — view multiple server logs at once.
- [ ] **Tabs instead of single panel** — keep several terminals visible via tabs.
- [x] **Theme options** — light theme + terminal font-size control, in a Settings modal
      (gear icon right of Add Server) with an Appearance tab (Dark/Light segmented toggle,
      font-size stepper 10–20px) and an About tab. Both persist in `servers.json` and apply
      live to the UI and every terminal (xterm gets a matching light theme).
- [ ] **Notifications** — OS toast when a server crashes or finishes building.
- [x] **Cross-platform** — shell resolution, port-freeing, and process-kill are now
      platform-aware (Windows: cmd/powershell/Git-bash, netstat, taskkill; macOS/Linux:
      bash/zsh/sh, lsof, process-group kill). Build targets added for mac (dmg/zip) and
      linux (AppImage/deb); must be built on those OSes.
- [ ] **Global hotkeys** — e.g. focus app / restart active server from anywhere.
- [ ] **Config export/import** — share a `servers.json` across machines/teammates.

## Technical / hardening
- [x] **React + Vite renderer (v1.10.0)** — renderer rewritten from vanilla `app.js` to React
      bundled by Vite, with `react-icons`. xterm engine stays imperative in a `TerminalManager`
      singleton; React owns chrome + state. Foundation for tabs / split terminals below.
- [x] **Dark scrollbars** — replaced default white OS scrollbars with subtle dark thumbs
      (webkit + firefox), including the xterm viewport.
- [ ] **Code-sign the exe** — removes the SmartScreen "unknown publisher" warning.
- [x] **Auto-update** — `electron-updater` checks the GitHub Releases feed on launch
      (packaged NSIS installs only), downloads a newer version in the background, and shows
      a top-bar banner with a "Restart & Update" button. Publish via `npm run dist --
      --publish always` with `GH_TOKEN` set. Portable/dev builds skip the check.
- [x] **Reduce bundle size** — `electronLanguages: ["en-US"]` in the build config ships only
      one locale `.pak` instead of 55. Windows installer dropped ~7 MB (79.5 → 72.4 MB). Tauri
      migration remains an open option if size matters more later.
- [x] **Fix GPU cache warnings** — on Windows, `sessionData` (Chromium's GPU/disk/code caches)
      is relocated to `%LOCALAPPDATA%\iv-server-manager\cache`, off the OneDrive-synced tree,
      before app ready (`src/main/index.js`). `servers.json` stays in `%APPDATA%` (userData).
- [ ] **Tests** — unit tests for `ports.js`, `shells.js`, `git.js`, `config.js`;
      smoke test for spawn/stream.
- [ ] **Graceful stop option** — try SIGINT/Ctrl+C before force `taskkill /F`, so servers
      can clean up (flush DB connections, remove pid files).

## Known limitations (today)
- Primary target is Windows; macOS/Linux are supported in code but less tested, and their
  installers must be built on those OSes.
- Not code-signed → SmartScreen warning on first run.
- No hot reload in dev; relaunch `npm start` after code changes.
