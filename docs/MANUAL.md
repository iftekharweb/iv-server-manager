# IV Server Manager — User & Developer Manual

A standalone Windows desktop app to run, restart, and watch logs for any dev server
from one window. Replaces the manual `iv_trip_servers.bat` / Windows-Terminal-tabs
workflow.

- **Tech**: Electron (Node + HTML/CSS/JS)
- **Terminal engine**: `@lydell/node-pty` (real pseudo-terminal, prebuilt — no compiler needed)
- **Display**: `@xterm/xterm`
- **Packaging**: `electron-builder` → Windows `.exe`

---

## 1. Table of contents
1. [Running the app](#2-running-the-app)
2. [Using the app](#3-using-the-app)
3. [Where your data lives](#4-where-your-data-lives)
4. [Shells (cmd / powershell / bash)](#5-shells-cmd--powershell--bash)
5. [Developing & running from source](#6-developing--running-from-source)
6. [Building the .exe (and rebuilding after updates)](#7-building-the-exe-and-rebuilding-after-updates)
7. [Project structure](#8-project-structure)
8. [How it works (architecture)](#9-how-it-works-architecture)
9. [Making common changes](#10-making-common-changes)
10. [Troubleshooting](#11-troubleshooting)

---

## 2. Running the app

You have three ways to run it. All live in the `dist/` folder after a build.

| Option | File | Notes |
|--------|------|-------|
| **Portable (recommended)** | `dist\IV-Server-Manager-Portable.exe` | Single file. Double-click to run. Nothing installed. |
| **Installer** | `dist\IV Server Manager Setup 1.0.0.exe` | Installs to your machine, adds Start-menu + desktop shortcuts, lets you pick the folder. |
| **Folder build** | `dist\win-unpacked\IV Server Manager.exe` | The unpacked app (whole folder must stay together). Useful for debugging a packaged build. |

> Windows SmartScreen may warn "unknown publisher" because the app is **not code-signed**.
> Click **More info → Run anyway**. This is expected for an unsigned in-house tool.

---

## 3. Using the app

### Add a server
1. Click **+ Add Server** (top-right).
2. Fill in:
   - **Name** — label shown in the sidebar (e.g. `backend`).
   - **Folder** — the project directory. Use **Browse…** to pick it.
   - **Command** — what to run there (e.g. `yarn dev`, `npm start`, `yarn admin`).
   - **Shell** — `cmd`, `powershell`, or `bash`.
3. **Save**. The server appears in the left sidebar and is saved permanently.

> **Port (automatic):** there is no Port field. The app auto-detects the port from the
> command (a `-p/--port` flag or a trailing number like `yarn dev 7003`) and, when found,
> frees it PC-wide whenever you Stop or Restart the server — so an orphaned child can't keep
> it bound ("port already in use"). If the command has no port, nothing extra is freed.

> **Reorder:** drag a server card (grab the ⠿ handle) up or down in the sidebar to change
> the order. The new order is saved automatically.
>
> **Git branch:** if a server's folder is a git repo, its current branch shows under the
> command (e.g. `⎇ main`) and in the panel header. Folders without git show nothing.
> It's fetched at app launch (for existing servers), when you add/edit a server, and on each
> Run/Restart, plus polled every few seconds — so switching branches outside the app is
> reflected within seconds. The lookup is async and never blocks a server from starting.
> A small amber dot after the branch name (e.g. `⎇ main ●`) means the repo has uncommitted
> changes; no dot means the working tree is clean.

Example (IVTrip backend):
- Name `backend`
- Folder `C:\Users\iftek\OneDrive\Desktop\ImpleVista\IVTrip\iv_trip_backend`
- Command `yarn dev`
- Shell `cmd`

### Run / Restart / Stop
- **Per server** — use the buttons on each sidebar card: `▶ Run`, `⟳` (restart), `■` (stop).
- **All at once** — top bar: **▶ Run All**, **⟳ Restart All**, **■ Stop All** (the two mass
  actions ask for confirmation first).
- **Per group** — see [Groups](#groups) below.
- Status dot: 🟢 running · ⚪ stopped · 🔴 error.

### Groups
Give servers an optional **Group** (in Add/Edit — free text, suggests existing groups). When
any server has a group, the sidebar shows collapsible group headers, each with **▶ / ⟳ / ■**
buttons that Run / Restart / Stop every server in that group at once, plus a `running/total`
count. Click a header to collapse/expand it. Servers with no group appear under an
**Ungrouped** header. If no server has a group, the list stays flat.
Example: put backend, frontend, admin, and superadmin all in group `IVTrip`, then start the
whole stack with one click on the group's ▶.

### View / copy / save logs
- Click a server to open its **live terminal** in the main panel.
- The terminal is **interactive** — click into it and type, paste, or press **Ctrl+C** to
  signal the running process.
- Panel buttons:
  - **⧉ Copy** — copies the current selection if you've selected text, otherwise the whole
    log buffer (ANSI colors stripped).
  - **✕ Clear** — clears the view.
  - **⤓ Save** — saves the logs to a `.log` file you choose.
- **Find (Ctrl+F)** — opens a search bar over the terminal: type to highlight matches, Enter /
  Shift+Enter for next / previous, a `n/total` counter, Esc to close.
- **Links** — URLs in the output (e.g. `http://localhost:5000`) are clickable and open in your
  default browser.

### Edit / delete
- **✎** edits a server (same form). **🗑** deletes it (asks for confirmation; stops it first if running).

### Default shell
- The top-bar **Default shell** dropdown sets which shell new servers start with.

### Settings (⚙)
The **gear** button (right of *Add Server*) opens Settings, with two tabs:
- **Appearance** — switch between **Dark** and **Light** theme, and set the **terminal font
  size** (10–20px) with the − / + stepper. Both take effect immediately across the whole app
  and every terminal, and are remembered in `servers.json`.
- **About** — app version, developer, tech stack, license, and a link to the source repo.

### Scratch terminal (run ad-hoc commands)
A collapsible terminal is docked on the right edge for one-off commands (install a package,
switch a branch, run a migration) — separate from the per-server log terminals.
- Click the vertical **⌨ Terminal** rail on the right to expand it (drag its left edge to
  resize, up to half the window). **⇥ Hide** minimizes it back; the shell keeps running.
- **Each server has its own scratch terminal**, opened in that server's **folder** using its
  **shell** (falls back to the global default shell / home dir when no server is selected).
- It's a full interactive shell — type any command, Ctrl+C, etc. Anything you do that changes
  the repo (e.g. `git switch`) is reflected in that server's branch indicator within seconds.
- Switching to a different server shows **that server's** scratch terminal. Every scratch
  terminal keeps running in the background — switching projects never interrupts a command
  (e.g. a `yarn install` started under one server keeps going while you work in another). Each
  server's scratch shell is spawned once, the first time you open the dock for it, and stays
  alive until you delete the server or quit the app. **✕ Clear** clears the current view.

### Quitting
- Closing the window stops **all** running servers and kills their full process trees
  (so no orphan `node`/`yarn` processes are left behind).

---

## 4. Where your data lives

Your server list is stored as JSON here:

```
%APPDATA%\iv-server-manager\servers.json
```

(Full path: `C:\Users\<you>\AppData\Roaming\iv-server-manager\servers.json`.)

Shape:
```json
{
  "defaultShell": "cmd",
  "servers": [
    { "id": "srv_...", "name": "backend", "folder": "C:\\...\\iv_trip_backend", "command": "yarn dev", "shell": "cmd", "port": "5000" }
  ]
}
```

- Survives app updates and reinstalls (it's outside the app folder).
- Safe to hand-edit while the app is **closed**. If the file is ever corrupted, the app
  backs it up as `servers.json.corrupt-<timestamp>` and starts fresh — it won't fail to open.
- To reset the app completely, delete this file.

Chromium's caches (GPU/disk/code cache) live separately on a non-synced local path:

```
%LOCALAPPDATA%\iv-server-manager\cache
```

On Windows these are deliberately kept **off** `%APPDATA%`/OneDrive: a synced folder makes
Chromium's cache writes intermittently fail with noisy "GPU disk cache" errors on launch.
The folder is disposable — delete it anytime; it's rebuilt on next start.

---

## 5. Shells (cmd / powershell / bash)

Each server picks its own shell.

On **Windows**:

| Shell | Runs as |
|-------|---------|
| `cmd` | `cmd.exe /d /k <command>` |
| `powershell` | `powershell.exe -NoLogo -NoExit -Command <command>` |
| `bash` | Git Bash `bash.exe -l -i -c "<command>; exec bash -i"` |

On **macOS / Linux** the shells are `bash`, `zsh`, and `sh` (whichever are found on your
PATH), run as `<shell> -i -c "<command>; exec <shell> -i"`. The default shell is `bash`.
The shell dropdown adapts to the platform automatically.

**Bash requires Git for Windows.** The app auto-detects `bash.exe` at the usual install
locations and via `where git`. If Git isn't installed, the `bash` option shows
`bash (not found)` and is disabled. Install Git for Windows to enable it.

---

## 6. Developing & running from source

Prerequisites: **Node.js** (v18+; built/tested on v22) and **npm**.

```bash
# from the project root: C:\Users\iftek\OneDrive\Desktop\ImpleVista\custom-terminal
npm install        # Electron, node-pty (prebuilt), xterm, React, Vite
npm run dev        # Vite dev server + Electron, with hot-reload (HMR)
```

The renderer is a **React + Vite** app (since v1.10.0). `npm run dev` (via `scripts/dev.js`)
starts the Vite dev server and launches Electron pointed at it, so edits hot-reload — no
relaunch needed. The Electron **main** process still has no hot-reload; restart `npm run dev`
after changing anything under `src/main/`.

`npm start` runs plain `electron .` against the **last built** renderer in `build/renderer/`
(run `npm run build:renderer` first) — useful for testing a production-like renderer without
the dev server.

---

## 7. Building the .exe (and rebuilding after updates)

Whenever you change the code and want a fresh `.exe`:

```bash
npm run dist
```

This runs `vite build` (bundles the React renderer to `build/renderer/`) then
`electron-builder --win`, and produces, in `dist/`:
- `IV-Server-Manager-Portable.exe` (single-file portable)
- `IV Server Manager Setup 1.0.0.exe` (installer)
- `win-unpacked/` (folder build)

Other build scripts:
```bash
npm run dist:portable   # only the portable single-file exe (faster)
```

> **Close the app before rebuilding.** If an instance of the app (or a leftover
> `IV Server Manager.exe` / `electron.exe`) is still running, it locks the output `.exe` and
> the single-file packaging step fails partway (folder build updates, but the portable/
> installer stay stale). Quit the app, then `npm run dist`.

### One-time requirement: Windows Developer Mode
`electron-builder` downloads a helper (`winCodeSign`) that extracts files containing
**symbolic links**. Windows blocks creating symlinks unless you either:

- **Enable Developer Mode** — Settings ▸ System ▸ For developers ▸ **Developer Mode → ON**
  (do this once; then normal `npm run dist` works), **or**
- **Build from an elevated (Administrator) terminal**.

If neither is set, the single-file build fails with
`Cannot create symbolic link : A required privilege is not held`. The folder build
(`win-unpacked`) still works without this.

### Releasing a new version
1. Make your code changes.
2. Bump the version in `package.json` (`"version": "1.7.1"`). The installer filename tracks it,
   **and auto-update compares this against the GitHub Releases feed** — forget to bump and no
   one gets the update.
3. `npm run dist`.
4. Share `dist\IV-Server-Manager-Portable.exe` (or the installer).

### Auto-update (electron-updater + GitHub Releases)
Installed (NSIS) copies check GitHub Releases on launch, download a newer version in the
background, and show a top-bar banner with a **Restart & Update** button. To ship an update
that reaches existing installs, publish it to a GitHub Release instead of just building locally:
```powershell
# PowerShell — GH_TOKEN needs a GitHub personal access token with `repo` scope
$env:GH_TOKEN = "ghp_xxx"
npm run dist:publish
```
```cmd
:: cmd.exe equivalent
set GH_TOKEN=ghp_xxx
npm run dist:publish
```
(`dist:publish` = `electron-builder --win --publish always`. Plain `npm run dist` builds
without uploading.)
This uploads the installer + a `latest.yml` metadata file to a Release on
`iftekharweb/iv-server-manager`; the app reads that feed.

Notes / limits:
- **Portable and dev (`npm start`) builds do not auto-update** — they carry no `app-update.yml`,
  so the check is skipped silently. Only NSIS-installed users get updates.
- The exe is **not code-signed**, so each downloaded update still shows a SmartScreen warning on
  install (click *More info → Run anyway*).
- Keep `GH_TOKEN` out of git — pass it as an env var only.

### Changing the app icon
The icon is `assets/icon.ico`, generated by `scripts/gen-icon.js` (a plain terminal
chevron on a dark tile). To use your own icon, replace `assets/icon.ico` with a real
`.ico` (256×256 recommended), then rebuild. To regenerate the placeholder:
```bash
node scripts/gen-icon.js
```

---

## 8. Project structure

```
custom-terminal/
├─ package.json            # deps, scripts, electron-builder config
├─ README.md               # quick start
├─ docs/
│  ├─ MANUAL.md            # this file
│  ├─ plan.md              # design summary
│  └─ progress.md          # build status log
├─ assets/
│  └─ icon.ico             # app + exe icon (generated)
├─ scripts/
│  └─ gen-icon.js          # regenerates icon.ico, no deps
├─ src/
│  ├─ main/                # Electron MAIN process (Node)
│  │  ├─ index.js          # window bootstrap + IPC handlers + quit cleanup
│  │  ├─ config.js         # load/save servers.json
│  │  ├─ shells.js         # shell resolution + Git Bash detection
│  │  ├─ ports.js          # find/free/wait on TCP ports (netstat + taskkill)
│  │  ├─ git.js            # current branch of a folder
│  │  ├─ updater.js        # auto-update via electron-updater + GitHub Releases
│  │  └─ serverManager.js  # pty spawn/restart/stop, taskkill trees
│  ├─ preload.js           # secure bridge → window.api
│  └─ renderer/            # the UI (runs in the window)
│     ├─ index.html        # layout
│     ├─ styles.css        # dark theme
│     └─ app.js            # list rendering, xterm terminals, modal, buttons
└─ dist/                   # build output (created by npm run dist)
```

---

## 9. How it works (architecture)

Electron splits into two worlds; they talk over **IPC**:

- **Main process** (`src/main/`) — full Node access. Owns server lifecycle: spawns each
  server in a real pseudo-terminal (`node-pty`) in the server's folder using the chosen
  shell, streams output back, reads/writes the config file, and kills process trees.
- **Renderer** (`src/renderer/`) — the GUI, a **React + Vite** app (sandboxed, no direct Node
  access). It renders the sidebar and forwards keystrokes to the pty. The xterm engine is kept
  imperative in a singleton `lib/terminalManager.js` (outside React) that owns every terminal,
  its output buffer, and IPC data/state routing; React (`store/AppStore.jsx` + `components/*`)
  owns the chrome and declarative state and drives the manager via refs + callbacks. Built by
  Vite to `build/renderer/`; `react-icons` provides the UI icons.
- **Preload** (`src/preload.js`) — the only bridge. Exposes a small, safe `window.api`
  (e.g. `api.start(id)`, `api.saveServer(...)`, `api.onData(cb)`) so the renderer never
  touches Node directly. This is the secure Electron pattern (`contextIsolation: true`,
  `nodeIntegration: false`).

Data flow for "Run backend":
```
click Run → api.start(id) → IPC → serverManager.start() → node-pty spawns shell in folder
        ← IPC 'server:data' (live output) ← pty.onData ←──────────────────────────┘
renderer writes output into that server's xterm terminal
```

Stopping kills the whole tree with `taskkill /PID <pid> /T /F`, because `yarn`/`npm`
launch child `node` processes that a plain kill would orphan.

---

## 10. Making common changes

| I want to… | Do this |
|------------|---------|
| Change window size / title | `src/main/index.js` → `new BrowserWindow({ width, height, title })` |
| Add a new shell type | `src/main/shells.js` → add a case in `resolveShell` + option in the two `<select>`s in `index.html` |
| Change colors / theme | `src/renderer/styles.css` (`:root` variables) and `XTERM_THEME` in `src/renderer/app.js` |
| Change how much log is kept for Copy/Save | `MAX_BUFFER` in `src/renderer/app.js` |
| Add a button / UI element | markup in `src/renderer/index.html`, wire it in `src/renderer/app.js`, add any IPC in `preload.js` + `src/main/index.js` |
| Change config location/shape | `src/main/config.js` |

After any change: `npm start` to test, then `npm run dist` to rebuild the exe.

---

## 11. Troubleshooting

**"Windows protected your PC" / unknown publisher**
Expected — the app isn't code-signed. Click **More info → Run anyway**.

**Build fails: `Cannot create symbolic link : A required privilege is not held`**
Enable Windows Developer Mode, or run `npm run dist` from an Administrator terminal.
See [section 7](#7-building-the-exe-and-rebuilding-after-updates).

**`bash` option is greyed out / "not found"**
Git for Windows isn't installed (or not in a standard location). Install it from
git-scm.com; the app auto-detects `bash.exe` on next launch.

**A server won't start / immediately exits**
- Check the terminal panel — the process's own error prints there.
- Verify the **Folder** exists and the **Command** works when you run it manually in that
  folder. If the folder is missing, the app warns and falls back to the app's directory.

**"Port already in use" after restarting a server**
The app auto-detects the port from the command (a `-p/--port` flag or a trailing number like
`yarn dev 7003`) and, on Stop/Restart, kills whatever process is listening on it PC-wide —
not just the launched tree — clearing orphaned `nodemon`/`node` children. If the command
doesn't include a port, only the launched tree is killed, which can miss a reparented child;
add the port to the command (e.g. a trailing `5000`) so it can be detected and freed.

**Orphan `node`/`yarn` processes after quitting**
Shouldn't happen — the app runs `taskkill /T` on stop and quit. If you force-kill the app
via Task Manager, cleanup is skipped; stop servers with **Stop All** before quitting.

**`npm install` fails building `node-pty`**
This project uses `@lydell/node-pty` (prebuilt binaries) specifically to avoid needing a
C++ compiler. If you switched back to plain `node-pty`, you'd need Visual Studio Build
Tools with the "Desktop development with C++" workload. Stay on `@lydell/node-pty`.

**Changes don't show up**
There's no hot reload. Close the app and run `npm start` again. For the exe, run
`npm run dist` again.
```
