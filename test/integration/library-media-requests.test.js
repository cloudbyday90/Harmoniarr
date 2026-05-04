import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession, loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { seedImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
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

      const visibleImportCandidatesResponse = await targetClient.requestJson('/api/v1/import-candidates?status=downloading&limit=10');
      assert.equal(visibleImportCandidatesResponse.response.status, 200);
      assert.equal(visibleImportCandidatesResponse.payload.importCandidates.pagination.total, 1);
      assert.equal(visibleImportCandidatesResponse.payload.importCandidates.candidates[0].id, linkedCandidate.id);

      const linkedDetailResponse = await targetClient.requestJson(`/api/v1/import-candidates/${linkedCandidate.id}`);
      assert.equal(linkedDetailResponse.response.status, 200);
      assert.equal(linkedDetailResponse.payload.importCandidate.id, linkedCandidate.id);
      assert.equal(
        linkedDetailResponse.payload.importCandidate.normalizedPayload.requestOwnership.sourceRequestedForUserId,
        targetUser.id,
      );

      const hiddenDetailResponse = await targetClient.requestJson(`/api/v1/import-candidates/${unrelatedCandidate.id}`);
      assert.equal(hiddenDetailResponse.response.status, 404);
      assert.equal(hiddenDetailResponse.payload.error.code, 'import_candidate_not_found');
    }, {
      scenarioName: 'delegated_media_request_visibility',
    });
  });
});