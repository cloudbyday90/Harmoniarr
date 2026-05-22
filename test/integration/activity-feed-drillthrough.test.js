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
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { seedOperationRunFixture } from '../../testing/integration/operation-run-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import {
  isSkippableIntegrationRuntimeError,
  toIntegrationRuntimeUnavailableReason,
} from '../../testing/integration/runtime-availability.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
let integrationRuntime;
let runtimeUnavailableReason = null;

suite('activity feed drillthrough integration', () => {
  before(async () => {
    try {
      integrationRuntime = await createIntegrationAppRuntime({
        config: integrationRuntimeConfig,
      });
    } catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      runtimeUnavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: integrationRuntimeConfig.suiteSetupTimeoutMs });

  after(async () => {
    await integrationRuntime?.cleanup();
  }, { timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs });

  test('activity feed returns release_added events with shared presentation contract and source metadata', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      const pool = getPoolFn();
      await bootstrapAdminSession(client);

      const { id: runId } = await seedOperationRunFixture({
        queryable: pool,
        runOverrides: {
          operationType: 'library_organize_apply',
          status: 'completed',
          summary: { movedCount: 12, releaseCount: 1 },
        },
      });

      const eventPayload = {
        schemaVersion: 1,
        presentationType: 'release_added',
        primaryRelease: { artistName: 'Radiohead', releaseTitle: 'OK Computer' },
        releaseCount: 1,
        releases: [{ artistName: 'Radiohead', releaseTitle: 'OK Computer' }],
        movedCount: 12,
        source: {
          operationType: 'library_organize_apply',
          runId,
        },
      };

      await pool.query(
        `INSERT INTO activity_events
           (event_type, entity_type, entity_title, entity_artist, extra_payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'release_added',
          'release',
          'OK Computer',
          'Radiohead',
          JSON.stringify(eventPayload),
        ],
      );

      const { payload } = await client.requestJson('/api/v1/activity/feed');

      assert.equal(payload.ok, true);
      assert.ok(payload.events.length >= 1);

      const releaseEvent = payload.events.find(
        (e) => e.eventType === 'release_added' && e.entityTitle === 'OK Computer',
      );

      assert.ok(releaseEvent, 'release_added event should be present in feed');
      assert.equal(releaseEvent.entityArtist, 'Radiohead');
      assert.ok(releaseEvent.extraPayload);
      assert.equal(releaseEvent.extraPayload.schemaVersion, 1);
      assert.equal(releaseEvent.extraPayload.presentationType, 'release_added');
      assert.equal(releaseEvent.extraPayload.releaseCount, 1);
      assert.equal(releaseEvent.extraPayload.primaryRelease.artistName, 'Radiohead');
      assert.equal(releaseEvent.extraPayload.primaryRelease.releaseTitle, 'OK Computer');
      assert.equal(releaseEvent.extraPayload.source.operationType, 'library_organize_apply');
      assert.equal(releaseEvent.extraPayload.source.runId, runId);
    }, { scenarioName: 'activity_feed_presentation_contract' });
  });

  test('activity feed returns release_added events with import_candidate_apply source metadata', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      const pool = getPoolFn();
      await bootstrapAdminSession(client);

      const { id: runId } = await seedOperationRunFixture({
        queryable: pool,
        runOverrides: {
          operationType: 'import_candidate_apply',
          status: 'completed',
          summary: { appliedCount: 1 },
        },
      });

      const eventPayload = {
        schemaVersion: 1,
        presentationType: 'release_added',
        primaryRelease: { artistName: 'Aphex Twin', releaseTitle: 'Selected Ambient Works 85-92' },
        releaseCount: 1,
        releases: [{ artistName: 'Aphex Twin', releaseTitle: 'Selected Ambient Works 85-92' }],
        movedCount: 14,
        source: {
          operationType: 'import_candidate_apply',
          runId,
        },
      };

      await pool.query(
        `INSERT INTO activity_events
           (event_type, entity_type, entity_title, entity_artist, extra_payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'release_added',
          'release',
          'Selected Ambient Works 85-92',
          'Aphex Twin',
          JSON.stringify(eventPayload),
        ],
      );

      const { payload } = await client.requestJson('/api/v1/activity/feed');

      const releaseEvent = payload.events.find(
        (e) => e.eventType === 'release_added' && e.entityArtist === 'Aphex Twin',
      );

      assert.ok(releaseEvent, 'import apply release event should be present');
      assert.equal(releaseEvent.extraPayload.source.operationType, 'import_candidate_apply');
      assert.equal(releaseEvent.extraPayload.source.runId, runId);
    }, { scenarioName: 'activity_feed_import_apply_source' });
  });

  test('activity feed returns release_added events with legacy format and no source metadata', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      const pool = getPoolFn();
      await bootstrapAdminSession(client);

      await pool.query(
        `INSERT INTO activity_events
           (event_type, entity_type, entity_title, entity_artist, extra_payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'release_added',
          'release',
          'Kid A',
          'Radiohead',
          null,
        ],
      );

      const { payload } = await client.requestJson('/api/v1/activity/feed');

      const releaseEvent = payload.events.find(
        (e) => e.eventType === 'release_added' && e.entityTitle === 'Kid A',
      );

      assert.ok(releaseEvent, 'legacy release event should be present');
      assert.equal(releaseEvent.entityTitle, 'Kid A');
      assert.equal(releaseEvent.entityArtist, 'Radiohead');
      assert.equal(releaseEvent.extraPayload, null);
    }, { scenarioName: 'activity_feed_legacy_format' });
  });

  test('activity feed returns multi-release events with multiple release summaries', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      const pool = getPoolFn();
      await bootstrapAdminSession(client);

      const { id: runId } = await seedOperationRunFixture({
        queryable: pool,
        runOverrides: {
          operationType: 'library_organize_apply',
          status: 'completed',
        },
      });

      const eventPayload = {
        schemaVersion: 1,
        presentationType: 'release_added',
        primaryRelease: null,
        releaseCount: 2,
        releases: [
          { artistName: 'Radiohead', releaseTitle: 'OK Computer' },
          { artistName: 'Radiohead', releaseTitle: 'Kid A' },
        ],
        movedCount: 24,
        source: {
          operationType: 'library_organize_apply',
          runId,
        },
      };

      await pool.query(
        `INSERT INTO activity_events
           (event_type, entity_type, entity_title, entity_artist, extra_payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'release_added',
          'release',
          '2 releases',
          null,
          JSON.stringify(eventPayload),
        ],
      );

      const { payload } = await client.requestJson('/api/v1/activity/feed');

      const multiReleaseEvent = payload.events.find(
        (e) => e.eventType === 'release_added' && e.entityTitle === '2 releases',
      );

      assert.ok(multiReleaseEvent, 'multi-release event should be present');
      assert.equal(multiReleaseEvent.extraPayload.releaseCount, 2);
      assert.equal(multiReleaseEvent.extraPayload.releases.length, 2);
      assert.equal(multiReleaseEvent.extraPayload.source.operationType, 'library_organize_apply');
      assert.equal(multiReleaseEvent.extraPayload.source.runId, runId);
    }, { scenarioName: 'activity_feed_multi_release' });
  });

  test('operation run referenced in source metadata can be fetched', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) { t.skip(runtimeUnavailableReason); return; }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      const pool = getPoolFn();
      await bootstrapAdminSession(client);

      const { id: runId } = await seedOperationRunFixture({
        queryable: pool,
        runOverrides: {
          operationType: 'library_organize_apply',
          status: 'completed',
          summary: { movedCount: 12 },
        },
      });

      const eventPayload = {
        schemaVersion: 1,
        presentationType: 'release_added',
        primaryRelease: { artistName: 'Radiohead', releaseTitle: 'OK Computer' },
        releaseCount: 1,
        releases: [{ artistName: 'Radiohead', releaseTitle: 'OK Computer' }],
        movedCount: 12,
        source: { operationType: 'library_organize_apply', runId },
      };

      await pool.query(
        `INSERT INTO activity_events
           (event_type, entity_type, entity_title, entity_artist, extra_payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'release_added',
          'release',
          'OK Computer',
          'Radiohead',
          JSON.stringify(eventPayload),
        ],
      );

      const { payload: feed } = await client.requestJson('/api/v1/activity/feed');
      const releaseEvent = feed.events.find((e) => e.eventType === 'release_added');

      assert.ok(releaseEvent);
      const sourceRunId = releaseEvent.extraPayload.source.runId;
      assert.equal(sourceRunId, runId);

      const csrfResponse = await client.requestJson('/api/v1/auth/session', { method: 'GET' });
      const csrfToken = csrfResponse.payload?.csrfToken ?? csrfResponse.payload?.csrf;

      const { payload: runDetail } = await client.requestJson(
        `/api/v1/operations/runs/${sourceRunId}`,
        {
          headers: { 'x-csrf-token': csrfToken },
          method: 'GET',
        },
      );

      assert.ok(runDetail);
      assert.equal(runDetail.operationRun.run.operationType, 'library_organize_apply');
      assert.equal(runDetail.operationRun.run.status, 'completed');
    }, { scenarioName: 'activity_feed_drillthrough_run_fetch' });
  });
}, { timeout: integrationRuntimeConfig.suiteSetupTimeoutMs });
