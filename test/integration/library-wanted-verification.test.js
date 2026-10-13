/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { seedTrackDeliveryRecoveryFixture, runTrackDeliveryApply } from '../../testing/integration/operator-track-delivery-recovery-fixture.js';
import { createImportCandidateApplyOperationService } from '../../src/server/import-candidates/import-candidate-apply-operation-service.js';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';
import { createLibraryWantedReleaseReader } from '../../src/server/library/library-wanted-release-reader.js';
import { createWantedVerificationObserver } from '../../src/server/library/library-wanted-verification-observer.js';

const config = resolveIntegrationTestRuntimeConfig(); let postgres;

suite('Wanted receipt verification diagnostics on current private media', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  for (const mediaProfile of ['sine', 'noise']) {
    test(`${mediaProfile} tagged FLAC reports actual repeated hashing and preserves late refusal and event rollback`, {
      timeout: config.scenarioTimeoutMs,
    }, async context => withIntegrationApp({ config,
      withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => postgres.runIsolatedDatabase(run, { phaseObserver }),
      run: async ({ workspaceDir }) => {
        const c = await seedTrackDeliveryRecoveryFixture(workspaceDir, { mediaProfile });
        const preview = await c.preview.previewImportCandidateApply({ importCandidateId: c.candidateId });
        const applied = await runTrackDeliveryApply(c, createImportCandidateApplyOperationService({ mediaInspectionService: c.inspection }));
        assert.equal(applied.item.itemStatus, 'applied');
        const files = preview.files.map(file => file.libraryTarget.path); const sizes = await Promise.all(files.map(async file => (await stat(file)).size));
        const records = []; const createVerificationObserver = () => createWantedVerificationObserver({ enabled: true, onRecord: record => records.push(record) });
        const options = { assertMaintenanceWriteAllowed: async () => {}, createVerificationObserver };
        const wanted = createLibraryWantedReleaseService(options);
        for (let repetition = 0; repetition < 3; repetition++) {
          const result = await wanted.reconcileWantedReleases(); const record = records.at(-1);
          assert.deepEqual(result.wantedKeys, []); assert.equal(record.outcome, 'completed');
          assert.equal(record.counters.receiptRows, record.counters.projectionReads * 2);
          assert.equal(record.counters.fingerprintCalls, record.counters.receiptRows);
          assert.equal(record.counters.fingerprintCompleted, record.counters.fingerprintCalls);
          assert.equal(record.counters.hashedBytes, sizes.reduce((sum, size) => sum + size, 0) * record.counters.projectionReads);
          assert.equal(record.counters.mismatchedReceipts, 0); assert.equal(record.counters.unexpectedErrors, 0);
          context.diagnostic(JSON.stringify({ kind: 'wanted_measurement', mediaProfile, repetition, fileSizes: sizes,
            counters: record.counters, phases: record.phases }));
        }
        assert.equal(records.length, 3);
        const disabled = createLibraryWantedReleaseService({ assertMaintenanceWriteAllowed: async () => {},
          createVerificationObserver: () => createWantedVerificationObserver({ enabled: false, onRecord: () => assert.fail('Disabled sink') }) });
        assert.deepEqual(await disabled.reconcileWantedReleases(), { wantedKeys: [], deletedWantedKeys: [] });
        assert.equal((await c.pool.query("SELECT count(*)::integer count FROM media_requests WHERE request_state='already_exists'")).rows[0].count, 2);
        const original = await readFile(files[0]); const reader = createLibraryWantedReleaseReader(); let reads = 0;
        const late = createLibraryWantedReleaseService({ ...options, projectionReader: {
          readWantedReleaseProjection: async input => {
            const result = await reader.readWantedReleaseProjection(input);
            if (++reads === 1) await writeFile(files[0], 'Controlled late byte replacement');
            return result;
          },
        } });
        await assert.rejects(late.reconcileWantedReleases(), { code: 'library_wanted_projection_stale' });
        assert.equal(records.at(-1).outcome, 'failed'); assert.ok(records.at(-1).counters.mismatchedReceipts > 0);
        assert.equal((await c.pool.query('SELECT count(*)::integer count FROM library_wanted_releases')).rows[0].count, 0);
        await writeFile(files[0], original);
        await c.pool.query(`CREATE FUNCTION reject_wanted_observed_source() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.event_type='operator_track_source_reopened' THEN RAISE EXCEPTION 'Controlled observed source event'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER reject_wanted_observed_source BEFORE INSERT ON media_request_events FOR EACH ROW EXECUTE FUNCTION reject_wanted_observed_source()`);
        await writeFile(files[0], 'Controlled unavailable media');
        const failingSink = createLibraryWantedReleaseService({ assertMaintenanceWriteAllowed: async () => {},
          createVerificationObserver: () => createWantedVerificationObserver({ enabled: true, onRecord: record => { records.push(record); throw null; } }) });
        await assert.rejects(failingSink.reconcileWantedReleases(), error => error.message.includes('Controlled observed source event'));
        assert.equal(records.at(-1).outcome, 'failed');
        assert.equal((await c.pool.query('SELECT count(*)::integer count FROM library_wanted_releases')).rows[0].count, 0);
        assert.equal((await c.pool.query("SELECT count(*)::integer count FROM media_requests WHERE request_state='already_exists'")).rows[0].count, 2);
        assert.equal((await c.pool.query("SELECT count(*)::integer count FROM media_request_events WHERE event_type='operator_track_source_reopened'")).rows[0].count, 0);
        await c.pool.query('DROP TRIGGER reject_wanted_observed_source ON media_request_events');
        await wanted.reconcileWantedReleases(); await wanted.reconcileWantedReleases();
        assert.deepEqual((await c.pool.query('SELECT app_user_id FROM library_wanted_releases')).rows.map(row => row.app_user_id), [preview.files[0].delivery.ownerId]);
        assert.equal((await c.pool.query("SELECT count(*)::integer count FROM media_request_events WHERE event_type='operator_track_source_reopened'")).rows[0].count, 1);
      } }));
  }
});
