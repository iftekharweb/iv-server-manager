'use strict';

const { execFile } = require('child_process');
const fs = require('fs');

function run(folder, args) {
  return new Promise((resolve) => {
    execFile('git', ['-C', folder, ...args], { windowsHide: true, timeout: 4000 }, (err, out) => {
      resolve(err ? null : String(out || ''));
    });
  });
}

/**
 * Get the current git branch + dirty state for a folder.
 * @param {string} folder
 * @returns {Promise<{branch: string, dirty: boolean}|null>} branch info, where
 *   branch is the name ("(detached)" for detached HEAD) and dirty is true when
 *   there are uncommitted changes. null if the folder isn't a git repo / git
 *   isn't available.
 */
async function getBranch(folder) {
  if (!folder || !fs.existsSync(folder)) return null;
  const head = await run(folder, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (head == null) return null; // not a repo, or git missing
  const branch = head.trim();
  if (!branch) return null;
  // `--porcelain` prints one line per changed/untracked path; empty = clean.
  const status = await run(folder, ['status', '--porcelain']);
  const dirty = status != null && status.trim().length > 0;
  return { branch: branch === 'HEAD' ? '(detached)' : branch, dirty };
}

module.exports = { getBranch };
