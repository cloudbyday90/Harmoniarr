/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { supportsPgObserverDriver } from '../../testing/integration/pg-observer-driver.js';
import { supportsPgObserverVersions } from '../../testing/integration/pg-observer-driver-policy.js';

test('the installed PostgreSQL diagnostic driver has a reviewed implementation', () => {
  assert.equal(supportsPgObserverDriver(), true, 'Review installed pg, pg-pool and pg-protocol before updating diagnostic support');
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
