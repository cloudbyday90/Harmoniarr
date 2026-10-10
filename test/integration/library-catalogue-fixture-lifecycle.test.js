/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { access, readFile, rm, writeFile } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { createScopedFixtureGate } from '../../testing/integration/fixture-work-scope.js';
import { startLibraryScanCatalogueFixtureWorker } from '../../testing/integration/library-scan-catalogue-worker-fixture.js';
import { snapshotCatalogueFixture, withLibraryScanCatalogueScenario } from '../../testing/integration/library-scan-catalogue-scenario.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime; let unavailable;

function assertOwnedRelease(released, input) {
  assert.equal(released.leaseKey, input.expectedLease.leaseKey);
  assert.equal(released.ownerInstanceId, input.expectedLease.ownerInstanceId);
  assert.equal(released.acquisitionId, input.expectedLease.acquisitionId);
  assert.equal(released.state, 'released'); assert.equal(released.status, input.status);
  assert.equal(typeof released.releasedAt, 'string');
  assert.equal(Number.isFinite(Date.parse(released.releasedAt)), true);
  assert.equal(Date.parse(released.releasedAt) >= Date.parse(input.expectedLease.acquiredAt), true);
}

async function assertDrained(c, job, initial) {
  assert.deepEqual(await snapshotCatalogueFixture(c), initial);
  assert.deepEqual(job.downstream, []);
  assert.equal((await c.pool.query(`SELECT count(*)::integer AS count FROM pg_stat_activity
    WHERE datname=current_database() AND state LIKE 'idle in transaction%'`)).rows[0].count, 0);
  assert.equal((await c.pool.query('SELECT released_at IS NOT NULL AS released FROM job_leases WHERE lease_key=$1',
    [job.lease().leaseKey])).rows[0].released, true);
  await access(c.requestedRoot);
}

suite('Native catalogue fixture error and transaction lifetime', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config, schemaMode: 'empty' }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailable = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('native walk hook assertion before readiness drains release before workspace removal and retains its cause', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    let primary; let requestedRoot; let job; const order = [];
    await assert.rejects(withLibraryScanCatalogueScenario(runtime, t, async (c) => {
      requestedRoot = c.requestedRoot;
      const initial = await snapshotCatalogueFixture(c);
      c.scope.onAfterDrain(async () => { await assertDrained(c, job, initial); order.push('after drain'); });
      const unreachable = createScopedFixtureGate(c.scope);
      const runs = { ...c.a, releaseLease: async (input) => {
        assertOwnedRelease(await c.a.releaseLease(input), input); order.push('actual release');
        throw new Error('Controlled secondary catalogue release failure');
      } };
      job = await startLibraryScanCatalogueFixtureWorker({ scope: c.scope, runs, runId: c.run.id,
        requestedRoot: c.requestedRoot, recordLibraryScanCatalogue: c.owner.recordLibraryScanCatalogue,
        afterWalk: async (summary) => {
          try { assert.equal(summary.filesSeen, -1, 'Controlled walk fixture hook assertion'); }
          catch (error) { primary = error; throw error; }
        },
      });
      await job.waitForReady(unreachable.promise);
    }, { workspaceOptions: { removeDirectory: async (path, options) => {
      await rm(path, options); order.push('workspace removed');
      throw new Error('Controlled secondary catalogue workspace failure');
    } } }), (error) => error === primary && error?.code === 'ERR_ASSERTION');
    assert.deepEqual(order, ['actual release', 'after drain', 'workspace removed']);
    await assert.rejects(access(requestedRoot), (error) => error.code === 'ENOENT');
  });

  test('cancellation inside a held native catalogue transaction rolls back before release and media removal', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    for (const primary of [new Error('Controlled held catalogue transaction cancellation'), null]) {
      const controller = new AbortController();
      const entered = createFixtureGate(); const order = []; let requestedRoot; let job; let rootWriteReached = false;
      const operation = withLibraryScanCatalogueScenario(runtime, t, async (c) => {
        requestedRoot = c.requestedRoot;
        const initial = await snapshotCatalogueFixture(c);
        await writeFile(c.stable, c.replacementBytes); await rm(c.old); await writeFile(c.newFile, c.replacementBytes);
        c.scope.onAfterDrain(async () => {
          await assertDrained(c, job, initial);
          assert.deepEqual(await readFile(c.stable), c.replacementBytes);
          assert.deepEqual(await readFile(c.newFile), c.replacementBytes);
          order.push('after drain');
        });
        const hold = createScopedFixtureGate(c.scope);
        const owner = c.createOwner(async (input) => {
          const queryable = { query: async (sql, values) => {
            const result = await input.queryable.query(sql, values);
            if (sql.includes('INSERT INTO library_roots')) {
              rootWriteReached = true; entered.release();
              await hold.promise;
            }
            return result;
          } };
          return c.catalog.recordLibraryFiles({ ...input, queryable });
        });
        const runs = { ...c.a, releaseLease: async (input) => {
          const released = await c.a.releaseLease(input); assertOwnedRelease(released, input);
          order.push('actual release'); return released;
        } };
        job = await startLibraryScanCatalogueFixtureWorker({ scope: c.scope, runs, runId: c.run.id,
          requestedRoot: c.requestedRoot, recordLibraryScanCatalogue: owner.recordLibraryScanCatalogue });
        await job.done;
      }, { signal: AbortSignal.any([t.signal, controller.signal]), workspaceOptions: { removeDirectory: async (path, options) => {
        await rm(path, options); order.push('workspace removed');
      } } });
      operation.catch(() => {});
      await waitForFixtureReady({ ready: entered.promise, operation, signal: t.signal });
      assert.equal(rootWriteReached, true); controller.abort(primary);
      await assert.rejects(operation, (error) => error === primary);
      assert.deepEqual(order, ['actual release', 'after drain', 'workspace removed']);
      await assert.rejects(access(requestedRoot), (error) => error.code === 'ENOENT');
    }
  });
});
