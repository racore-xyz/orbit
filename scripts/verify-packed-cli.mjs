import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arabiancurb-pack-'));
let tarballPath;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`,
    );
  }

  return result;
}

function runNpm(args, options = {}) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    throw new Error('npm_execpath is unavailable; run this check through npm.');
  }
  return run(process.execPath, [npmCli, ...args], {
    ...options,
    env: {
      ...process.env,
      NO_COLOR: '1',
      npm_config_dry_run: 'false',
      ...options.env,
    },
  });
}

try {
  const packResult = runNpm(['pack', '--json', '--ignore-scripts']);
  const packData = JSON.parse(packResult.stdout);
  assert.equal(packData.length, 1, 'npm pack should produce one tarball');

  tarballPath = path.join(projectRoot, packData[0].filename);
  assert.ok(fs.existsSync(tarballPath), 'npm tarball was not created');

  runNpm([
    'install',
    '--prefix',
    tempRoot,
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    tarballPath,
  ]);

  const executable = path.join(
    tempRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'arabiancurb.cmd' : 'arabiancurb',
  );
  assert.ok(fs.existsSync(executable), 'arabiancurb executable is missing');

  const installedCli = path.join(
    tempRoot,
    'node_modules',
    'arabiancurb',
    'index.js',
  );
  const listResult = run(process.execPath, [installedCli, 'list'], {
    cwd: tempRoot,
  });
  assert.match(listResult.stdout, /awwwards-hero/);
  assert.match(listResult.stdout, /brandkit-gen/);

  const installTarget = path.join(tempRoot, 'installed-skills');
  run(
    process.execPath,
    [installedCli, 'add', 'awwwards-hero', '--target', installTarget],
    { cwd: tempRoot },
  );

  assert.ok(
    fs.existsSync(path.join(installTarget, 'awwwards-hero', 'SKILL.md')),
    'installed SKILL.md is missing',
  );
  assert.ok(
    fs.existsSync(
      path.join(
        installTarget,
        'awwwards-hero',
        'references',
        'arabic-mode.md',
      ),
    ),
    'installed Arabic Mode reference is missing',
  );

  console.log('Packed arabiancurb CLI verified end to end.');
} finally {
  if (tarballPath && fs.existsSync(tarballPath)) {
    fs.rmSync(tarballPath, { force: true });
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
