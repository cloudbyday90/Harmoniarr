/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { createFixtureGate } from '../../testing/integration/fixture-lifecycle.js';
import { withServer } from '../../testing/server/http-test-helpers.js';

test('HTTP fixture closure does not drain detached work after a completed response', {
  timeout: 10_000,
}, async (t) => {
  const gate = createFixtureGate({ signal: t.signal });
  let task;
  let completed = false;
  const app = createServer((_request, response) => {
    task = gate.promise.then(() => { completed = true; });
    response.end('accepted');
  });
  try {
    await withServer(app, async baseUrl => {
      assert.equal(await (await fetch(baseUrl)).text(), 'accepted');
      assert.ok(task);
    });
    assert.equal(app.listening, false);
    assert.equal(completed, false);
  } finally {
    gate.release();
    await task;
  }
  assert.equal(completed, true);
});
