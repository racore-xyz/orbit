import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, '..');
const cliPath = path.join(projectRoot, 'index.js');

function runCli(args, cwd = projectRoot) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

test('shows the package version', () => {
  const result = runCli(['--version']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^1\.0\.0\s*$/);
});

test('lists all packaged skills', () => {
  const result = runCli(['list']);
  assert.equal(result.status, 0, result.stderr);

  for (const skill of [
    'awwwards-hero',
    'awwwards-sections',
    'awwwards-motion',
    'pixel-perfect',
    'visual-redesign',
    'imagegen-frontend',
    'brandkit-gen',
  ]) {
    assert.match(result.stdout, new RegExp(skill));
  }
});

test('installs a complete skill package to a custom target', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arabiancurb-cli-'));
  const target = path.join(tempDir, 'skills');

  try {
    const result = runCli([
      'add',
      'awwwards-hero',
      '--target',
      target,
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(path.join(target, 'awwwards-hero', 'SKILL.md')));
    assert.ok(
      fs.existsSync(
        path.join(
          target,
          'awwwards-hero',
          'references',
          'arabic-mode.md',
        ),
      ),
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('supports dry-run without writing files', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arabiancurb-dry-'));
  const target = path.join(tempDir, 'skills');

  try {
    const result = runCli([
      'add',
      '--all',
      '--target',
      target,
      '--dry-run',
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Dry run/);
    assert.equal(fs.existsSync(target), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('rejects unknown skills with an actionable error', () => {
  const result = runCli(['add', 'not-a-real-skill']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown skill/);
  assert.match(result.stderr, /arabiancurb list/);
});
