import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession, loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { seedImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { seedOperationRunFixture } from '../../testing/integration/operation-run-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import {
  isSkippableIntegrationRuntimeError,
  toIntegrationRuntimeUnavailableReason,
} from '../../testing/integration/runtime-availability.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
let integrationRuntime;
let runtimeUnavailableReason = null;

async function createRequesterUser(adminClient, {
  password,
  username,
} = {}) {
  const response = await adminClient.requestJson('/api/v1/users', {
    csrf: true,
    json: {
      password,
      role: 'requester',
      username,
    },
    method: 'POST',
  });

  assert.equal(response.response.status, 201);
  return response.payload.user;
}

suite('integration library media request routes', () => {
  before(async () => {
    try {
      integrationRuntime = await createIntegrationAppRuntime({
        config: integrationRuntimeConfig,
      });
      runtimeUnavailableReason = null;
    } catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) {
        throw error;
      }

      runtimeUnavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, {
    timeout: integrationRuntimeConfig.suiteSetupTimeoutMs,
  });

  after(async () => {
    await integrationRuntime?.cleanup();
  }, {
    timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs,
  });

  test('delegated media requests expose scoped fulfillment, notifications, and import-candidate visibility through the real server graph', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ baseUrl, client, getPoolFn }) => {
      const bootstrapResponse = await bootstrapAdminSession(client);
      assert.equal(bootstrapResponse.response.status, 201);

      const targetUser = await createRequesterUser(client, {
        password: 'TargetPass123!',
        username: 'listener-target',
      });

      const delegatedRequestResponse = await client.requestJson('/api/v1/library/media-requests', {
        csrf: true,
        json: {
          artistName: 'Autechre',
          releaseTitle: 'Amber',
          requestKind: 'release',
          requestedForUserId: targetUser.id,
        },
        method: 'POST',
      });

      assert.equal(delegatedRequestResponse.response.status, 201);

      const mediaRequest = delegatedRequestResponse.payload.mediaRequest;
      assert.equal(mediaRequest.requestedByUser.username, 'admin');
      assert.equal(mediaRequest.requestedForUser.username, 'listener-target');

      const linkedCandidate = await seedImportCandidateFixture({
        candidateOverrides: {
          discoveredAt: '2026-05-04T13:00:00.000Z',
          normalizedPayload: {
            extensions: ['flac'],
            fileCount: 1,
            folderPath: 'Autechre\\Amber',
            hasFreeUploadSlot: true,
            lockedFileCount: 0,
            queueLength: 0,
            requestOwnership: {
              sourceMediaRequestId: mediaRequest.id,
              sourceRequestKind: mediaRequest.requestKind,
              sourceRequestedByUserId: mediaRequest.requestedByUser.id,
              sourceRequestedForUserId: mediaRequest.requestedForUser.id,
              sourceType: 'media_request',
            },
            totalSizeBytes: 42000000,
            uploadSpeed: 2048,
            username: 'source-user',
          },
          sourceSearchId: 'delegated-request-search',
          status: 'downloading',
          username: 'source-user',
        },
        queryable: getPoolFn(),
      });

      const unrelatedCandidate = await seedImportCandidateFixture({
        candidateOverrides: {
          folderPath: 'Hidden\\Candidate',
          sourceSearchId: 'hidden-request-search',
          status: 'downloading',
          username: 'hidden-user',
        },
        queryable: getPoolFn(),
      });

      const executionRun = await seedOperationRunFixture({
        queryable: getPoolFn(),
        runOverrides: {
          operationType: 'import_candidate_execution_planning',
          startedAt: '2026-05-04T13:05:00.000Z',
          status: 'completed',
        },
      });
      await getPoolFn().query(
        `
          INSERT INTO import_execution_run_items (
            operation_run_id,
            import_candidate_id,
            position,
            item_status,
            status_message,
            planning_snapshot
          )
          VALUES ($1, $2, 1, 'queued', 'Downloading', $3::jsonb)
        `,
        [
          executionRun.id,
          linkedCandidate.id,
          JSON.stringify({
            candidate: {
              folderPath: '/private/staging/Autechre/Amber',
              username: 'source-user',
            },
            execution: {
              enqueuedTransfers: [{
                filename: '01 Foil.flac',
                id: 'transfer-1',
                username: 'source-user',
              }],
              latestTransferSnapshot: {
                lastReconciledAt: '2026-05-04T13:06:00.000Z',
                summary: {
                  bytesTransferred: 17_640_000,
                  message: '1 transfer is actively progressing.',
                  percentComplete: 42,
                  status: 'active',
                  totalBytes: 42_000_000,
                },
              },
            },
          }),
        ],
      );

      const targetClient = createSessionHttpClient(baseUrl, {
        requestTimeoutMs: integrationRuntimeConfig.httpRequestTimeoutMs,
      });
      const targetLoginResponse = await loginWithPassword(targetClient, {
        password: 'TargetPass123!',
        username: 'listener-target',
      });
      assert.equal(targetLoginResponse.response.status, 200);

      const targetSummaryResponse = await targetClient.requestJson('/api/v1/library/media-request-summary?scope=all');
      assert.equal(targetSummaryResponse.response.status, 200);
      assert.equal(targetSummaryResponse.payload.scope, 'mine');
      assert.equal(targetSummaryResponse.payload.counts.totalRequests, 1);
      assert.equal(targetSummaryResponse.payload.fulfillmentCounts.downloading, 1);
      assert.equal(targetSummaryResponse.payload.fulfillmentCounts.active, 1);
      assert.equal(targetSummaryResponse.payload.notificationFeed.counts.total, 2);
      assert.equal(targetSummaryResponse.payload.notificationFeed.counts.byCategory.delegated_request, 1);
      assert.equal(targetSummaryResponse.payload.notificationFeed.counts.byCategory.fulfillment, 1);
      assert.deepEqual(
        targetSummaryResponse.payload.notificationFeed.notifications.map((notification) => notification.title).sort(),
        ['Download in progress', 'Music requested for you'],
      );
      assert.equal(targetSummaryResponse.payload.recentRequests.length, 1);
      assert.equal(targetSummaryResponse.payload.recentRequests[0].fulfillmentStatus.code, 'downloading');
      assert.equal(targetSummaryResponse.payload.recentRequests[0].fulfillmentStatus.importCandidateId, linkedCandidate.id);

      const targetListResponse = await targetClient.requestJson('/api/v1/library/media-requests');
      assert.equal(targetListResponse.response.status, 200);
      assert.equal(targetListResponse.payload.scope, 'mine');
      assert.equal(targetListResponse.payload.mediaRequests.length, 1);
      assert.equal(targetListResponse.payload.mediaRequests[0].requestedByUser.username, 'admin');
      assert.equal(targetListResponse.payload.mediaRequests[0].requestedForUser.username, 'listener-target');
      assert.equal(targetListResponse.payload.mediaRequests[0].fulfillmentStatus.code, 'downloading');

      const targetPipelineResponse = await targetClient.requestJson(
        `/api/v1/library/media-requests/${mediaRequest.id}/pipeline`,
      );
      assert.equal(targetPipelineResponse.response.status, 200);
      assert.equal(targetPipelineResponse.payload.candidates.length, 1);
      assert.equal(targetPipelineResponse.payload.candidates[0].sourceKey, 'source-1');
      assert.equal(targetPipelineResponse.payload.candidates[0].sourceLabel, 'Source 1');
      assert.equal('id' in targetPipelineResponse.payload.candidates[0], false);
      assert.equal('username' in targetPipelineResponse.payload.candidates[0], false);
      assert.equal('folderPath' in targetPipelineResponse.payload.candidates[0], false);
      assert.equal('candidateType' in targetPipelineResponse.payload.candidates[0], false);
      assert.deepEqual(targetPipelineResponse.payload.candidates[0].transferProgress, {
        observedAt: '2026-05-04T13:06:00.000Z',
        percentComplete: 42,
        status: 'active',
      });
      assert.equal('planningSnapshot' in targetPipelineResponse.payload.candidates[0].execution, false);
      assert.equal('operationRunId' in targetPipelineResponse.payload.candidates[0].execution, false);
      assert.equal(JSON.stringify(targetPipelineResponse.payload).includes('/private/staging'), false);
      assert.equal(JSON.stringify(targetPipelineResponse.payload).includes('01 Foil.flac'), false);
      assert.equal(JSON.stringify(targetPipelineResponse.payload).includes('source-user'), false);

      const visibleImportCandidatesResponse = await targetClient.requestJson('/api/v1/import-candidates?status=downloading&limit=10');
      assert.equal(visibleImportCandidatesResponse.response.status, 200);
      assert.equal(visibleImportCandidatesResponse.payload.importCandidates.pagination.total, 1);
      const [visibleImportCandidate] = visibleImportCandidatesResponse.payload.importCandidates.candidates;
      const { updatedAt: visibleCandidateUpdatedAt, ...visibleCandidateProjection } = visibleImportCandidate;
      assert.deepEqual(visibleCandidateProjection, {
        sourceKey: 'source-1',
        sourceLabel: 'Source 1',
        sourceProvider: 'slskd',
        status: 'downloading',
        fileCount: 1,
        totalSizeBytes: linkedCandidate.totalSizeBytes,
        formats: ['flac'],
        discoveredAt: '2026-05-04T13:00:00.000Z',
      });
      assert.equal(typeof visibleCandidateUpdatedAt, 'string');
      assert.equal('id' in visibleImportCandidate, false);
      assert.equal('username' in visibleImportCandidate, false);
      assert.equal('folderPath' in visibleImportCandidate, false);
      assert.equal('requestedForUserId' in visibleImportCandidatesResponse.payload.importCandidates.filters, false);

      const linkedDetailResponse = await targetClient.requestJson(`/api/v1/import-candidates/${linkedCandidate.id}`);
      assert.equal(linkedDetailResponse.response.status, 200);
      const { updatedAt: linkedDetailUpdatedAt, ...linkedDetailProjection } = linkedDetailResponse.payload.importCandidate;
      assert.deepEqual(linkedDetailProjection, {
        sourceKey: 'source',
        sourceLabel: 'Source',
        sourceProvider: 'slskd',
        status: 'downloading',
        fileCount: 1,
        totalSizeBytes: linkedCandidate.totalSizeBytes,
        formats: ['flac'],
        discoveredAt: '2026-05-04T13:00:00.000Z',
      });
      assert.equal(typeof linkedDetailUpdatedAt, 'string');
      assert.equal('id' in linkedDetailResponse.payload.importCandidate, false);
      assert.equal('username' in linkedDetailResponse.payload.importCandidate, false);
      assert.equal('folderPath' in linkedDetailResponse.payload.importCandidate, false);
      assert.equal('normalizedPayload' in linkedDetailResponse.payload.importCandidate, false);

      const hiddenDetailResponse = await targetClient.requestJson(`/api/v1/import-candidates/${unrelatedCandidate.id}`);
      assert.equal(hiddenDetailResponse.response.status, 404);
      assert.equal(hiddenDetailResponse.payload.error.code, 'import_candidate_not_found');

      const unrelatedUser = await createRequesterUser(client, {
        password: 'UnrelatedPass123!',
        username: 'listener-unrelated',
      });
      assert.ok(unrelatedUser.id);
      const unrelatedClient = createSessionHttpClient(baseUrl, {
        requestTimeoutMs: integrationRuntimeConfig.httpRequestTimeoutMs,
      });
      const unrelatedLoginResponse = await loginWithPassword(unrelatedClient, {
        password: 'UnrelatedPass123!',
        username: 'listener-unrelated',
      });
      assert.equal(unrelatedLoginResponse.response.status, 200);

      const hiddenPipelineResponse = await unrelatedClient.requestJson(
        `/api/v1/library/media-requests/${mediaRequest.id}/pipeline`,
      );
      assert.equal(hiddenPipelineResponse.response.status, 404);
      assert.equal(hiddenPipelineResponse.payload.error.code, 'media_request_not_found');
    }, {
      scenarioName: 'delegated_media_request_visibility',
    });
  });

  test('release media requests detect already existing local metadata through structured artist and release matching', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      const bootstrapResponse = await bootstrapAdminSession(client);
      assert.equal(bootstrapResponse.response.status, 201);

      const pool = getPoolFn();
      const metadataFixture = await seedMetadataReleaseFixture({ queryable: pool });
      await pool.query(
        `
          INSERT INTO library_release_reconciliations (
            metadata_artist_id,
            metadata_release_group_id,
            metadata_release_id,
            reconciliation_status,
            expected_track_count,
            matched_track_count,
            missing_track_count,
            matched_file_count,
            duplicate_track_count,
            evidence
          )
          VALUES ($1, $2, $3, 'complete', 1, 1, 0, 1, 0, $4::jsonb)
        `,
        [
          metadataFixture.metadataArtistId,
          metadataFixture.metadataReleaseGroupId,
          metadataFixture.metadataReleaseId,
          JSON.stringify({ source: 'integration-test' }),
        ],
      );

      const response = await client.requestJson('/api/v1/library/media-requests', {
        csrf: true,
        json: {
          artistName: 'Autechre',
          releaseTitle: 'Amber',
          requestKind: 'release',
        },
        method: 'POST',
      });

      assert.equal(response.response.status, 201);
      assert.equal(response.payload.mediaRequest.requestState, 'already_exists');
      assert.equal(response.payload.mediaRequest.existingMatch.releaseId, metadataFixture.metadataReleaseId);
      assert.equal(response.payload.mediaRequest.existingMatch.releaseGroupId, metadataFixture.metadataReleaseGroupId);
      assert.equal(response.payload.mediaRequest.evidence.localReleaseMatchStrategy, 'structured_artist_title');
      assert.equal(response.payload.mediaRequest.evidence.releaseAvailabilityStatus, 'complete');
    }, {
      scenarioName: 'structured_local_media_request_match',
    });
  });
});
