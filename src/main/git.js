'use strict';

const { execFile } = require('child_process');
const fs = require('fs');

/**
 * Get the current git branch for a folder.
 * @param {string} folder
 * @returns {Promise<string|null>} branch name, "(detached)" for detached HEAD,
 *   or null if the folder isn't a git repo / git isn't available.
 */
function getBranch(folder) {
  return new Promise((resolve) => {
    if (!folder || !fs.existsSync(folder)) return resolve(null);
    execFile(
      'git',
      ['-C', folder, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { windowsHide: true, timeout: 4000 },
      (err, stdout) => {
        if (err) return resolve(null); // not a repo, or git missing
        const branch = String(stdout || '').trim();
        if (!branch) return resolve(null);
        return resolve(branch === 'HEAD' ? '(detached)' : branch);
      }
    );
  });
}

module.exports = { getBranch };
