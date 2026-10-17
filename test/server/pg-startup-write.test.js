/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { Socket } from 'node:net';
import { TLSSocket } from 'node:tls';
import test from 'node:test';
import PgConnection from 'pg/lib/connection.js';
import { observeOwnedPgStartupWrite, supportsPgStartupWriteStream } from '../../testing/integration/owned-pg-startup-write.js';
import { buildPgStartupWriteRecord } from '../../testing/integration/pg-startup-write-record.js';
import { buildPgConnectionRecord } from '../../testing/integration/pg-connection-record.js';

const packet = { user: 'private-user', database: 'private-database' };
function controlled(write, extra = {}) {
  const stream = { write }; const connection = new PgConnection({ stream }); let tick = 0;
  const observer = observeOwnedPgStartupWrite({ connection, now: () => tick++, supportsStream: () => true, ...extra });
  return { stream, connection, observer, run: () => observer.dispatch(connection.startup, connection, [packet]) };
}

for (const result of [true, false]) {
  test(`startup retains Buffer/receiver/return identity and separates held callback from backpressure ${result}`, () => {
    let callback; let buffer; const fixture = controlled(function (bytes, done) {
      assert.equal(this, fixture.stream); buffer = bytes; callback = done; return result;
    });
    const descriptor = Object.getOwnPropertyDescriptor(fixture.stream, 'write');
    assert.equal(fixture.run(), undefined); assert.ok(Buffer.isBuffer(buffer));
    let baseline;
    new PgConnection({ stream: { write: bytes => { baseline = bytes; return result; } } }).startup(packet);
    assert.deepEqual(buffer, baseline); const completion = callback;
    assert.deepEqual(Object.getOwnPropertyDescriptor(fixture.stream, 'write'), descriptor);
    const pending = fixture.observer.snapshot(); assert.equal(pending.returnOutcome, 'returned');
    assert.equal(pending.callbackOutcome, 'pending'); assert.equal(pending.backpressure, !result);
    assert.ok(pending.returnedMs >= pending.attemptedMs); assert.equal(pending.callbackMs, null);
    // Auth/query traffic after startup has its original arguments, without another observer callback.
    const auth = Buffer.from('private-auth'); assert.equal(fixture.stream.write(auth), result); assert.equal(buffer, auth);
    assert.equal(callback, undefined);
    completion(); const completed = fixture.observer.snapshot();
    assert.equal(completed.callbackOutcome, 'passed'); assert.ok(completed.callbackMs >= completed.returnedMs);
    assert.equal(JSON.stringify(completed).includes('private'), false);
    fixture.observer.finish();
  });
}

test('callback error is sanitized, duplicate/late callbacks cannot rewrite the settled observation', () => {
  let callback;
  const fixture = controlled((_bytes, done) => { callback = done; return false; }); fixture.run();
  callback(Object.assign(new Error('private-payload'), { code: 'EPIPE' }));
  const failed = fixture.observer.snapshot();
  assert.equal(failed.returnOutcome, 'returned'); assert.equal(failed.callbackOutcome, 'failed');
  assert.equal(failed.errorCode, 'EPIPE'); assert.equal(failed.errorClass, 'Error');
  callback(); assert.deepEqual(fixture.observer.snapshot(), failed);
  fixture.observer.finish(); callback(new Error('later')); assert.deepEqual(fixture.observer.snapshot(), failed);
  const held = controlled((_bytes, done) => { callback = done; return true; }); held.run();
  held.observer.finish(); const pending = held.observer.snapshot(); callback();
  assert.deepEqual(held.observer.snapshot(), pending); assert.equal(pending.callbackOutcome, 'pending');
});

for (const failure of [new Error('private-original'), null]) {
  test(`synchronous write ${failure === null ? 'null' : 'Error'} remains primary and restores the original descriptor`, () => {
    const fixture = controlled(() => { throw failure; }); const descriptor = Object.getOwnPropertyDescriptor(fixture.stream, 'write');
    assert.throws(fixture.run, error => error === failure);
    assert.equal(fixture.observer.snapshot().returnOutcome, 'threw');
    assert.equal(fixture.observer.snapshot().returnedMs, null);
    assert.deepEqual(Object.getOwnPropertyDescriptor(fixture.stream, 'write'), descriptor); fixture.observer.finish();
  });
}

test('native Socket/TLSSocket capability rejects custom prototypes, methods and proxies', () => {
  for (const stream of [new Socket(), new TLSSocket()]) {
    try {
      assert.equal(supportsPgStartupWriteStream(stream), true);
      stream.write = () => true; assert.equal(supportsPgStartupWriteStream(stream), false);
    } finally { stream.destroy(); }
  }
  class CustomSocket extends Socket {}
  const custom = new CustomSocket(); assert.equal(supportsPgStartupWriteStream(custom), false); custom.destroy();
  assert.equal(supportsPgStartupWriteStream(new Proxy({}, { getPrototypeOf() { assert.fail('Proxy inspected'); } })), false);
});

test('native socket write failure still emits its original error and closes with an observation callback', async () => {
  const results = [];
  for (const observed of [false, true]) {
    const stream = new Socket(); const connection = new PgConnection({ stream }); const errors = [];
    stream.on('error', error => errors.push(error));
    const closed = new Promise(resolve => { stream.once('close', resolve); });
    const observer = observeOwnedPgStartupWrite({ connection, now: () => 0 });
    try {
      if (observed) observer.dispatch(connection.startup, connection, [packet]); else connection.startup(packet);
      await closed; assert.equal(errors.length, 1); assert.equal(stream.destroyed, true);
      assert.equal(Object.hasOwn(stream, 'write'), false);
      if (observed) { assert.equal(observer.snapshot().callbackOutcome, 'failed'); assert.equal(observer.snapshot().errorClass, errors[0].name); }
      results.push({ code: errors[0].code, name: errors[0].name });
    } finally { observer.finish(); stream.destroy(); }
  }
  assert.deepEqual(results[1], results[0]);
});

test('unsupported packet getters run only in the original serializer, without observing their reentrant writes', () => {
  let writes = 0; let reads = 0; const primary = new Error('private');
  const fixture = controlled(() => { writes++; return true; });
  const accessor = { get user() { reads++; fixture.stream.write(Buffer.from('auth')); throw primary; } };
  assert.throws(() => fixture.observer.dispatch(fixture.connection.startup, fixture.connection, [accessor]), error => error === primary);
  assert.equal(reads, 1); assert.equal(writes, 1);
  assert.equal(fixture.observer.snapshot().observation, 'unsupported_packet');
  assert.equal(fixture.observer.snapshot().callbackOutcome, 'not_observed');
});

test('stream/method accessors are evaluated only by the original startup call and preserve Error/null', () => {
  for (const primary of [new Error('original'), null]) {
    const stream = new Socket(); const connection = new PgConnection({ stream }); let reads = 0;
    const observer = observeOwnedPgStartupWrite({ connection, now: () => 0 });
    Object.defineProperty(stream, 'write', { configurable: true, get() { reads++; throw primary; } });
    try {
      assert.throws(() => observer.dispatch(connection.startup, connection, [packet]), error => error === primary);
      assert.equal(reads, 1); assert.equal(observer.snapshot().observation, 'unsupported_stream');
    } finally { observer.finish(); stream.destroy(); }
  }
  const connection = new PgConnection({ stream: { write: () => true } }); let reads = 0;
  const stream = connection.stream;
  Object.defineProperty(connection, 'stream', { get() { reads++; return stream; } });
  const observer = observeOwnedPgStartupWrite({ connection, now: () => 0 });
  observer.dispatch(connection.startup, connection, [packet]);
  assert.equal(reads, 1); assert.equal(observer.snapshot().observation, 'unsupported_stream'); observer.finish();
});

test('unsupported methods/receivers retain original arguments and result, with no write observation', () => {
  const fixture = controlled(() => assert.fail('Not written')); const receiver = {}; const args = [packet]; const returned = {};
  const custom = function (...values) { assert.equal(this, receiver); assert.deepEqual(values, args); return returned; };
  assert.equal(fixture.observer.dispatch(custom, receiver, args), returned);
  assert.equal(fixture.observer.snapshot().observation, 'not_observed');
  assert.equal(fixture.observer.dispatch(() => returned, fixture.connection, args), returned);
  assert.equal(fixture.observer.snapshot().observation, 'unsupported_method');
});

test('failed capability/decoration cannot replace native startup or overwrite a later write owner', () => {
  for (const supportsStream of [() => false, () => { throw null; }]) {
    let writes = 0; const fixture = controlled(() => { writes++; return true; }, { supportsStream });
    fixture.run(); assert.equal(writes, 1); assert.equal(fixture.observer.snapshot().observation, 'unsupported_stream');
  }
  let writes = 0; const fixed = controlled(() => { writes++; return true; }); Object.freeze(fixed.stream);
  fixed.run(); assert.equal(writes, 1); assert.equal(fixed.observer.snapshot().observation, 'adapter_unavailable');
  const later = () => true; const fixture = controlled(() => { fixture.stream.write = later; return true; });
  fixture.run(); assert.equal(fixture.stream.write, later);
  assert.equal(fixture.observer.snapshot().observation, 'adapter_unavailable');
});

test('throwing clocks and synchronous callback completion preserve native outcomes and separate return/callback ordering', () => {
  const fixture = controlled((_bytes, callback) => { callback(); return true; }, { now: () => { throw null; } });
  fixture.run(); const snapshot = fixture.observer.snapshot();
  assert.equal(snapshot.callbackOutcome, 'passed'); assert.equal(snapshot.returnOutcome, 'returned');
  assert.equal(snapshot.callbackMs, null); assert.equal(snapshot.attemptedMs, null);
});

test('startup write record rejects hostile/private fields, invalid outcomes and unbounded offsets', () => {
  const input = new Proxy({ observation: 'private', returnOutcome: 'threw', callbackOutcome: 'failed',
    attemptedMs: 2, returnedMs: -1, callbackMs: Infinity, errorCode: 'private', errorClass: 'private' }, {
    get(target, key) { if (key === 'backpressure') throw null; return target[key]; },
  });
  const record = buildPgStartupWriteRecord(input); assert.equal(record.observation, 'not_observed');
  assert.equal(record.attemptedMs, 2); assert.equal(record.returnedMs, null); assert.equal(record.callbackMs, null);
  assert.equal(record.errorCode, null); assert.equal(record.errorClass, null); assert.ok(Object.isFrozen(record));
  assert.equal(JSON.stringify(record).includes('private'), false);
  assert.deepEqual(buildPgStartupWriteRecord(record), record);
});

test('changing getters cannot replace validated connection/write fields with unapproved values', () => {
  const cases = [[buildPgStartupWriteRecord, { observation: 'observed', returnOutcome: 'returned', callbackOutcome: 'pending', backpressure: true }],
    [buildPgConnectionRecord, { observation: 'observed', clientId: '00000000-0000-4000-8000-000000000001', targetMatch: 'matched', lastStage: 'constructed' }]];
  for (const [build, accepted] of cases) {
    const reads = new Map();
    const input = new Proxy({}, { get(_target, key) {
      const count = (reads.get(key) ?? 0) + 1; reads.set(key, count);
      return Object.hasOwn(accepted, key) ? count === 1 ? accepted[key] : 'private-sentinel' : undefined;
    } });
    const record = build(input); assert.equal(JSON.stringify(record).includes('private-sentinel'), false);
    for (const [key, value] of Object.entries(accepted)) { assert.equal(record[key], value); assert.equal(reads.get(key), 1); }
  }
});
