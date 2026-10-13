/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixtureGate } from '../../testing/integration/fixture-lifecycle.js';
import { profileWantedProjection } from '../../testing/integration/wanted-root-profile-fixture.js';

test('cancelled profiling admits no query and retains original Error/null', async () => {
  for (const error of [new Error('Profile cancelled'), null]) {
    const controller = new AbortController(); controller.abort(error);
    let caught = false;
    try { await profileWantedProjection({ query: () => assert.fail('No work after cancellation') }, { useCombinedRootRead: true, signal: controller.signal }); }
    catch (actual) { caught = true; assert.equal(actual, error); }
    assert.equal(caught, true);
  }
});

test('profiling owns a held query through cancellation before returning its original reason', async () => {
  const controller = new AbortController(); const entered = createFixtureGate(); const query = createFixtureGate();
  const error = new Error('Cancel while query is returned'); let settled = false;
  const operation = profileWantedProjection({ query: async () => { entered.release(); return query.promise; } }, { useCombinedRootRead: true, signal: controller.signal });
  const observed = operation.then(() => { settled = true; assert.fail('Cancelled result'); }, actual => { settled = true; assert.equal(actual, error); });
  try {
    await entered.promise; controller.abort(error); await Promise.resolve(); assert.equal(settled, false);
  } finally { query.release({ rows: [] }); await observed; }
  assert.equal(settled, true);
});
