'use strict';

const { exec } = require('child_process');

// PIDs we must never kill (System Idle / System).
const PROTECTED_PIDS = new Set(['0', '4']);

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
  return new Promise((resolve) => {
    if (!ports.length) return resolve(new Set());
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
        new Promise((res) => exec(`taskkill /PID ${pid} /T /F`, { windowsHide: true }, () => res()))
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
