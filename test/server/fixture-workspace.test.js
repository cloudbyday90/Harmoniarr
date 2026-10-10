/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { withFixtureWorkspace } from '../../testing/integration/fixture-workspace.js';

const base = resolve('controlled-test-temp'); const owned = join(base, 'harmoniarr-controlled-one');
function fixture() {
  const removed = [];
  return { removed, input: { prefix: 'harmoniarr-controlled-', baseDirectory: base,
    resolveDirectory: async (path) => path, createDirectory: async () => owned,
    removeDirectory: async (path, options) => { removed.push({ path, options }); } } };
}
test('resolution failure after directory creation removes only the acknowledged workspace and preserves its error', async () => {
  const f = fixture(); const failure = new Error('Controlled realpath failure');
  f.input.resolveDirectory = async (path) => { if (path === owned) throw failure; return path; };
  await assert.rejects(withFixtureWorkspace(f.input, () => assert.fail('Unresolved workspace used')), (error) => error === failure);
  assert.deepEqual(f.removed, [{ path: owned, options: { recursive: true, force: true } }]);
});
test('outside or wrongly named creation cannot authorize removing another directory', async () => {
  for (const path of [resolve(base, '..', 'foreign'), join(base, 'wrong-prefix')]) {
    const f = fixture(); f.input.createDirectory = async () => path;
    await assert.rejects(withFixtureWorkspace(f.input, () => assert.fail('Unowned workspace used')), /ownership/u);
    assert.deepEqual(f.removed, []);
  }
});
test('workspace cleanup follows actual work, rejects otherwise successful cleanup failure and preserves null primary', async () => {
  const f = fixture(); const failure = new Error('Controlled workspace cleanup failure');
  f.input.removeDirectory = async () => { throw failure; };
  await assert.rejects(withFixtureWorkspace(f.input, async (context) => {
    assert.deepEqual(context, { requestedRoot: owned, rootPath: owned }); return 42;
  }), (error) => error === failure);
  await withFixtureWorkspace(f.input, async () => { throw null; })
    .then(() => assert.fail('Null failure was lost'), (error) => assert.equal(error, null));
});
