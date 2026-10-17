/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import test from 'node:test';
import { createFixturePhaseObserver, createFixturePhaseScope } from '../../testing/integration/fixture-phase-observer.js';
import { createFixtureGate } from '../../testing/integration/fixture-lifecycle.js';
import { observeOwnedHttpRequestPhases } from '../../testing/server/owned-http-request-phase.js';
import { withServer } from '../../testing/server/http-test-helpers.js';

function requestPair() {
  const socket = new Socket(); const request = new IncomingMessage(socket); const response = new ServerResponse(request);
  return { request, response, close: () => socket.destroy() };
}

test('retired scopes preserve synchronous results/Error/null and expire nested async context without timing', async () => {
  const observer = createFixturePhaseObserver({ enabled: false, now: () => assert.fail('Clock read'), onRecord: () => assert.fail('Sink called') });
  const scope = createFixturePhaseScope(observer, 'http_request'); const gate = createFixtureGate();
  const value = {}; assert.equal(scope.run(() => value), value);
  for (const failure of [new Error('primary'), null]) assert.throws(() => scope.run(() => { throw failure; }), error => error === failure);
  const pending = scope.run(() => observer.measure('fixture_seed', async () => {
    assert.equal(observer.currentPhase(), 'fixture_seed'); await gate.promise;
    assert.equal(observer.currentPhase(), undefined);
    await observer.measure('scenario_work', () => assert.equal(observer.currentPhase(), undefined));
  }));
  await observer.measure('scenario_work', () => { assert.equal(observer.currentPhase(), 'scenario_work'); scope.finish(); });
  gate.release(); await pending; assert.equal(observer.currentPhase(), undefined);
  scope.run(() => assert.equal(observer.currentPhase(), undefined));
  assert.equal(createFixturePhaseScope(new Proxy({}, { get: () => assert.fail('Foreign observer inspected') }), 'http_request'), null);
  assert.throws(() => createFixturePhaseScope(observer, 'private-label'), TypeError);
});

test('owned request dispatch preserves listener order/once, receiver, argument and return identity', () => {
  const observer = createFixturePhaseObserver({ enabled: false }); const server = createServer(); const pair = requestPair(); const calls = [];
  const descriptor = Object.getOwnPropertyDescriptor(server, 'emit');
  const first = function (request, response) {
    assert.equal(this, server); assert.equal(request, pair.request); assert.equal(response, pair.response);
    assert.equal(observer.currentPhase(), 'http_request'); calls.push('first');
  };
  server.once('request', first); server.on('request', () => { calls.push('second'); assert.equal(observer.currentPhase(), 'http_request'); });
  const listeners = server.rawListeners('request'); const owner = observeOwnedHttpRequestPhases({ server, phaseObserver: observer });
  try {
    assert.deepEqual(server.rawListeners('request'), listeners);
    assert.equal(server.emit('request', pair.request, pair.response), true); assert.deepEqual(calls, ['first', 'second']);
    assert.equal(server.listeners('request').length, 1); assert.equal(observer.currentPhase(), undefined);
    assert.equal(server.emit('unhandled'), false);
    const foreign = new EventEmitter(); const token = {};
    foreign.on('request', received => { assert.equal(received, token); assert.equal(observer.currentPhase(), undefined); });
    assert.equal(server.emit.call(foreign, 'request', token), true);
  } finally { owner.restore(); pair.close(); }
  assert.deepEqual(Object.getOwnPropertyDescriptor(server, 'emit'), descriptor);
  assert.equal(pair.response.listenerCount('finish'), 0); assert.equal(pair.response.listenerCount('close'), 0);
});

for (const event of ['finish', 'close']) {
  test(`response ${event} retires only its own scope and removes owned listeners`, async () => {
    const observer = createFixturePhaseObserver({ enabled: false }); const server = createServer();
    const first = requestPair(); const second = requestPair(); const release = createFixtureGate(); const pending = [];
    server.on('request', (request) => {
      pending.push((async () => { await release.promise;
        assert.equal(observer.currentPhase(), request === first.request ? undefined : 'http_request'); })());
    });
    const owner = observeOwnedHttpRequestPhases({ server, phaseObserver: observer });
    try {
      server.emit('request', first.request, first.response); server.emit('request', second.request, second.response);
      first.response.emit(event); release.release(); await Promise.all(pending);
      assert.equal(first.response.listenerCount('finish'), 0); assert.equal(first.response.listenerCount('close'), 0);
      assert.equal(second.response.listenerCount('finish'), 1);
    } finally { release.release(); await Promise.allSettled(pending); owner.restore(); first.close(); second.close(); }
  });
}

for (const primary of [new Error('primary'), null]) {
  test(`synchronous dispatch ${primary === null ? 'null' : 'Error'} remains primary and retires its scope`, async () => {
    const observer = createFixturePhaseObserver({ enabled: false }); const server = createServer(); const pair = requestPair();
    const gate = createFixtureGate(); let late;
    server.on('request', () => { late = (async () => { await gate.promise; assert.equal(observer.currentPhase(), undefined); })(); throw primary; });
    const owner = observeOwnedHttpRequestPhases({ server, phaseObserver: observer });
    try {
      assert.throws(() => server.emit('request', pair.request, pair.response), error => error === primary);
      assert.equal(pair.response.listenerCount('finish'), 0); assert.equal(pair.response.listenerCount('close'), 0);
    } finally { owner.restore(); gate.release(); await late; pair.close(); }
  });
}

test('custom/accessor/frozen dispatch stays untouched and restoration preserves a later owner', () => {
  const observer = createFixturePhaseObserver({ enabled: false });
  for (const kind of ['custom', 'accessor', 'frozen', 'no_observer']) {
    const server = createServer(); let reads = 0;
    if (kind === 'custom') server.emit = () => 42;
    if (kind === 'accessor') Object.defineProperty(server, 'emit', { configurable: true, get() { reads++; throw null; } });
    if (kind === 'frozen') Object.freeze(server);
    const before = Object.getOwnPropertyDescriptor(server, 'emit');
    observeOwnedHttpRequestPhases({ server, phaseObserver: kind === 'no_observer' ? null : observer }).restore();
    assert.deepEqual(Object.getOwnPropertyDescriptor(server, 'emit'), before); assert.equal(reads, 0);
  }
  const server = createServer(); const owner = observeOwnedHttpRequestPhases({ server, phaseObserver: observer });
  const later = () => 42; server.emit = later; owner.restore(); assert.equal(server.emit, later);
});

test('native HTTP body callbacks retain request phase while client/unrelated work keeps its own context', async () => {
  const observer = createFixturePhaseObserver({ enabled: false }); const seen = [];
  const server = createServer((request, response) => {
    seen.push(observer.currentPhase()); request.on('data', () => seen.push(observer.currentPhase()));
    request.on('end', () => { seen.push(observer.currentPhase()); response.end('complete'); });
  });
  await observer.measure('scenario_work', () => withServer(server, async url => {
    assert.equal(observer.currentPhase(), 'scenario_work');
    assert.equal(await (await fetch(url, { method: 'POST', body: 'private-payload', headers: { traceparent: 'private-header' } })).text(), 'complete');
    assert.equal(observer.currentPhase(), 'scenario_work');
  }, { phaseObserver: observer }));
  assert.ok(seen.length >= 3); assert.ok(seen.every(phase => phase === 'http_request'), JSON.stringify(seen));
  assert.equal(Object.hasOwn(server, 'emit'), false);
});

test('native client disconnect retires inherited work and restores request/response methods', async () => {
  const observer = createFixturePhaseObserver({ enabled: false }); const entered = createFixtureGate();
  const release = createFixtureGate(); const closed = createFixtureGate(); let late; let pair;
  const server = createServer((request, response) => {
    pair = { request, response }; response.on('close', () => closed.release());
    late = (async () => { entered.release(); await release.promise; assert.equal(observer.currentPhase(), undefined); })();
  });
  try {
    await withServer(server, async url => {
      const controller = new AbortController(); const request = fetch(url, { signal: controller.signal }).catch(error => error);
      await entered.promise; controller.abort(); await request; await closed.promise;
      assert.equal(Object.hasOwn(pair.request, 'emit'), false); assert.equal(Object.hasOwn(pair.response, 'emit'), false);
      release.release(); await late;
    }, { phaseObserver: observer });
  } finally { release.release(); await late; }
});

test('nested request dispatch restores its parent and keeps a live child independent of parent retirement', async () => {
  const observer = createFixturePhaseObserver({ enabled: false }); const server = createServer();
  const first = requestPair(); const second = requestPair(); const release = createFixtureGate(); let late;
  server.on('request', request => {
    if (request === first.request) {
      assert.equal(server.emit('request', second.request, second.response), true);
      first.response.emit('finish'); assert.equal(observer.currentPhase(), undefined);
    } else {
      late = (async () => { await release.promise; assert.equal(observer.currentPhase(), 'http_request'); })();
    }
  });
  const owner = observeOwnedHttpRequestPhases({ server, phaseObserver: observer });
  try { server.emit('request', first.request, first.response); release.release(); await late; }
  finally { release.release(); await late; owner.restore(); first.close(); second.close(); }
});

test('unsupported request/response emitters refuse atomically without evaluating accessors', () => {
  const observer = createFixturePhaseObserver({ enabled: false });
  for (const key of ['request', 'response']) {
    const server = createServer(() => assert.equal(observer.currentPhase(), undefined)); const pair = requestPair(); let reads = 0;
    Object.defineProperty(pair[key], 'emit', { configurable: true, get() { reads++; throw null; } });
    const descriptor = Object.getOwnPropertyDescriptor(pair[key], 'emit');
    const owner = observeOwnedHttpRequestPhases({ server, phaseObserver: observer });
    try {
      assert.equal(server.emit('request', pair.request, pair.response), true); assert.equal(reads, 0);
      assert.deepEqual(Object.getOwnPropertyDescriptor(pair[key], 'emit'), descriptor);
      assert.equal(Object.hasOwn(pair[key === 'request' ? 'response' : 'request'], 'emit'), false);
    } finally { owner.restore(); pair.close(); }
  }
});

test('fixture restoration retires held context, preserves later owners and restores exact owned descriptors', async () => {
  const observer = createFixturePhaseObserver({ enabled: false }); const server = createServer(); const pair = requestPair();
  for (const emitter of [server, pair.request, pair.response]) {
    Object.defineProperty(emitter, 'emit', { value: EventEmitter.prototype.emit, writable: true, configurable: true, enumerable: true });
  }
  const descriptor = Object.getOwnPropertyDescriptor(server, 'emit'); const release = createFixtureGate(); let late;
  server.on('request', () => { late = (async () => { await release.promise; assert.equal(observer.currentPhase(), undefined); })(); });
  const owner = observeOwnedHttpRequestPhases({ server, phaseObserver: observer });
  const later = () => false;
  try {
    server.emit('request', pair.request, pair.response); pair.request.emit = later; owner.restore();
    assert.equal(pair.request.emit, later); assert.deepEqual(Object.getOwnPropertyDescriptor(server, 'emit'), descriptor);
    assert.deepEqual(Object.getOwnPropertyDescriptor(pair.response, 'emit'), descriptor);
    assert.equal(pair.response.listenerCount('finish'), 0); assert.equal(pair.response.listenerCount('close'), 0);
    release.release(); await late;
  } finally { owner.restore(); release.release(); await late; pair.close(); }
});

for (const primary of [new Error('primary-scenario'), null]) {
  test(`HTTP fixture restores request ownership after close failure while preserving ${primary === null ? 'null' : 'Error'}`, async () => {
    const observer = createFixturePhaseObserver({ enabled: false }); const server = createServer();
    const close = server.close; const secondary = new Error('secondary-close');
    server.close = function (callback) { return Reflect.apply(close, this, [() => callback(secondary)]); };
    await assert.rejects(withServer(server, () => { throw primary; }, { phaseObserver: observer }), error => error === primary);
    assert.equal(Object.hasOwn(server, 'emit'), false); assert.equal(server.listening, false);
  });
}
