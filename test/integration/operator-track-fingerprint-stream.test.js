/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { writeFile } from 'node:fs/promises';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { seedWantedRootProfile } from '../../testing/integration/wanted-root-profile-fixture.js';
import { createLibraryWantedReleaseReader } from '../../src/server/library/library-wanted-release-reader.js';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';
import { createWantedVerificationObserver } from '../../src/server/library/library-wanted-verification-observer.js';
import { withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime; let pending;
suite('Current large-media fingerprinting through real delivery and Wanted guards', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await Promise.allSettled(pending ? [pending] : []); await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('actual large private deliveries retain fresh rechecks and late-byte refusal without required-event publication', { timeout: config.scenarioTimeoutMs }, async context => {
    pending = withIntegrationApp({ config,
    withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => runtime.runIsolatedDatabase(run, { phaseObserver }),
    run: ({ workspaceDir }) => withFixtureLifecycle({ signal: context.signal }, async scope => {
      const c = await seedWantedRootProfile(workspaceDir, { receiptCandidates: 1, mediaProfile: 'noise', durationSeconds: 30 });
      scope.signal.throwIfAborted();
      const candidate = await c.candidates.getImportCandidate({ importCandidateId: c.candidateId });
      const receipts = candidate.normalizedPayload.operatorTrackFulfillment.receipts;
      const records = []; const options = { assertMaintenanceWriteAllowed: async () => {},
        createVerificationObserver: () => createWantedVerificationObserver({ enabled: true, onRecord: record => records.push(record) }) };
      const wanted = createLibraryWantedReleaseService(options);
      assert.deepEqual((await wanted.reconcileWantedReleases()).wantedKeys, []);
      const healthy = records.at(-1); assert.equal(healthy.counters.fingerprintCalls, healthy.counters.projectionReads * 2);
      assert.equal(healthy.counters.hashedBytes, receipts.reduce((sum, receipt) => sum + receipt.files[0].evidence.sizeBytes, 0) * healthy.counters.projectionReads);
      const path = c.preview.files[0].libraryTarget.path; const owner = c.preview.files[0].delivery.ownerId;
      const reader = createLibraryWantedReleaseReader(); let reads = 0;
      const late = createLibraryWantedReleaseService({ ...options, projectionReader: {
        readWantedReleaseProjection: async input => {
          const projection = await reader.readWantedReleaseProjection(input);
          if (++reads === 1) await writeFile(path, 'Controlled bytes changed after verification');
          return projection;
        },
      } });
      await assert.rejects(late.reconcileWantedReleases(), { code: 'library_wanted_projection_stale' });
      assert.equal(records.at(-1).outcome, 'failed');
      assert.equal((await c.pool.query('SELECT count(*)::integer count FROM library_wanted_releases')).rows[0].count, 0);
      assert.equal((await c.pool.query("SELECT count(*)::integer count FROM media_request_events WHERE event_type='operator_track_source_reopened'")).rows[0].count, 0);
      scope.signal.throwIfAborted();
      await wanted.reconcileWantedReleases(); scope.signal.throwIfAborted(); await wanted.reconcileWantedReleases();
      assert.deepEqual((await c.pool.query('SELECT app_user_id FROM library_wanted_releases')).rows.map(row => row.app_user_id), [owner]);
      assert.equal((await c.pool.query("SELECT count(*)::integer count FROM media_request_events WHERE event_type='operator_track_source_reopened'")).rows[0].count, 1);
    }) });
    pending.catch(() => {}); return pending;
  });
});
