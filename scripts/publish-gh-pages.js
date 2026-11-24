'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

function run(cmd, cwd = ROOT_DIR) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

run('npm run build', ROOT_DIR);

const remoteUrl = execSync('git remote get-url origin', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zerno-gh-pages-'));

try {
  fs.cpSync(DIST_DIR, tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.nojekyll'), '');

  run('git init', tmpDir);
  run('git checkout -b gh-pages', tmpDir);
  run('git add -A', tmpDir);
  run('git commit -m "deploy: update GitHub Pages build"', tmpDir);
  run(`git push -f "${remoteUrl}" gh-pages`, tmpDir);
  console.log('Published zerno-tma to gh-pages successfully!');
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
