/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import PgConnection from 'pg/lib/connection.js';
import { buildPgConnectionRecord, capturePgTargetIdentity, comparePgTargetIdentity } from '../../testing/integration/pg-connection-record.js';
import { observeOwnedPgConnections } from '../../testing/integration/owned-pg-connection-observer.js';

test('owned unnamed startup packets get a private marker without changing credentials, results or explicit names', async () => {
  const config = { host: 'private-host', port: 5432, user: 'private_user', database: 'private_db' };
  for (const application_name of [undefined, 'explicit-private-name']) {
    const pool = new pg.Pool(config); const observer = observeOwnedPgConnections({ pool, expectedConfig: config, now: () => 0, startupLogging: true });
    const checkout = observer.begin(); const client = checkout.dispatch(() => new pool.Client(pool.options));
    const bytes = []; const stream = client.connection.stream; const write = stream.write;
    stream.write = value => { bytes.push(value); return true; };
    const packet = { user: config.user, database: config.database, options: '-c statement_timeout=1000', ...(application_name ? { application_name } : {}) };
    try {
      assert.equal(client.connection.startup(packet), undefined); assert.equal(bytes.length, 1);
      const context = checkout.captureStartupContext();
      if (application_name) { assert.equal(context, null); assert.ok(bytes[0].includes(Buffer.from(application_name))); }
      else { assert.match(context.marker, /^hxi_/u); assert.equal(context.user, config.user); assert.equal(context.database, config.database);
        assert.ok(bytes[0].includes(Buffer.from(context.marker))); assert.equal(packet.application_name, undefined); }
      assert.equal(JSON.stringify(checkout.snapshot()).includes('private'), false);
      checkout.finish(); assert.equal(checkout.captureStartupContext(), null); assert.equal(Object.hasOwn(client.connection, 'startup'), false);
    } finally { stream.write = write; checkout.finish(); observer.restore(); stream.destroy(); await pool.end(); }
  }
});

test('unsupported startup accessors are evaluated only by the original serializer and retain its Error/null', async () => {
  const config = { host: 'private-host', port: 5432, user: 'private_user', database: 'private_db' };
  for (const primary of [new Error('original startup accessor'), null]) {
    const pool = new pg.Pool(config); const observer = observeOwnedPgConnections({ pool, expectedConfig: config, now: () => 0, startupLogging: true });
    const checkout = observer.begin(); const client = checkout.dispatch(() => new pool.Client(pool.options)); let reads = 0;
    try {
      assert.throws(() => client.connection.startup({ get user() { reads++; throw primary; }, database: config.database }), error => error === primary);
      assert.equal(reads, 1); assert.equal(checkout.captureStartupContext(), null);
    } finally { checkout.finish(); observer.restore(); client.connection.stream.destroy(); await pool.end(); }
  }
});

test('connection records minimize hostile fields and reject unbounded timings/stages', () => {
  const input = new Proxy({ observation: 'observed', targetMatch: 'mismatched', lastStage: 'private',
    constructedMs: 3, transportConnectedMs: -1, backendReadyMs: Infinity, password: 'private' }, {
    get(target, key) { if (key === 'clientId') throw null; return target[key]; },
  });
  const record = buildPgConnectionRecord(input);
  assert.equal(record.targetMatch, 'mismatched'); assert.equal(record.constructedMs, 3);
  assert.equal(record.transportConnectedMs, null); assert.equal(record.backendReadyMs, null);
  assert.equal(record.clientId, null); assert.equal(record.lastStage, 'unknown');
  assert.ok(Object.isFrozen(record)); assert.equal(JSON.stringify(record).includes('private'), false);
});

test('target identity snapshots compare resolved scalar identity without retaining credentials', () => {
  const config = { host: 'private-host', port: 5432, user: 'private-user', database: 'private-db', password: 'private-secret' };
  const expected = capturePgTargetIdentity(config); config.port++;
  assert.equal(comparePgTargetIdentity(config, expected), 'mismatched');
  assert.equal(comparePgTargetIdentity({ ...config, port: 5432, password: 'changed' }, expected), 'matched');
  assert.equal(Object.hasOwn(expected, 'password'), false); assert.ok(Object.isFrozen(expected));
  assert.equal(comparePgTargetIdentity({}, expected), 'unavailable');
  assert.equal(capturePgTargetIdentity({ ...config, get host() { throw null; } }), null);
});

test('owned client adapter attaches before startup, captures fixed milestones and removes only its listeners', async () => {
  const config = { host: 'private-host', port: 5432, user: 'private-user', database: 'private-db' };
  const pool = new pg.Pool(config); const descriptor = Object.getOwnPropertyDescriptor(pool, 'Client');
  let tick = 0; const observer = observeOwnedPgConnections({ pool, expectedConfig: config, now: () => tick++ });
  const checkout = observer.begin(); const client = checkout.dispatch(() => new pool.Client(pool.options));
  const connection = client.connection; let original = 0;
  const listener = () => { original++; }; connection.on('connect', listener);
  try {
    connection.emit('connect'); connection.emit('authenticationSASL', { private: 'payload' });
    connection.emit('authenticationOk'); connection.emit('readyForQuery', { private: 'payload' });
    const record = checkout.snapshot();
    assert.equal(record.observation, 'observed'); assert.equal(record.targetMatch, 'matched');
    assert.equal(record.lastStage, 'backend_ready'); assert.ok(record.backendReadyMs > record.constructedMs);
    assert.equal(record.tlsConnectedMs, null); assert.equal(JSON.stringify(record).includes('private'), false);
    checkout.finish(); assert.equal(connection.listenerCount('authenticationMD5Password'), 0);
    assert.equal(Object.hasOwn(connection, 'startup'), false);
    assert.equal(connection.listenerCount('connect'), 1); connection.emit('connect'); assert.equal(original, 2);
    observer.restore(); assert.deepEqual(Object.getOwnPropertyDescriptor(pool, 'Client'), descriptor);
    assert.equal(client.constructor, pg.Client);
  } finally { checkout.finish(); connection.stream.destroy(); await pool.end(); }
});

test('queued creation is not attributed to another checkout and unsupported factories stay untouched', async () => {
  const pool = new pg.Pool(); const observer = observeOwnedPgConnections({ pool, now: () => 0 });
  const checkout = observer.begin(); const client = new pool.Client(pool.options);
  assert.equal(checkout.snapshot().observation, 'not_observed'); observer.restore();
  client.connection.stream.destroy(); await pool.end();
  class CustomClient extends pg.Client {}
  const custom = new pg.Pool({ Client: CustomClient });
  const other = observeOwnedPgConnections({ pool: custom, now: () => { throw null; } });
  assert.equal(custom.Client, CustomClient); assert.equal(other.begin().snapshot().observation, 'unsupported_driver');
  other.restore(); await custom.end();
});

test('TLS stream creation is distinct from completed TLS handshake and clock failure stays unavailable', async () => {
  const pool = new pg.Pool(); const observer = observeOwnedPgConnections({ pool, now: () => { throw null; } });
  const checkout = observer.begin(); const client = checkout.dispatch(() => new pool.Client(pool.options));
  try {
    client.connection.emit('sslconnect');
    assert.equal(checkout.snapshot().lastStage, 'tls_stream_created');
    assert.equal(checkout.snapshot().tlsConnectedMs, null);
    client.connection.stream.emit('secureConnect');
    assert.equal(checkout.snapshot().lastStage, 'tls_connected');
    assert.equal(checkout.snapshot().constructedMs, null);
    checkout.finish(); assert.equal(client.connection.stream.listenerCount('secureConnect'), 0);
    observer.restore();
  } finally { checkout.finish(); client.connection.stream.destroy(); await pool.end(); }
});

for (const failure of [new Error('private startup error'), null]) {
  test(`owned startup wrapper preserves original ${failure === null ? 'null' : 'Error'} and descriptor`, async () => {
    const connection = new PgConnection(); const receiver = {}; const values = [{ private: 'startup payload' }];
    const startup = function (...args) { assert.equal(this, receiver); assert.deepEqual(args, values); throw failure; };
    Object.defineProperty(connection, 'startup', { value: startup, configurable: true, writable: true, enumerable: true });
    const descriptor = Object.getOwnPropertyDescriptor(connection, 'startup');
    const pool = new pg.Pool({ connection }); const observer = observeOwnedPgConnections({ pool, now: () => 1 });
    const checkout = observer.begin(); checkout.dispatch(() => new pool.Client(pool.options));
    try {
      assert.throws(() => connection.startup.call(receiver, ...values), error => error === failure);
      assert.equal(checkout.snapshot().startupDispatchedMs, null);
      checkout.finish(); assert.deepEqual(Object.getOwnPropertyDescriptor(connection, 'startup'), descriptor);
      observer.restore();
    } finally { checkout.finish(); connection.stream.destroy(); await pool.end(); }
  });
}
