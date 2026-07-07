'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const pty = require('@lydell/node-pty');
const { resolveShell } = require('./shells');
const { parsePorts, freePorts, waitPortsFree } = require('./ports');

/**
 * Owns the running pseudo-terminals keyed by server id. Emits output and state
 * changes back to the caller via the callbacks passed to the constructor.
 */
class ServerManager {
  /**
   * @param {(id: string, data: string) => void} onData   pty output chunk
   * @param {(id: string, state: string, info?: object) => void} onState  state change
   */
  constructor(onData, onState) {
    this.onData = onData;
    this.onState = onState;
    /** @type {Map<string, {proc: import('node-pty').IPty, pid: number, server: object}>} */
    this.procs = new Map();
  }

  isRunning(id) {
    return this.procs.has(id);
  }

  runningIds() {
    return [...this.procs.keys()];
  }

  /**
   * Spawn a server. If already running, this is a no-op (use restart instead).
   * @param {{id,name,folder,command,shell}} server
   */
  start(server) {
    if (this.procs.has(server.id)) return;

    const folder = server.folder && fs.existsSync(server.folder) ? server.folder : process.cwd();
    if (!server.folder || !fs.existsSync(server.folder)) {
      this.onData(server.id, `\x1b[33m[manager] folder not found, using ${folder}\x1b[0m\r\n`);
    }

    let file, args;
    try {
      ({ file, args } = resolveShell(server.shell, server.command));
    } catch (err) {
      this.onData(server.id, `\x1b[31m[manager] ${err.message}\x1b[0m\r\n`);
      this.onState(server.id, 'error', { message: err.message });
      return;
    }

    let proc;
    try {
      proc = pty.spawn(file, args, {
        name: 'xterm-color',
        cols: 120,
        rows: 30,
        cwd: folder,
        env: process.env,
      });
    } catch (err) {
      this.onData(server.id, `\x1b[31m[manager] spawn failed: ${err.message}\x1b[0m\r\n`);
      this.onState(server.id, 'error', { message: err.message });
      return;
    }

    const entry = { proc, pid: proc.pid, server };
    this.procs.set(server.id, entry);
    this.onState(server.id, 'running', { pid: proc.pid });
    this.onData(
      server.id,
      `\x1b[36m[manager] started "${server.name}" (${server.shell}) in ${folder}\x1b[0m\r\n`
    );

    proc.onData((data) => this.onData(server.id, data));
    proc.onExit(({ exitCode }) => {
      // A restart replaces the entry for this id with a new pty. If that has
      // already happened, this is the OLD pty exiting late — ignore it so we
      // don't wipe the running state of the new process.
      if (this.procs.get(server.id) !== entry) return;
      this.procs.delete(server.id);
      this.onData(server.id, `\r\n\x1b[90m[manager] process exited (code ${exitCode})\x1b[0m\r\n`);
      this.onState(server.id, 'stopped', { exitCode });
    });
  }

  /** Forward keystrokes / input from the UI into the pty. */
  write(id, data) {
    const entry = this.procs.get(id);
    if (entry) entry.proc.write(data);
  }

  /** Keep the pty sized to the visible xterm. */
  resize(id, cols, rows) {
    const entry = this.procs.get(id);
    if (entry) {
      try {
        entry.proc.resize(Math.max(1, cols), Math.max(1, rows));
      } catch (_) {
        /* ignore transient resize errors */
      }
    }
  }

  /** Kill a pid and its whole child tree (best-effort). */
  killPidTree(pid) {
    return new Promise((resolve) => {
      exec(`taskkill /PID ${pid} /T /F`, { windowsHide: true }, () => resolve());
    });
  }

  /**
   * Stop a server, killing the whole process tree AND freeing its port(s) so a
   * lingering child (e.g. an orphaned nodemon `node`) can't keep the port bound.
   * @param {string} id
   * @param {object} [server] config for the id (used for its port when not running)
   * @returns {Promise<void>}
   */
  async stop(id, server) {
    const entry = this.procs.get(id);
    const cfg = (entry && entry.server) || server || {};
    const ports = parsePorts(cfg.port);

    if (entry) {
      await this.killPidTree(entry.pid);
      try {
        entry.proc.kill();
      } catch (_) {
        /* already dead */
      }
      // onExit normally clears the map; do it defensively in case it doesn't fire.
      if (this.procs.has(id)) {
        this.procs.delete(id);
        this.onState(id, 'stopped', {});
      }
    }

    // Free any port still held by a survivor, whether or not we tracked the proc.
    if (ports.length) {
      const killed = await freePorts(ports);
      if (killed.length) {
        this.onData(
          id,
          `\x1b[33m[manager] freed port ${ports.join(', ')} (killed pid ${killed.join(', ')})\x1b[0m\r\n`
        );
      }
    }
  }

  /**
   * Restart: stop (freeing ports), wait until the port is actually free, then start.
   * @param {{id,name,folder,command,shell,port?}} server
   */
  async restart(server) {
    await this.stop(server.id, server);
    const ports = parsePorts(server.port);
    if (ports.length) {
      const free = await waitPortsFree(ports, 5000);
      if (!free) {
        this.onData(
          server.id,
          `\x1b[31m[manager] port ${ports.join(', ')} still busy after 5s; starting anyway\x1b[0m\r\n`
        );
      }
    } else {
      await new Promise((r) => setTimeout(r, 400));
    }
    this.start(server);
  }

  async startAll(servers) {
    for (const s of servers) this.start(s);
  }

  async stopAll() {
    const running = this.runningIds().map((id) => {
      const e = this.procs.get(id);
      return { id, server: e && e.server };
    });
    await Promise.all(running.map(({ id, server }) => this.stop(id, server)));
  }

  async restartAll(servers) {
    await this.stopAll();
    const allPorts = servers.flatMap((s) => parsePorts(s.port));
    if (allPorts.length) await waitPortsFree(allPorts, 5000);
    else await new Promise((r) => setTimeout(r, 400));
    await this.startAll(servers);
  }
}

module.exports = ServerManager;
