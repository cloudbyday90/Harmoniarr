/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { withFixturePostgresObserver } from '../../testing/integration/fixture-postgres-observer.js';

const fakeClient = () => Object.assign(new EventEmitter(), {
  connect: async () => {}, query: async () => ({ rows: [{ value: 1 }] }), end: async () => {},
});

test('independent observation uses acknowledged connection config, short bounds and closes before returning', async () => {
  const order = []; let configured; let captured;
  const client = fakeClient();
  client.connect = async () => { order.push('connected'); };
  client.end = async () => { order.push('closed'); };
  const value = await withFixturePostgresObserver({ connectionConfig: { host: 'owned_host', database: 'owned_database', password: 'controlled' },
    clientFactory: config => { configured = config; return client; } }, async observer => {
    captured = observer; return (await observer.query('SELECT 1')).rows[0].value;
  });
  order.push('returned'); assert.equal(value, 1); assert.deepEqual(order, ['connected', 'closed', 'returned']);
  assert.deepEqual(configured, { host: 'owned_host', database: 'owned_database', password: 'controlled',
    connectionTimeoutMillis: 1000, query_timeout: 1000, statement_timeout: 1000 });
  assert.throws(() => captured.query('SELECT 2'), { code: 'fixture_observer_closed' });
});

test('original connect/read Error and null survive secondary client-close failures', async () => {
  for (const stage of ['connect', 'read']) for (const primary of [new Error('Original observation failure'), null]) {
    const client = fakeClient(); let ended = false;
    if (stage === 'connect') client.connect = async () => { throw primary; };
    else client.query = async () => { throw primary; };
    client.end = async () => { ended = true; throw new Error('Secondary close failure'); };
    await assert.rejects(withFixturePostgresObserver({ connectionConfig: {}, clientFactory: () => client },
      observer => observer.query('SELECT 1')), error => error === primary);
    assert.equal(ended, true);
  }
});

test('a failing body still drains its already launched read before closing the independent client', async () => {
  const held = Promise.withResolvers(); const draining = Promise.withResolvers(); const order = [];
  const primary = new Error('Body failure'); const client = fakeClient(); let ended = false;
  client.query = async () => { draining.resolve(); await held.promise; order.push('read drained'); };
  client.end = async () => { ended = true; order.push('client closed'); };
  const pending = withFixturePostgresObserver({ connectionConfig: {}, clientFactory: () => client }, observer => {
    observer.query('SELECT 1'); throw primary;
  });
  pending.catch(() => {}); await draining.promise;
  assert.equal(ended, false); held.resolve();
  await assert.rejects(pending, error => error === primary);
  assert.deepEqual(order, ['read drained', 'client closed']);
});

test('pre-cancellation starts no client and cancellation during connection forbids the callback while closing', async () => {
  const controller = new AbortController(); controller.abort(null);
  await assert.rejects(withFixturePostgresObserver({ connectionConfig: {}, signal: controller.signal,
    clientFactory: () => assert.fail('Cancelled observation opened a client') }, () => {}), error => error === null);
  const connecting = new AbortController(); const reason = new Error('Cancelled connection');
  const client = fakeClient(); let ended = false;
  client.connect = async () => { connecting.abort(reason); }; client.end = async () => { ended = true; };
  await assert.rejects(withFixturePostgresObserver({ connectionConfig: {}, signal: connecting.signal, clientFactory: () => client },
    () => assert.fail('Cancelled observation admitted work')), error => error === reason);
  assert.equal(ended, true);
});
