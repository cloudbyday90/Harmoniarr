/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkerAdvisoryTasks } from '../../src/server/worker-advisory-tasks.js';

test('advisory completion registers before invoking callbacks and drains every best-effort outcome', async () => {
  const gate = Promise.withResolvers();
  const seen = [];
  const tasks = createWorkerAdvisoryTasks();
  tasks.schedule(() => { throw null; });
  tasks.schedule(async () => { await gate.promise; seen.push('settled'); });
  const closing = tasks.close();
  assert.strictEqual(tasks.close(), closing);
  assert.throws(() => tasks.schedule(() => assert.fail('Must not launch')));
  assert.deepEqual(seen, []);
  gate.resolve();
  await closing;
  assert.deepEqual(seen, ['settled']);
});
