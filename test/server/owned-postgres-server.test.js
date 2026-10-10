/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createOwnedPostgresServer } from '../../testing/integration/owned-postgres-server.js';

function fixture() {
  const calls = [];
  const container = { withStartupTimeout() { return this; }, withDatabase(value) { calls.push(value); return this; },
    withUsername() { return this; }, withPassword(value) { calls.push(value); return this; },
    start: async () => container, getHost: () => 'owned', getPort: () => 1234,
    getUsername: () => 'parent', getPassword: () => calls[1], stop: async () => calls.push('stop') };
  return { calls, container, input: { config: { useContainerReuse: false, postgresImage: 'controlled', startupTimeoutMs: 1000,
    containerStopTimeoutMs: 1000 }, containerFactory: () => container } };
}
test('dedicated server uses a fresh secret, unallocated default database and idempotent closure', async () => {
  const f = fixture(); const owner = await createOwnedPostgresServer(f.input);
  assert.match(owner.env.PGPASSWORD, /^[a-f0-9]{64}$/u); assert.match(owner.env.PGDATABASE, /^hx_unallocated_/u);
  assert.equal(owner.env.PGMAINTENANCE_DB, 'postgres'); assert.ok(Object.isFrozen(owner.env));
  await Promise.all([owner.close(), owner.close()]); assert.equal(f.calls.filter((call) => call === 'stop').length, 1);
});
test('reuse and pre-aborted startup are rejected before server creation', async () => {
  const f = fixture(); const controller = new AbortController(); controller.abort(null);
  await createOwnedPostgresServer({ ...f.input, signal: controller.signal })
    .then(() => assert.fail('Cancelled server started'), (error) => assert.equal(error, null));
  await assert.rejects(createOwnedPostgresServer({ ...f.input, config: { ...f.input.config, useContainerReuse: true } }), TypeError);
  assert.deepEqual(f.calls, []);
});
test('configuration extraction failure stops the newly acquired server and preserves the original error', async () => {
  const f = fixture(); const failure = new Error('getter failure'); f.container.getHost = () => { throw failure; };
  await assert.rejects(createOwnedPostgresServer(f.input), (error) => error === failure);
  assert.equal(f.calls.at(-1), 'stop');
});
