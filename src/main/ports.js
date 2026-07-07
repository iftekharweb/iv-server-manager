'use strict';

const { exec } = require('child_process');

const isWin = process.platform === 'win32';

// PIDs we must never kill (System Idle / System on Windows; init on POSIX).
const PROTECTED_PIDS = new Set(['0', '1', '4']);

/**
 * Parse a free-form port string ("5000", "5000, 5173") into a list of numbers.
 * @param {string|number} raw
 * @returns {number[]}
 */
function parsePorts(raw) {
  if (raw == null) return [];
  return String(raw)
    .split(/[\s,;]+/)
    .map((p) => parseInt(p, 10))
    .filter((n) => Number.isInteger(n) && n > 0 && n < 65536);
}

/**
 * Find PIDs currently LISTENING on any of the given TCP ports (via netstat).
 * @param {number[]} ports
 * @returns {Promise<Set<string>>}
 */
function listeningPids(ports) {
  if (!ports.length) return Promise.resolve(new Set());
  return isWin ? listeningPidsWin(ports) : listeningPidsPosix(ports);
}

function listeningPidsWin(ports) {
  return new Promise((resolve) => {
    const want = new Set(ports.map(String));
    exec('netstat -ano -p tcp', { windowsHide: true }, (err, stdout) => {
      const pids = new Set();
      if (err || !stdout) return resolve(pids);
      for (const line of stdout.split(/\r?\n/)) {
        if (!/LISTENING/i.test(line)) continue;
        // e.g.  TCP    0.0.0.0:5000   0.0.0.0:0   LISTENING   1234
        const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/i);
        if (m && want.has(m[1]) && !PROTECTED_PIDS.has(m[2])) pids.add(m[2]);
      }
      resolve(pids);
    });
  });
}

function listeningPidsPosix(ports) {
  // `lsof -ti tcp:<p1> -i tcp:<p2> ... -sTCP:LISTEN` prints one PID per line.
  const spec = ports.map((p) => `-i tcp:${p}`).join(' ');
  return new Promise((resolve) => {
    exec(`lsof -nP -t ${spec} -sTCP:LISTEN`, (err, stdout) => {
      const pids = new Set();
      // lsof exits non-zero when nothing matches — that's not an error here.
      if (stdout) {
        for (const line of stdout.split(/\r?\n/)) {
          const pid = line.trim();
          if (pid && /^\d+$/.test(pid) && !PROTECTED_PIDS.has(pid)) pids.add(pid);
        }
      }
      resolve(pids);
    });
  });
}

/**
 * Kill whatever is listening on the given ports (process tree, force).
 * @param {number[]} ports
 * @returns {Promise<string[]>} pids that were targeted
 */
async function freePorts(ports) {
  const pids = await listeningPids(ports);
  if (!pids.size) return [];
  await Promise.all(
    [...pids].map(
      (pid) =>
        new Promise((res) => {
          const cmd = isWin ? `taskkill /PID ${pid} /T /F` : `kill -9 ${pid}`;
          exec(cmd, { windowsHide: true }, () => res());
        })
    )
  );
  return [...pids];
}

/**
 * Wait until none of the given ports are in use, or the timeout elapses.
 * @param {number[]} ports
 * @param {number} timeoutMs
 * @returns {Promise<boolean>} true if all free
 */
async function waitPortsFree(ports, timeoutMs = 4000) {
  if (!ports.length) return true;
  const deadline = Date.now() + timeoutMs;
  // Date.now is fine in the main process (not a workflow script).
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pids = await listeningPids(ports);
    if (!pids.size) return true;
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, 250));
  }
}

module.exports = { parsePorts, listeningPids, freePorts, waitPortsFree };
