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
  markBoardsOfCanadaAddedInMetadataBrowserFixture,
} from '../../testing/browser/metadata-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailableReason;

async function navigateWithinArtistView(page, artistId) {
  await page.evaluate((id) => {
    // Exercise Vue Router without replacing the document or losing pending fetches.
    globalThis.history.pushState({}, '', `/app/artists/${id}`);
    globalThis.dispatchEvent(new globalThis.PopStateEvent('popstate', { state: {} }));
  }, artistId);
}

suite('Artist mutation lifecycle browser verification', () => {
  before(async () => {
    try {
      runtime = await createBrowserSmokeRuntime({ config });
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) throw error;
      unavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });

  after(async () => runtime?.cleanup(), { timeout: config.suiteTeardownTimeoutMs });

  test('a delayed save cannot replace a new draft after leaving and returning to the same artist', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) return t.skip(unavailableReason);
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await markBoardsOfCanadaAddedInMetadataBrowserFixture(page);
      await page.goto(`${baseUrl}/app/artists/mb-artist-boards`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Boards of Canada', exact: true }).waitFor();

      await page.evaluate(() => {
        const originalFetch = globalThis.fetch.bind(globalThis);
        globalThis.artistSaveLifecycle = { submitted: false, released: false };
        globalThis.fetch = async (input, init) => {
          const url = new URL(typeof input === 'string' ? input : input.url, globalThis.location.href);
          if (url.pathname === '/api/v1/metadata/artists/metadata-artist-boards/operator'
            && (init?.method ?? input?.method ?? 'GET').toUpperCase() === 'PUT') {
            // Persist the fixture immediately, but hold the response. A new page
            // generation can read that saved state while the old caller still waits.
            const response = await originalFetch(input, init);
            globalThis.artistSaveLifecycle.submitted = true;
            await new Promise((resolve) => { globalThis.releaseArtistSaveResponse = resolve; });
            globalThis.artistSaveLifecycle.released = true;
            return response;
          }
          return originalFetch(input, init);
        };
      });

      const releaseScope = page.getByLabel(/Release scope/u);
      const initialScope = await releaseScope.inputValue();
      const changedScope = await releaseScope.locator('option').evaluateAll((options, current) => (
        options.find((option) => option.value !== current).value
      ), initialScope);
      await releaseScope.selectOption(changedScope);
      await page.getByRole('button', { name: 'Save policy', exact: true }).click();
      await page.waitForFunction(() => globalThis.artistSaveLifecycle.submitted);
      await page.getByRole('button', { name: 'Saving...', exact: true }).waitFor();

      await navigateWithinArtistView(page, 'mb-artist-autechre');
      await page.getByRole('heading', { name: 'Autechre', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Saving...', exact: true }).count(), 0);
      await navigateWithinArtistView(page, 'mb-artist-boards');
      await page.getByRole('heading', { name: 'Boards of Canada', exact: true }).waitFor();
      await releaseScope.waitFor();
      assert.equal(await releaseScope.inputValue(), changedScope);
      await releaseScope.selectOption(initialScope);
      await page.getByText('Unsaved changes', { exact: true }).waitFor();

      await page.evaluate(async () => {
        globalThis.releaseArtistSaveResponse();
        // Let the response body, composable continuation, and Vue rendering settle.
        await new Promise((resolve) => {
          globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve));
        });
      });
      assert.equal(await page.evaluate(() => globalThis.artistSaveLifecycle.released), true);
      assert.equal(await releaseScope.inputValue(), initialScope);
      await page.getByText('Unsaved changes', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Save policy', exact: true }).isEnabled(), true);
      assert.equal(await page.getByRole('heading', { name: 'Boards of Canada', exact: true }).count(), 1);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, { scenarioName: 'artist_save_response_preserves_new_navigation_draft' });
  });
  test('a save conflict keeps unsaved policy and its original revision without automatic refresh or retry', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) return t.skip(unavailableReason);
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await markBoardsOfCanadaAddedInMetadataBrowserFixture(page);
      await page.goto(`${baseUrl}/app/artists/mb-artist-boards`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Boards of Canada', exact: true }).waitFor();
      const initialRevision = await page.evaluate(async () => {
        const response = await fetch('/api/v1/metadata/artists/metadata-artist-boards/operator');
        const projection = await response.json();
        return projection.operator.reconciliation.latestSnapshot?.snapshotRevision ?? 0;
      });
      await page.evaluate(() => {
        const originalFetch = globalThis.fetch.bind(globalThis);
        globalThis.artistConflictEvidence = { reads: 0, saves: [] };
        globalThis.fetch = async (input, init) => {
          const url = new URL(typeof input === 'string' ? input : input.url, globalThis.location.href);
          if (url.pathname === '/api/v1/metadata/artists/metadata-artist-boards/operator') {
            if ((init?.method ?? 'GET').toUpperCase() === 'PUT') {
              const body = JSON.parse(init.body);
              globalThis.artistConflictEvidence.saves.push(body);
              return new Response(JSON.stringify({ error: {
                code: 'operator_artist_snapshot_conflict',
                message: `Artist Policy changed since it was loaded: expected snapshot revision ${body.expectedSnapshotRevision}, received ${body.expectedSnapshotRevision + 1}`,
              } }), { status: 409, headers: { 'content-type': 'application/json' } });
            }
            globalThis.artistConflictEvidence.reads += 1;
          }
          return originalFetch(input, init);
        };
      });
      const releaseScope = page.getByLabel(/Release scope/u);
      const initialScope = await releaseScope.inputValue();
      const editedScope = await releaseScope.locator('option').evaluateAll((options, current) => (
        options.find((option) => option.value !== current).value
      ), initialScope);
      await releaseScope.selectOption(editedScope);
      await page.getByRole('button', { name: 'Save policy', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: /reload|review/i }).waitFor();
      await page.getByText('Unsaved changes', { exact: true }).waitFor();
      assert.equal(await releaseScope.inputValue(), editedScope);
      assert.equal(await page.getByRole('button', { name: 'Save policy', exact: true }).isEnabled(), true);
      const evidence = await page.evaluate(() => globalThis.artistConflictEvidence);
      assert.equal(evidence.reads, 0, 'Conflict must not refresh the saved projection over the draft');
      assert.equal(evidence.saves.length, 1, 'Conflict must not automatically resubmit');
      assert.equal(evidence.saves[0].expectedSnapshotRevision, initialRevision);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, { scenarioName: 'artist_save_conflict_keeps_draft' });
  });

});
