/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { access, rm } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { createScopedFixtureGate } from '../../testing/integration/fixture-work-scope.js';
import { startLibraryTagSnapshotFixtureWorker } from '../../testing/integration/library-tag-snapshot-worker-fixture.js';
import { snapshotTagFixture, withLibraryTagSnapshotScenario } from '../../testing/integration/library-tag-snapshot-scenario.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime; let unavailable;

function assertOwnedRelease(released, input) {
  assert.equal(released.leaseKey, input.expectedLease.leaseKey);
  assert.equal(released.ownerInstanceId, input.expectedLease.ownerInstanceId);
  assert.equal(released.acquisitionId, input.expectedLease.acquisitionId);
  assert.equal(released.state, 'released');
  assert.equal(released.status, input.status);
  assert.equal(typeof released.releasedAt, 'string');
  assert.equal(Number.isFinite(Date.parse(released.releasedAt)), true);
  assert.equal(Date.parse(released.releasedAt) >= Date.parse(input.expectedLease.acquiredAt), true);
}

async function assertStoppedBeforeTeardown(c, job) {
  const current = await snapshotTagFixture(c);
  assert.equal(current.history.length, 0); assert.equal(current.files[0].tag_payload, null);
  assert.deepEqual(job.artwork, []); assert.deepEqual(job.downstream, []);
  assert.equal((await c.pool.query(`SELECT count(*)::integer AS count FROM pg_stat_activity
    WHERE datname=current_database() AND state='idle in transaction'`)).rows[0].count, 0);
  assert.equal((await c.pool.query('SELECT released_at IS NOT NULL AS released FROM job_leases WHERE lease_key=$1',
    [job.lease().leaseKey])).rows[0].released, true);
}

suite('Native tag fixture failure and cancellation ownership', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailable = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('hook assertion before readiness preserves its identity through actual release and secondary cleanup faults', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    let primary; let requestedRoot; let job; const order = [];
    await assert.rejects(withLibraryTagSnapshotScenario(runtime, t, async (c) => {
      requestedRoot = c.requestedRoot;
      c.scope.onAfterDrain(async () => { await assertStoppedBeforeTeardown(c, job); order.push('after drain'); });
      const unreachable = createScopedFixtureGate(c.scope);
      const runs = { ...c.a, releaseLease: async (input) => {
        assertOwnedRelease(await c.a.releaseLease(input), input); order.push('actual release');
        throw new Error('Controlled secondary release adapter failure');
      } };
      job = await startLibraryTagSnapshotFixtureWorker(c, runs, { afterParse: async (_path, metadata) => {
        try { assert.equal(metadata.common.title, 'Controlled unreachable title', 'Controlled tag fixture hook assertion'); }
        catch (error) { primary = error; throw error; }
      } });
      await job.waitForReady(unreachable.promise);
    }, { workspaceOptions: { removeDirectory: async (path, options) => {
      await rm(path, options); order.push('workspace removed');
      throw new Error('Controlled secondary workspace cleanup failure');
    } } }), (error) => error === primary && error?.code === 'ERR_ASSERTION');
    assert.deepEqual(order, ['actual release', 'after drain', 'workspace removed']);
    await assert.rejects(access(requestedRoot), (error) => error.code === 'ENOENT');
  });

  test('cancellation while native parsed metadata is held drains the worker before media and database teardown', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    const controller = new AbortController(); const primary = new Error('Controlled held native tag cancellation');
    const entered = createFixtureGate(); const order = []; let requestedRoot; let job;
    const operation = withLibraryTagSnapshotScenario(runtime, t, async (c) => {
      requestedRoot = c.requestedRoot;
      c.scope.onAfterDrain(async () => { await assertStoppedBeforeTeardown(c, job); order.push('after drain'); });
      const hold = createScopedFixtureGate(c.scope);
      const runs = { ...c.a, releaseLease: async (input) => {
        const released = await c.a.releaseLease(input);
        assertOwnedRelease(released, input); order.push('actual release'); return released;
      } };
      job = await startLibraryTagSnapshotFixtureWorker(c, runs, { afterParse: async (_path, metadata) => {
        assert.equal(metadata.common.title, 'Original title'); entered.release(); await hold.promise;
      } });
      await job.done;
    }, { signal: AbortSignal.any([t.signal, controller.signal]), workspaceOptions: { removeDirectory: async (path, options) => {
      await rm(path, options); order.push('workspace removed');
    } } });
    operation.catch(() => {});
    await waitForFixtureReady({ ready: entered.promise, operation, signal: t.signal }); controller.abort(primary);
    await assert.rejects(operation, (error) => error === primary);
    assert.deepEqual(order, ['actual release', 'after drain', 'workspace removed']);
    await assert.rejects(access(requestedRoot), (error) => error.code === 'ENOENT');
  });
});
