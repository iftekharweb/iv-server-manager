# IV Server Manager — Plan

Standalone Windows desktop app (Electron, packaged to `.exe`) to run and manage any dev
server from one GUI. Replaces the manual `iv_trip_servers.bat` workflow.

## Features
- GUI dashboard: sidebar server list + interactive terminal panel.
- Add / edit / delete servers via form; persisted to JSON config (survives restarts).
- Run / Restart / Stop per server, plus **Run All** / **Restart All** / **Stop All**.
- Live streaming logs (real pseudo-terminal via `node-pty`), interactive (type input, Ctrl+C).
- **Copy logs** to clipboard, **Clear**, **Save to file**.
- Per-server shell: `cmd` / `powershell` / `bash` (Git Bash, auto-detected). Global default.

## Stack
- Electron (main + preload + renderer), secure config (contextIsolation, no nodeIntegration).
- `node-pty` for pseudo-terminals; `@xterm/xterm` + `@xterm/addon-fit` for display.
- `electron-builder` → portable `.exe` + NSIS installer.

## Data model
```
Server = { id, name, folder, command, shell }   // shell: "cmd" | "powershell" | "bash"
Config = { defaultShell, servers: Server[] }     // stored at userData/servers.json
```

## Shell resolution (Windows)
- `cmd`        → `cmd.exe /d /s /c <command>`
- `powershell` → `powershell.exe -NoExit -Command <command>`
- `bash`       → Git Bash `bash.exe -lc "<command>"` (auto-detect; disabled if Git absent)

Process trees killed with `taskkill /PID <pid> /T /F` on stop & app quit (avoids orphan
`yarn`/`node` children).

## Files
- `src/main/index.js` — bootstrap + IPC
- `src/main/config.js` — servers.json load/save
- `src/main/shells.js` — shell resolution + Git Bash detect
- `src/main/serverManager.js` — pty lifecycle, run/restart/stop all
- `src/preload.js` — `window.api` bridge
- `src/renderer/{index.html,styles.css,app.js}` — UI
- `assets/icon.ico` — app icon

See `progress.md` for status. Full plan archived by Claude at the plan file path.
