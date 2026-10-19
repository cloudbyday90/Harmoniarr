/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { checkNodeBaseline, validateNodeBaseline } from '../../scripts/node-baseline-policy.js';

const digest = 'a'.repeat(64);
function input() {
  return { nvmrc: '24.22.0\r\n', nodeVersion: '24.22.0',
    dockerfile: `ARG NODE_IMAGE=node:24.22.0-alpine3.23@sha256:${digest}\r\nARG RUNTIME_IMAGE=alpine:3.23\r\n`,
    packageJson: { engines: { node: '>=24.22.0 <25.0.0' }, devEngines: { runtime: { name: 'node', version: '>=24.22.0 <25.0.0' } } } };
}
const refusal = { code: 'project_node_baseline_mismatch' };

test('exact host and digest-pinned cross-stage baseline agree independently of CRLF', () => {
  assert.deepEqual(validateNodeBaseline(input()), { version: '24.22.0',
    nodeImage: `node:24.22.0-alpine3.23@sha256:${digest}`, runtimeImage: 'alpine:3.23' });
  const pinned = input(); pinned.dockerfile = pinned.dockerfile.replace('RUNTIME_IMAGE=alpine:3.23', `RUNTIME_IMAGE=alpine:3.23@sha256:${digest}`);
  assert.equal(validateNodeBaseline(pinned).runtimeImage, `alpine:3.23@sha256:${digest}`);
});

test('stale, newer, other-major and missing active runtimes cannot claim canonical validation', () => {
  for (const nodeVersion of ['24.18.1', '24.23.0', '26.0.0', undefined]) {
    assert.throws(() => validateNodeBaseline({ ...input(), nodeVersion }), refusal);
  }
});

test('floating, ranged, prerelease and multiple baseline values refuse admission', () => {
  for (const nvmrc of ['24', 'lts/*', '>=24.22.0', '24.22.0-rc.1', '24.022.0', '24.22.0\n24.21.0']) {
    assert.throws(() => validateNodeBaseline({ ...input(), nvmrc }), refusal);
  }
});

test('both package floors and runtime owner must agree with the canonical baseline', () => {
  for (const mutate of [value => { delete value.engines; }, value => { value.engines.node = '>=24.15.0 <25.0.0'; },
    value => { value.devEngines.runtime.version = '>=24.21.0 <25.0.0'; }, value => { value.devEngines.runtime.name = 'other'; }]) {
    const candidate = input(); mutate(candidate.packageJson);
    assert.throws(() => validateNodeBaseline(candidate), refusal);
  }
});

test('changed Node, changed libc base, unpinned digest and foreign image refuse admission', () => {
  for (const image of ['node:24.21.0-alpine3.23', 'node:24.22.0-alpine3.24', 'node:24.22.0-alpine3.23',
    'other:24.22.0-alpine3.23', 'node:24.22.0-alpine3.23@sha256:invalid']) {
    const candidate = input();
    candidate.dockerfile = `ARG NODE_IMAGE=${image}\nARG RUNTIME_IMAGE=alpine:3.23\n`;
    assert.throws(() => validateNodeBaseline(candidate), refusal);
  }
});

test('missing, duplicate or mutable runtime defaults cannot mask cross-stage drift', () => {
  for (const dockerfile of ['', input().dockerfile + input().dockerfile, input().dockerfile + '  ARG NODE_IMAGE\n',
    input().dockerfile.replace('alpine:3.23', 'alpine:latest')]) {
    assert.throws(() => validateNodeBaseline({ ...input(), dockerfile }), refusal);
  }
});

test('repository loader reads the actual three owners and preserves read failure', async () => {
  const files = input(); const calls = [];
  const contents = new Map([['.nvmrc', files.nvmrc], ['Dockerfile', files.dockerfile], ['package.json', JSON.stringify(files.packageJson)]]);
  const rootDir = resolve('baseline-control');
  const result = await checkNodeBaseline({ rootDir, nodeVersion: files.nodeVersion, readFileImpl: async (file, encoding) => {
    calls.push([file, encoding]); return contents.get(file.slice(rootDir.length + 1));
  } });
  assert.equal(result.version, files.nodeVersion);
  assert.deepEqual(calls, ['.nvmrc', 'Dockerfile', 'package.json'].map(file => [resolve(rootDir, file), 'utf8']));
  const reason = new Error('owned read failure');
  await assert.rejects(checkNodeBaseline({ readFileImpl: async () => { throw reason; } }), error => error === reason);
});
