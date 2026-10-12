/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../src/server/database.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createOperatorArtistSaveService } from '../../src/server/metadata/operator-artist-save-service.js';
import { defaultOperatorArtistMonitoringPolicy } from '../../src/server/metadata/operator-artist-monitoring-policy.js';
import { createLibraryWantedReleaseReader } from '../../src/server/library/library-wanted-release-reader.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { seedOperatorReconciliationLifetimeRun } from '../../testing/integration/operator-reconciliation-lifetime-fixture.js';
import { executeOperatorReconciliationFixtureRun } from '../../testing/integration/operator-reconciliation-execution-fixture.js';

const config = resolveIntegrationTestRuntimeConfig();
let postgres;

suite('Saved track overrides grant acquisition exceptions only with resolved desired intent', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); },
    { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  const scenario = run => withIntegrationApp({ config, run,
    withPostgresIntegrationRuntimeFn: ({ run: execute, phaseObserver }) =>
      postgres.runIsolatedDatabase(execute, { phaseObserver }),
  });

  const cases = [
    { name: 'suppression cannot bypass manual-only track-only policy', isDesired: false },
    { name: 'review-needed desired intent cannot grant an exception', isDesired: true, remapStatus: 'review_needed' },
    { name: 'orphaned desired intent cannot grant an exception', isDesired: true, remapStatus: 'orphaned' },
    { name: 'desired intent bound to another edition cannot grant an exception', isDesired: true, otherEdition: true },
    { name: 'forged eligible and explicit flags cannot bypass unchanged saved suppression', isDesired: false, forged: true },
    { name: 'resolved desired intent bound to the current edition still publishes', isDesired: true, publishes: true, explicit: true },
    { name: 'resolved desired group-scoped intent still publishes', isDesired: true, groupScoped: true, publishes: true, explicit: true },
    { name: 'manual release selection remains independent of suppression', isDesired: false, manual: true, publishes: true, explicit: true },
    { name: 'broad policy remains independent of suppression', isDesired: false, broadPolicy: true, publishes: true, explicit: false },
  ];

  for (const entry of cases) {
    test(entry.name, { timeout: config.scenarioTimeoutMs }, async () => {
      await scenario(async () => {
        const fixture = await seedOperatorReconciliationLifetimeRun();
        const pool = getPool();
        const recording = (await pool.query('SELECT musicbrainz_recording_id FROM metadata_recordings WHERE id=$1',
          [fixture.metadata.metadataRecordingId])).rows[0];
        let boundReleaseId = fixture.metadata.metadataReleaseId;
        if (entry.otherEdition) {
          boundReleaseId = (await pool.query(`INSERT INTO metadata_releases
            (metadata_release_group_id,source_provider,source_release_id,musicbrainz_release_id,title,status,release_date,track_count,medium_count,is_canonical)
            VALUES($1,'musicbrainz',$2,$3,'Another edition','Official','2099-10-01',1,1,FALSE) RETURNING id`,
          [fixture.metadata.metadataReleaseGroupId, randomUUID(), randomUUID()])).rows[0].id;
          const medium = (await pool.query(`INSERT INTO metadata_media(metadata_release_id,position,format,track_count)
            VALUES($1,1,'CD',1) RETURNING id`, [boundReleaseId])).rows[0];
          await pool.query(`INSERT INTO metadata_tracks(metadata_medium_id,metadata_recording_id,position,number_text,title,length_ms,artist_credit)
            VALUES($1,$2,1,'1','Foil',322000,'Autechre')`, [medium.id, fixture.metadata.metadataRecordingId]);
        }
        const saved = await createOperatorArtistSaveService({ getOperatorArtistProjection: async () => null,
          startMetadataArtistRefresh: async () => ({ accepted: true }),
        }).saveOperatorArtist({ appUserId: fixture.user.id, metadataArtistId: fixture.metadata.metadataArtistId,
          expectedSnapshotRevision: fixture.snapshot.snapshotRevision,
          draft: {
            monitoring: { ...defaultOperatorArtistMonitoringPolicy, isMonitored: true,
              monitoredReleaseGroupTypes: ['album'], selectionSourceMode: 'policy_plus_overrides',
              releaseScope: entry.broadPolicy ? 'current_and_future' : 'track_only',
              wantedAutomationMode: entry.broadPolicy ? 'current_and_future_matching' : 'manual_only' },
            releaseGroupSelections: entry.manual ? [{ metadataReleaseGroupId: fixture.metadata.metadataReleaseGroupId,
              resolvedMetadataReleaseId: fixture.metadata.metadataReleaseId,
              selectionSource: 'manual', selectionState: 'selected', selectionOrigin: 'manual_inclusion' }] : [],
            trackOverrides: [{ metadataReleaseGroupId: fixture.metadata.metadataReleaseGroupId,
              metadataReleaseId: entry.groupScoped ? null : boundReleaseId,
              recordingMbid: recording.musicbrainz_recording_id, mediumPosition: 1, trackPosition: 1,
              isDesired: entry.isDesired, remapStatus: entry.remapStatus ?? 'resolved' }],
          },
        });
        assert.equal(saved.snapshot.snapshotRevision, 2);
        const wanted = await createDatabaseTransactionRunner()(queryable =>
          createLibraryWantedReleaseReader().readWantedReleaseProjection({ queryable }));
        const { captured, desiredReleases, state } = await executeOperatorReconciliationFixtureRun(saved.reconciliation.run, {
          transformDesiredReleases: releases => entry.forged
            ? releases.map(release => ({ ...release, eligibleForDownstreamWork: true, isExplicitSelection: true })) : releases,
        });
        assert.equal(captured.trackOverrides.length, 1);
        assert.equal(captured.trackOverrides[0].isDesired, entry.isDesired);
        assert.equal(desiredReleases.length, 1);
        if (entry.publishes) {
          assert.equal(wanted.wantedReleases.length, 1);
          assert.equal(state.operation.status, 'completed');
          assert.equal(state.requests.length, 1);
          assert.equal(state.events.length, 1);
          assert.equal(state.events[0].media_request_id, state.requests[0].id);
          assert.equal(state.discovery.length, 1);
          assert.equal(state.requests[0].evidence.operatorArtistReconciliation.isExplicitSelection, entry.explicit);
          assert.equal(state.requests[0].requested_by_user_id, fixture.user.id);
          assert.equal(state.requests[0].matched_metadata_release_id, fixture.metadata.metadataReleaseId);
        } else {
          assert.deepEqual(state.requests, []);
          assert.deepEqual(wanted.wantedReleases, []);
          assert.deepEqual(state.events, []);
          assert.deepEqual(state.discovery, []);
          assert.equal(desiredReleases[0].isExplicitSelection, false);
          assert.equal(desiredReleases[0].eligibleForDownstreamWork, false);
          if (entry.forged) {
            assert.equal(state.operation.status, 'failed');
            assert.equal(state.operation.error_message, 'Saved artist policy or catalog changed before request publication');
          } else {
            assert.equal(state.operation.status, 'completed');
            assert.equal(state.operation.summary.trackOnlyBlockedCount, 1);
            assert.equal(state.operation.summary.downstreamCreatedRequestCount, 0);
          }
        }
      });
    });
  }
});
