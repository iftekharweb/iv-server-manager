'use strict';

const fs = require('fs');
const { execSync } = require('child_process');

const isWin = process.platform === 'win32';

let cachedBashPath; // undefined = not looked up, null = not found, string = path

/**
 * Locate Git Bash on Windows. Tries common install locations, then derives from
 * `where git`. Result is cached for the process lifetime.
 * @returns {string|null} absolute path to bash.exe, or null if not found.
 */
function findGitBash() {
  if (cachedBashPath !== undefined) return cachedBashPath;

  const candidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    process.env.ProgramW6432 && `${process.env.ProgramW6432}\\Git\\bin\\bash.exe`,
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Programs\\Git\\bin\\bash.exe`,
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        cachedBashPath = c;
        return c;
      }
    } catch (_) {
      /* ignore */
    }
  }

  // Derive from `where git` -> <gitroot>\cmd\git.exe -> <gitroot>\bin\bash.exe
  try {
    const out = execSync('where git', { encoding: 'utf8' }).split(/\r?\n/)[0].trim();
    if (out) {
      const gitRoot = out.replace(/\\cmd\\git\.exe$/i, '').replace(/\\bin\\git\.exe$/i, '');
      const derived = `${gitRoot}\\bin\\bash.exe`;
      if (fs.existsSync(derived)) {
        cachedBashPath = derived;
        return derived;
      }
    }
  } catch (_) {
    /* git not on PATH */
  }

  cachedBashPath = null;
  return null;
}

/** Is a binary resolvable on PATH (POSIX)? */
const onPathCache = {};
function onPath(bin) {
  if (bin in onPathCache) return onPathCache[bin];
  try {
    execSync(`command -v ${bin}`, { stdio: 'ignore' });
    onPathCache[bin] = true;
  } catch (_) {
    onPathCache[bin] = false;
  }
  return onPathCache[bin];
}

/**
 * Which shells are usable on this machine. Keys are shell ids; values booleans.
 * - Windows: cmd, powershell, bash (bash only if Git Bash is installed).
 * - macOS/Linux: bash, zsh, sh (only those found on PATH; sh is assumed present).
 * @returns {Record<string, boolean>}
 */
function availableShells() {
  if (isWin) {
    return { cmd: true, powershell: true, bash: findGitBash() !== null };
  }
  return { bash: onPath('bash'), zsh: onPath('zsh'), sh: true };
}

/**
 * Resolve a shell id + command into a spawnable file/args pair for node-pty.
 * When command is empty the shell opens interactively (used by the scratch
 * terminal). Handles both Windows and POSIX; a shell id from another OS falls
 * back to a sensible local default.
 * @param {string} shell
 * @param {string} command
 * @returns {{file: string, args: string[]}}
 */
function resolveShell(shell, command) {
  const hasCmd = String(command || '').trim().length > 0;

  if (isWin) {
    switch (shell) {
      case 'powershell':
        return {
          file: 'powershell.exe',
          args: hasCmd ? ['-NoLogo', '-NoExit', '-Command', command] : ['-NoLogo', '-NoExit'],
        };
      case 'bash': {
        const bash = findGitBash();
        if (!bash) throw new Error('Git Bash (bash.exe) not found on this machine.');
        return {
          file: bash,
          args: hasCmd ? ['-l', '-i', '-c', `${command}; exec bash -i`] : ['-l', '-i'],
        };
      }
      case 'cmd':
      default:
        return { file: 'cmd.exe', args: hasCmd ? ['/d', '/k', command] : ['/k'] };
    }
  }

  // POSIX (macOS / Linux)
  const avail = availableShells();
  // Map Windows shell ids (from a config authored elsewhere) to a local shell.
  let sh = shell;
  if (!(sh in avail) || !avail[sh]) sh = avail.bash ? 'bash' : avail.zsh ? 'zsh' : 'sh';
  // Run the command, then drop into an interactive shell so the window stays open.
  return {
    file: sh,
    args: hasCmd ? ['-i', '-c', `${command}; exec ${sh} -i`] : ['-i'],
  };
}

module.exports = { findGitBash, availableShells, resolveShell };
