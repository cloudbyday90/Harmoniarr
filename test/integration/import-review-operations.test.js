import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createImportCandidateExecutionRunStore } from '../../src/server/import-candidates/import-candidate-execution-run-store.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { seedImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { acquireIntegrationLock } from '../../testing/integration/recovery-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import {
  isSkippableIntegrationRuntimeError,
  toIntegrationRuntimeUnavailableReason,
} from '../../testing/integration/runtime-availability.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
let integrationRuntime;
let runtimeUnavailableReason = null;

suite('integration import review and operations routes', () => {
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

  test('import review routes persist list, detail, and status transitions against real database state', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      await bootstrapAdminSession(client);

      const storedCandidate = await seedImportCandidateFixture({
        candidateOverrides: {
          sourceSearchId: 'review-search-1',
          status: 'pending',
        },
        queryable: getPoolFn(),
      });

      const initialList = await client.requestJson('/api/v1/import-candidates?status=pending&limit=10');
      assert.equal(initialList.response.status, 200);
      assert.equal(initialList.payload.importCandidates.pagination.total, 1);
      assert.equal(initialList.payload.importCandidates.candidates[0].id, storedCandidate.id);
      assert.equal(initialList.payload.importCandidates.candidates[0].status, 'pending');

      const detailResponse = await client.requestJson(`/api/v1/import-candidates/${storedCandidate.id}`);
      assert.equal(detailResponse.response.status, 200);
      assert.equal(detailResponse.payload.importCandidate.id, storedCandidate.id);
      assert.equal(detailResponse.payload.importCandidate.files.length, 1);
      assert.equal(detailResponse.payload.importCandidate.files[0].filename, '01 Foil.flac');

      const holdResponse = await client.requestJson(`/api/v1/import-candidates/${storedCandidate.id}/hold`, {
        csrf: true,
        json: {
          reason: 'Needs operator review',
        },
        method: 'POST',
      });
      assert.equal(holdResponse.response.status, 200);
      assert.equal(holdResponse.payload.review.candidate.status, 'held');
      assert.equal(holdResponse.payload.review.event.eventType, 'import_candidate_held');

      const selectResponse = await client.requestJson(`/api/v1/import-candidates/${storedCandidate.id}/select`, {
        csrf: true,
        json: {
          reason: 'Queue this release',
        },
        method: 'POST',
      });
      assert.equal(selectResponse.response.status, 200);
      assert.equal(selectResponse.payload.review.candidate.status, 'selected');
      assert.equal(selectResponse.payload.review.event.eventType, 'import_candidate_selected');

      const rejectResponse = await client.requestJson(`/api/v1/import-candidates/${storedCandidate.id}/reject`, {
        csrf: true,
        json: {
          reason: 'Wrong mastering',
        },
        method: 'POST',
      });
      assert.equal(rejectResponse.response.status, 200);
      assert.equal(rejectResponse.payload.review.candidate.status, 'rejected');
      assert.equal(rejectResponse.payload.review.event.eventType, 'import_candidate_rejected');

      const reopenResponse = await client.requestJson(`/api/v1/import-candidates/${storedCandidate.id}/reopen`, {
        csrf: true,
        json: {
          reason: 'Retry from review queue',
        },
        method: 'POST',
      });
      assert.equal(reopenResponse.response.status, 200);
      assert.equal(reopenResponse.payload.review.candidate.status, 'pending');
      assert.equal(reopenResponse.payload.review.event.eventType, 'import_candidate_reopened');

      const persistedCandidateRows = await getPoolFn().query(
        `
          SELECT status
          FROM import_candidates
          WHERE id = $1
        `,
        [storedCandidate.id],
      );
      assert.equal(persistedCandidateRows.rows[0]?.status, 'pending');

      const persistedEventRows = await getPoolFn().query(
        `
          SELECT event_type, previous_status, new_status, reason
          FROM import_candidate_events
          WHERE import_candidate_id = $1
          ORDER BY occurred_at ASC, created_at ASC
        `,
        [storedCandidate.id],
      );
      assert.deepEqual(
        persistedEventRows.rows.map((row) => ({
          eventType: row.event_type,
          newStatus: row.new_status,
          previousStatus: row.previous_status,
          reason: row.reason,
        })),
        [
          {
            eventType: 'import_candidate_held',
            newStatus: 'held',
            previousStatus: 'pending',
            reason: 'Needs operator review',
          },
          {
            eventType: 'import_candidate_selected',
            newStatus: 'selected',
            previousStatus: 'held',
            reason: 'Queue this release',
          },
          {
            eventType: 'import_candidate_rejected',
            newStatus: 'rejected',
            previousStatus: 'selected',
            reason: 'Wrong mastering',
          },
          {
            eventType: 'import_candidate_reopened',
            newStatus: 'pending',
            previousStatus: 'rejected',
            reason: 'Retry from review queue',
          },
        ],
      );
    }, {
      scenarioName: 'import_review_transitions',
    });
  });

  test('execution planning runs appear in operation history with attached worker lease ownership', {
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
          sourceSearchId: 'execution-search-1',
          status: 'selected',
        },
        queryable: getPoolFn(),
      });

      const runStartResponse = await client.requestJson('/api/v1/import-candidates/execution-runs', {
        csrf: true,
        method: 'POST',
      });
      assert.equal(runStartResponse.response.status, 202);
      assert.equal(runStartResponse.payload.accepted, true);

      const runId = runStartResponse.payload.run.id;
      const executionRunStore = createImportCandidateExecutionRunStore({
        getPoolFn,
      });
      await executionRunStore.markRunStarted({
        runId,
        summary: {
          currentStep: 'integration worker claimed execution planning run',
          requestedCandidateCount: 1,
        },
      });
      const lease = await executionRunStore.acquireLease({ runId });

      const historyResponse = await client.requestJson('/api/v1/operations/history?limit=5');
      assert.equal(historyResponse.response.status, 200);
      const executionRun = historyResponse.payload.runs.find((run) => run.id === runId);
      assert.ok(executionRun);
      assert.equal(executionRun.operationType, 'import_candidate_execution_planning');
      assert.equal(executionRun.status, 'running');
      assert.equal(executionRun.summary.currentStep, 'integration worker claimed execution planning run');
      assert.equal(executionRun.lease.leaseKey, lease.leaseKey);
      assert.equal(executionRun.lease.ownerInstanceId, lease.ownerInstanceId);
      assert.equal(executionRun.lease.state, 'active');

      const runDetailResponse = await client.requestJson(`/api/v1/operations/runs/${runId}`);
      assert.equal(runDetailResponse.response.status, 200);
      assert.equal(runDetailResponse.payload.operationRun.run.id, runId);
      assert.equal(runDetailResponse.payload.operationRun.run.lease.ownerInstanceId, lease.ownerInstanceId);
      assert.equal(runDetailResponse.payload.operationRun.run.lease.status, 'active');

      const auditEventTypes = runDetailResponse.payload.operationRun.auditEvents.map((event) => event.eventType);
      assert.equal(auditEventTypes.includes('import_candidate_execution_started'), true);
    }, {
      scenarioName: 'execution_operation_history',
    });
  });

  test('maintenance locks block import execution, apply, media inspection, and transcode run starts consistently', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      await bootstrapAdminSession(client);

      await acquireIntegrationLock(getPoolFn(), {
        lockType: 'restore',
        reason: 'Pause unsafe import workflow writes',
      });

      const executionResponse = await client.requestJson('/api/v1/import-candidates/execution-runs', {
        csrf: true,
        method: 'POST',
      });
      const applyResponse = await client.requestJson('/api/v1/import-candidates/apply-runs', {
        csrf: true,
        method: 'POST',
      });
      const inspectionResponse = await client.requestJson('/api/v1/import-candidates/media-inspection-runs', {
        csrf: true,
        method: 'POST',
      });
      const transcodeResponse = await client.requestJson('/api/v1/import-candidates/transcode-runs', {
        csrf: true,
        method: 'POST',
      });

      for (const response of [
        executionResponse,
        applyResponse,
        inspectionResponse,
        transcodeResponse,
      ]) {
        assert.equal(response.response.status, 409);
        assert.equal(response.payload.error.code, 'recovery_lock_conflict');
      }

      assert.match(executionResponse.payload.error.message, /prevents import candidate execution planning/i);
      assert.match(applyResponse.payload.error.message, /prevents import candidate apply/i);
      assert.match(inspectionResponse.payload.error.message, /prevents import candidate media inspection/i);
      assert.match(transcodeResponse.payload.error.message, /prevents import candidate transcode orchestration/i);
    }, {
      scenarioName: 'maintenance_lock_import_run_guards',
    });
  });
});
