'use strict';

const fs = require('fs');
const { execSync } = require('child_process');

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

/**
 * Which shells are usable on this machine (bash only if Git Bash exists).
 * @returns {{cmd: boolean, powershell: boolean, bash: boolean}}
 */
function availableShells() {
  return {
    cmd: true,
    powershell: true,
    bash: findGitBash() !== null,
  };
}

/**
 * Resolve a shell name + command into a spawnable file/args pair for node-pty.
 * The command is run to completion by the shell within the server's folder.
 * @param {"cmd"|"powershell"|"bash"} shell
 * @param {string} command
 * @returns {{file: string, args: string[]}}
 */
function resolveShell(shell, command) {
  switch (shell) {
    case 'powershell':
      return {
        file: 'powershell.exe',
        args: ['-NoLogo', '-NoExit', '-Command', command],
      };
    case 'bash': {
      const bash = findGitBash();
      if (!bash) throw new Error('Git Bash (bash.exe) not found on this machine.');
      // -i keeps it interactive; run command then drop to shell so it stays open.
      return {
        file: bash,
        args: ['-l', '-i', '-c', `${command}; exec bash -i`],
      };
    }
    case 'cmd':
    default:
      return {
        file: 'cmd.exe',
        args: ['/d', '/k', command],
      };
  }
}

module.exports = { findGitBash, availableShells, resolveShell };
