# IV Server Manager

Windows desktop app to run, restart, and watch logs for any dev server from one window.
Add servers (folder + command + shell), Run/Restart/Stop them individually or all at once,
view live interactive logs, copy/save them, and switch shell (cmd / powershell / bash).

## Quick start

**Run the built app:** `dist\IV-Server-Manager-Portable.exe` (double-click, no install).

**From source:**
```bash
npm install
npm start
```

**Build the .exe:**
```bash
npm run dist        # portable + installer + folder build → dist/
```
> First time: enable Windows Developer Mode (Settings ▸ System ▸ For developers) or build
> from an Administrator terminal — needed for the packaging step.

## Full docs

See **[docs/MANUAL.md](docs/MANUAL.md)** — usage, config, shells, building/updating,
architecture, and troubleshooting.

Planned work: **[docs/ROADMAP.md](docs/ROADMAP.md)**.
