/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import {
  installMetadataBrowserFixtures,
  readMetadataBrowserFixtureState,
  seedMetadataMediaRequestEvents,
  seedMetadataMediaRequestPipeline,
  updateMetadataMediaRequest,
} from '../../testing/browser/metadata-browser-fixtures.js';
import {
  bootstrapAdminThroughUi,
  logoutThroughUi,
} from '../../testing/browser/operator-browser-helpers.js';
import {
  createRequesterThroughApi,
  loginRequesterThroughUi,
} from '../../testing/browser/user-browser-helpers.js';
import {
  openRequestConfirmationFromCard,
  searchCatalogReleases,
} from '../../testing/browser/request-action-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

async function createRequesterRequest({ baseUrl, browserContext, page, scenarioName }) {
  await installMetadataBrowserFixtures(browserContext);
  await bootstrapAdminThroughUi(page, { baseUrl });
  const username = `listener${scenarioName}`;
  await createRequesterThroughApi(page, {
    password: 'RequesterPass123!',
    username,
  });
  await logoutThroughUi(page);
  await loginRequesterThroughUi(page, {
    baseUrl,
    initialPassword: 'RequesterPass123!',
    readyPassword: 'RequesterReady123!',
    username,
  });

  const releasesList = await searchCatalogReleases(page, baseUrl, 'fixture electronic');
  const confirmRequestDialog = await openRequestConfirmationFromCard(
    page,
    releasesList,
    'Music Has the Right to Children',
  );
  await confirmRequestDialog.getByRole('button', { name: 'Confirm request' }).press('Enter');
  await confirmRequestDialog.waitFor({ state: 'hidden' });

  const fixtureState = await readMetadataBrowserFixtureState(page);
  assert.equal(fixtureState.mediaRequests.length, 1);

  return {
    requestId: fixtureState.mediaRequests[0].id,
  };
}

suite('Request Detail fulfillment pipeline event/status parity browser verification', () => {
  before(async () => {
    try {
      browserRuntime = await createBrowserSmokeRuntime({
        config: integrationRuntimeConfig,
      });
      runtimeUnavailableReason = null;
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) {
        throw error;
      }

      runtimeUnavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, {
    timeout: integrationRuntimeConfig.suiteSetupTimeoutMs,
  });

  after(async () => {
    await browserRuntime?.cleanup();
  }, {
    timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs,
  });

  test('requester detail keeps fulfillment stat, journey, pipeline, and events aligned', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });

      const { requestId } = await createRequesterRequest({
        baseUrl,
        browserContext,
        page,
        scenarioName: 'pipelineparity',
      });

      await updateMetadataMediaRequest(page, requestId, {
        fulfillmentStatus: {
          code: 'import_pending',
          detail: 'Download complete; waiting to be imported.',
          label: 'Import pending',
          occurredAt: '2026-06-25T17:04:00.000Z',
          tone: 'held',
        },
        requestState: 'needs_review',
      });
      await seedMetadataMediaRequestPipeline(page, requestId, {
        candidates: [
          {
            apply: null,
            candidateType: 'manual_search',
            execution: {
              finishedAt: '2026-06-25T17:03:00.000Z',
              importCandidateId: 'candidate-private',
              itemStatus: 'completed',
              operationRunId: 'run-private',
              runErrorMessage: '/private/staging/Boards of Canada/private-track.flac failed earlier',
              runStatus: 'completed',
              startedAt: '2026-06-25T17:01:00.000Z',
              statusMessage: 'Downloading from remote-peer',
            },
            fileCount: 12,
            folderPath: '/private/staging/Boards of Canada/Music Has the Right to Children',
            id: 'candidate-private',
            status: 'import_pending',
            totalSizeBytes: 104857600,
            transferProgress: {
              observedAt: '2026-06-25T17:03:00.000Z',
              percentComplete: 100,
              status: 'completed',
            },
            username: 'remote-peer',
          },
        ],
      });
      await seedMetadataMediaRequestEvents(page, requestId, {
        events: [
          {
            eventType: 'import_pending',
            id: 'fixture-event-import-pending',
            occurredAt: '2026-06-25T17:04:00.000Z',
          },
          {
            eventType: 'download_completed',
            id: 'fixture-event-download-completed',
            occurredAt: '2026-06-25T17:03:00.000Z',
          },
          {
            eventType: 'fulfillment_started',
            id: 'fixture-event-fulfillment-started',
            occurredAt: '2026-06-25T17:01:00.000Z',
          },
        ],
      });

      await page.goto(`${baseUrl}/app/requests/${requestId}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', {
        exact: true,
        name: 'Boards of Canada \u2014 Music Has the Right to Children',
      }).waitFor();

      const fulfillmentStat = page.locator('.hx-stat-card').filter({ hasText: 'Fulfillment' });
      await page.getByText('Import pending', { exact: true }).first().waitFor();
      await fulfillmentStat.getByText('Download complete; waiting to be imported.', { exact: true }).waitFor();

      const journey = page.getByRole('list', { name: 'Request journey' });
      await journey.getByText('Finding sources').waitFor();
      await journey.getByText('Source candidates were found.', { exact: true }).waitFor();
      await journey.getByText('Downloading').waitFor();
      await journey.getByText('Download finished.', { exact: true }).waitFor();
      await journey.getByText('Importing').waitFor();
      await journey.getByText('Download complete; waiting to be imported.', { exact: true }).waitFor();

      const pipeline = page.getByRole('list', { name: 'Linked import candidates' });
      await pipeline.waitFor();
      assert.equal(await pipeline.getByRole('listitem').count(), 1);
      const candidate = pipeline.getByRole('listitem').first();
      const candidateSummary = candidate.locator('summary');
      await candidateSummary.getByText('Import pending', { exact: true }).waitFor();
      await candidateSummary.getByText('Source 1', { exact: true }).waitFor();
      await candidateSummary.getByText('12 files, 100.0 MB', { exact: true }).waitFor();
      await candidateSummary.getByText('Source 1', { exact: true }).click();
      const candidateSteps = candidate.locator('.rdl-pipeline-steps');
      await candidate.getByText('Downloaded', { exact: true }).waitFor();
      await candidateSteps.getByText('Import pending', { exact: true }).waitFor();
      const candidateRunDetails = candidate.locator('dl');
      await candidateRunDetails.getByText('Download', { exact: true }).waitFor();
      await candidateRunDetails.getByText('Completed', { exact: true }).waitFor();

      const eventHistory = page.getByRole('list', { name: 'Request event history' });
      await eventHistory.getByText('Import Pending', { exact: true }).waitFor();
      await eventHistory.getByText('Download complete; waiting to import files', { exact: true }).waitFor();
      await eventHistory.getByText('Download Completed', { exact: true }).waitFor();
      await eventHistory.getByText('Download completed for this request', { exact: true }).waitFor();
      await eventHistory.getByText('Fulfillment Started', { exact: true }).waitFor();
      await eventHistory.getByText('Fulfillment started for this request', { exact: true }).waitFor();

      assert.equal(await page.getByRole('link', { name: 'Open in import review' }).count(), 0);
      assert.equal(await page.getByText('remote-peer').count(), 0);
      assert.equal(await page.getByText('/private/staging').count(), 0);
      assert.equal(await page.getByText('candidate-private').count(), 0);
      assert.equal(await page.getByText('run-private').count(), 0);
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'request_detail_pipeline_parity',
    });
  });
});
