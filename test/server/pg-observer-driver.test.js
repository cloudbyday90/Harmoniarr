/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { supportsPgObserverDriver, supportsPgQueueObserver } from '../../testing/integration/pg-observer-driver.js';
import { supportsPgObserverVersions } from '../../testing/integration/pg-observer-driver-policy.js';
import { attachPoolAdmissionLimit, hasPoolAdmissionConnect } from '../../src/server/database-pool-admission-service.js';

test('the installed PostgreSQL diagnostic driver has a reviewed implementation', () => {
  assert.equal(supportsPgObserverDriver(), true, 'Review installed pg, pg-pool and pg-protocol before updating diagnostic support');
});

test('native queue instrumentation recognizes only the exact owned admission wrapper and delegate', async () => {
  const pools = [];
  const create = () => { const pool = new pg.Pool(); pools.push(pool); return pool; };
  try {
    const native = create(); assert.equal(supportsPgQueueObserver(native), true);
    const owned = attachPoolAdmissionLimit(create());
    assert.equal(hasPoolAdmissionConnect(owned, pg.Pool.prototype.connect), true);
    assert.equal(supportsPgQueueObserver(owned), true);
    const wrapper = owned.connect;
    const foreign = create(); foreign.connect = function () {}; attachPoolAdmissionLimit(foreign);
    assert.equal(supportsPgQueueObserver(foreign), false);
    owned.connect = wrapper.bind(owned); assert.equal(supportsPgQueueObserver(owned), false);
    const borrowed = attachPoolAdmissionLimit(create()); borrowed.connect = wrapper;
    assert.equal(supportsPgQueueObserver(borrowed), false);
    let reads = 0;
    Object.defineProperty(owned, 'connect', { configurable: true, get() { reads++; return wrapper; } });
    assert.equal(hasPoolAdmissionConnect(owned, pg.Pool.prototype.connect), false);
    assert.equal(reads, 0); assert.equal(supportsPgQueueObserver(owned), false);
  } finally { await Promise.all(pools.map(pool => pool.end())); }
});

test('unreviewed driver, queue and serializer versions refuse diagnostic instrumentation without coercion', () => {
  const reviewed = ['8.23.1', '3.14.0', '1.16.1'];
  assert.equal(supportsPgObserverVersions(...reviewed), true);
  let coercions = 0;
  for (const [index, adjacent] of [[0, ['8.23.0', '8.23.2', '9.0.0']], [1, ['3.13.0', '3.14.1', '4.0.0']],
    [2, ['1.16.0', '1.16.2', '2.0.0']]]) {
    for (const value of [...adjacent, undefined, null, { toString() { coercions++; throw null; } }]) {
      const candidate = [...reviewed]; candidate[index] = value;
      assert.equal(supportsPgObserverVersions(...candidate), false);
    }
  }
  assert.equal(coercions, 0);
});
