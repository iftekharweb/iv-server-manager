# Roadmap / Future Improvements

Ideas for future versions of IV Server Manager. Not committed work — a backlog.
Roughly ordered by value vs. effort. Check items off as they ship.

## High value / low effort
- [ ] **Auto-start servers on launch** — per-server "start on app open" toggle.
- [ ] **Server groups / profiles** — e.g. "IVTrip" group; run/stop a group at once.
- [ ] **Status bar counts** — "3 running / 4" summary in the top bar.
- [ ] **Confirm before Stop All / Restart All** — avoid accidental mass restarts.
- [ ] **Auto-detect port from command** — parse trailing number (e.g. `yarn dev 7003`) as a
      default for the Port field.
- [ ] **Copy only selection** — Copy button currently copies the whole buffer; add
      "copy selection" when text is selected in the terminal.
- [ ] **Search within logs** — xterm search addon (`@xterm/addon-search`), Ctrl+F.
- [ ] **Clickable links in logs** — xterm web-links addon (open `http://localhost:...`).

## Medium
- [x] **Live git branch refresh** — branch polls every 4s + refreshes on server start, so
      switching branches while the app is open updates within seconds.
- [ ] **Git dirty indicator** — show `*` when the repo has uncommitted changes.
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
- [ ] **Split / tiled terminals** — view multiple server logs at once.
- [ ] **Tabs instead of single panel** — keep several terminals visible via tabs.
- [ ] **Theme options** — light theme + font-size control.
- [ ] **Notifications** — OS toast when a server crashes or finishes building.
- [ ] **Cross-platform** — macOS/Linux support (shell resolution + `taskkill` are
      Windows-specific today; would need `pkill`/`kill` equivalents).
- [ ] **Global hotkeys** — e.g. focus app / restart active server from anywhere.
- [ ] **Config export/import** — share a `servers.json` across machines/teammates.

## Technical / hardening
- [ ] **Code-sign the exe** — removes the SmartScreen "unknown publisher" warning.
- [ ] **Auto-update** — `electron-updater` + GitHub Releases feed.
- [ ] **Reduce bundle size** — trim unused Electron locales; consider Tauri if size matters.
- [ ] **Fix GPU cache warnings** — set a writable `userData`/cache path off OneDrive.
- [ ] **Tests** — unit tests for `ports.js`, `shells.js`, `git.js`, `config.js`;
      smoke test for spawn/stream.
- [ ] **Graceful stop option** — try SIGINT/Ctrl+C before force `taskkill /F`, so servers
      can clean up (flush DB connections, remove pid files).

## Known limitations (today)
- Windows-only (shell + kill logic).
- Not code-signed → SmartScreen warning on first run.
- No hot reload in dev; relaunch `npm start` after code changes.
