/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createImportCandidateApplyRunStore } from '../../src/server/import-candidates/import-candidate-apply-run-store.js';
import { createImportCandidateMediaInspectionRunStore } from '../../src/server/import-candidates/import-candidate-media-inspection-run-store.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { operationRunRegistry } from '../../src/shared/operation-run-descriptors.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { seedImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import {
  isSkippableIntegrationRuntimeError,
  toIntegrationRuntimeUnavailableReason,
} from '../../testing/integration/runtime-availability.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
let integrationRuntime;
let runtimeUnavailableReason = null;

suite('integration import apply and media inspection operations', () => {
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

  test('import apply run store lifecycle creates, claims, and completes a run visible through operation history', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      const bootstrapResponse = await bootstrapAdminSession(client);
      const adminUserId = bootstrapResponse.payload.user.id;

      const applyRunStore = createImportCandidateApplyRunStore({ getPoolFn });
      const queueStore = createOperationQueueStore({
        claimOwnerInstanceId: 'integration-apply-worker',
        getPoolFn,
      });

      const createdRun = await applyRunStore.createOperationRun({
        requestedCandidateCount: 2,
        triggeredByUserId: adminUserId,
      });

      assert.ok(createdRun?.id);
      assert.equal(createdRun.status, 'pending');

      const claimedRun = await queueStore.claimNextRunnableRun({
        operationTypes: [operationRunRegistry.importCandidateApply.operationType],
      });

      assert.equal(claimedRun?.id, createdRun.id);
      assert.equal(claimedRun?.attemptCount, 1);
      assert.equal(claimedRun?.status, 'pending');
      assert.ok(claimedRun?.claimedAt);
      assert.equal(claimedRun?.claimedByInstanceId, 'integration-apply-worker');

      await applyRunStore.markRunStarted({
        runId: createdRun.id,
        summary: {
          currentStep: 'Resolving import-pending candidate apply plans',
          executionMode: 'move',
          executableCandidateCount: 1,
          requestedCandidateCount: 2,
        },
      });

      await applyRunStore.acquireLease({ runId: createdRun.id });

      const historyResponse = await client.requestJson('/api/v1/operations/history', {
        method: 'GET',
      });

      assert.equal(historyResponse.response.status, 200);
      const matchingRun = historyResponse.payload.runs.find(
        (run) => run.id === createdRun.id,
      );
      assert.ok(matchingRun, 'apply run should appear in operation history');
      assert.equal(matchingRun.status, 'running');
      assert.equal(matchingRun.operationType, operationRunRegistry.importCandidateApply.operationType);

      const runDetailResponse = await client.requestJson(
        `/api/v1/operations/runs/${createdRun.id}`,
        { method: 'GET' },
      );

      assert.equal(runDetailResponse.response.status, 200);
      assert.equal(runDetailResponse.payload.operationRun.run.status, 'running');
      assert.equal(runDetailResponse.payload.operationRun.run.operationType, operationRunRegistry.importCandidateApply.operationType);

      const runLease = await applyRunStore.getLease({ runId: createdRun.id });
      assert.ok(runLease, 'running apply run should have an active lease');

      await applyRunStore.markRunCompleted({
        runId: createdRun.id,
        summary: {
          appliedCount: 1,
          appliedWithWarningsCount: 0,
          applyFailedCount: 0,
          blockedCount: 1,
          currentStep: 'Import apply complete',
          executionMode: 'move',
          processedCandidateCount: 2,
          readyCount: 1,
          readyWithWarningsCount: 0,
          requestedCandidateCount: 2,
          totalImportPending: 2,
        },
      });

      await applyRunStore.releaseLease({ runId: createdRun.id, status: 'completed' });

      const completedRun = await applyRunStore.getRunById(createdRun.id);
      assert.equal(completedRun.status, 'completed');
      assert.ok(completedRun.finishedAt);

      const applySummaryResponse = await client.requestJson(
        '/api/v1/import-candidates/apply-summary',
        { method: 'GET' },
      );

      assert.equal(applySummaryResponse.response.status, 200);

      const applyRunDetailResponse = await client.requestJson(
        `/api/v1/import-candidates/apply-runs/${createdRun.id}`,
        { method: 'GET' },
      );

      assert.equal(applyRunDetailResponse.response.status, 200);
      assert.equal(applyRunDetailResponse.payload.summary.appliedCount, 1);
      assert.equal(applyRunDetailResponse.payload.summary.requestedCandidateCount, 2);
    }, {
      scenarioName: 'import_apply_run_lifecycle',
    });
  });

  test('media inspection run start route creates a queued run visible through operation history', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      await bootstrapAdminSession(client);

      await seedImportCandidateFixture({
        candidateOverrides: {
          sourceSearchId: 'inspection-search-1',
          status: 'selected',
        },
        queryable: getPoolFn(),
      });

      const startResponse = await client.requestJson('/api/v1/import-candidates/media-inspection-runs', {
        csrf: true,
        method: 'POST',
      });

      assert.equal(startResponse.response.status, 202);
      assert.equal(startResponse.payload.ok, true);
      assert.ok(startResponse.payload.operationRun?.id);
      assert.equal(startResponse.payload.operationRun.status, 'pending');

      const createdRunId = startResponse.payload.operationRun.id;

      const inspectionRunStore = createImportCandidateMediaInspectionRunStore({ getPoolFn });

      await inspectionRunStore.markRunStarted({
        runId: createdRunId,
        summary: {
          currentStep: 'Inspecting selected import candidate media',
          requestedCandidateCount: 1,
        },
      });

      await inspectionRunStore.acquireLease({ runId: createdRunId });

      const historyResponse = await client.requestJson('/api/v1/operations/history', {
        method: 'GET',
      });

      assert.equal(historyResponse.response.status, 200);
      const matchingRun = historyResponse.payload.runs.find(
        (run) => run.id === createdRunId,
      );
      assert.ok(matchingRun, 'media inspection run should appear in operation history');
      assert.equal(matchingRun.operationType, operationRunRegistry.importCandidateMediaInspection.operationType);

      const runDetailResponse = await client.requestJson(
        `/api/v1/operations/runs/${createdRunId}`,
        { method: 'GET' },
      );

      assert.equal(runDetailResponse.response.status, 200);
      assert.ok(runDetailResponse.payload.operationRun?.auditEvents);
      assert.ok(
        runDetailResponse.payload.operationRun.auditEvents.some(
          (event) => event.eventType === operationRunRegistry.importCandidateMediaInspection.startedEventType,
        ),
        'audit trail should include media inspection started event',
      );

      const runLease = await inspectionRunStore.getLease({ runId: createdRunId });
      assert.ok(runLease, 'running media inspection run should have an active lease');
      assert.equal(runLease.ownerInstanceId, process.env.HARMONIARR_INSTANCE_ID ?? `pid:${process.pid}`);

      const inspectionSummaryResponse = await client.requestJson(
        '/api/v1/import-candidates/media-inspection-summary',
        { method: 'GET' },
      );

      assert.equal(inspectionSummaryResponse.response.status, 200);
    }, {
      scenarioName: 'media_inspection_run_lifecycle',
    });
  });
});
