/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import assert from 'node:assert/strict';
import { before, after, suite, test } from 'node:test';
import { resolve } from 'node:path';
import { createPreflightReviewFixture } from '../../testing/integration/preflight-review-fixture.js';
import { seedQualityReviewAlternative, seedQualityReviewScanRows } from '../../testing/integration/quality-review-match-fixture.js';
import { advanceBoundedSearch } from '../../testing/integration/bounded-quality-review-search-fixture.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withBrowserSession } from '../../testing/browser/browser-session.js';

const fixture = createPreflightReviewFixture(); const config = resolveIntegrationTestRuntimeConfig(); let runtime;
suite('Search again from measured quality review in Missing Music', () => {
  before(async () => { runtime = await fixture.createRuntime({ clientDistDir: resolve('dist/client') }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('large exhaustion announces checking before queued search and survives reload without enabling duplicate actions', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start(); await seedQualityReviewScanRows(f);
      await withBrowserSession({}, async ({ browserContext }) => {
        await browserContext.addCookies(context.client.getCookieHeader().split(';').filter(Boolean).map(cookie => {
          const [name, ...value] = cookie.trim().split('='); return { name, value: value.join('='), url: context.baseUrl };
        }));
        const page = await browserContext.newPage(); page.setDefaultTimeout(config.browserActionTimeoutMs);
        await page.goto(`${context.baseUrl}/app/missing/${f.wantedId}`);
        await page.getByRole('button', { name: 'Check available matches', exact: true }).click();
        await page.getByRole('button', { name: 'Continue checking matches', exact: true }).click();
        const button = page.getByRole('button', { name: 'Search again', exact: true }); await button.waitFor();
        await button.focus(); await page.keyboard.press('Enter');
        const feedback = page.getByText('Checking available matches before starting another search.', { exact: true }); await feedback.waitFor();
        assert.equal(await feedback.evaluate(el => Boolean(el.closest('[role="status"]'))), true);
        await page.getByText('Harmoniarr is checking the remaining matches before starting another search.', { exact: true }).waitFor();
        await page.waitForFunction(() => globalThis.document.activeElement?.id === 'missing-music-inspector-current-status');
        assert.equal(await button.count(), 0);
        assert.equal((await f.pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='missing_music_search_again_requested'")).rows[0].count, 0);
        await page.reload(); await page.getByText('Checking available matches', { exact: true }).waitFor(); assert.equal(await button.count(), 0);
        await advanceBoundedSearch(f);
        await page.locator('header').filter({ hasText: 'Missing Music' }).getByRole('button', { name: 'Refresh', exact: true }).click();
        await page.getByText('Search queued', { exact: true }).waitFor(); assert.equal(await button.count(), 0);
        assert.equal((await f.pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type IN ('import_candidate_apply','import_candidate_execution')")).rows[0].count, 0);
      });
    });
  });
  test('exhausted choices expose keyboard search, durable queued feedback and current-state focus after refresh and reload', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start();
      await seedQualityReviewAlternative(f, { extension: 'mp3' });
      await withBrowserSession({}, async ({ browserContext }) => {
        await browserContext.addCookies(context.client.getCookieHeader().split(';').filter(Boolean).map(cookie => {
          const [name, ...value] = cookie.trim().split('='); return { name, value: value.join('='), url: context.baseUrl };
        }));
        const page = await browserContext.newPage(); page.setDefaultTimeout(config.browserActionTimeoutMs);
        await page.goto(`${context.baseUrl}/app/missing/${f.wantedId}`);
        const button = page.getByRole('button', { name: 'Search again', exact: true }); await button.waitFor();
        await page.getByText('No eligible matches remain from this search. Search again using the current quality requirements.', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Choose another match', exact: true }).count(), 0);
        await button.focus(); await page.keyboard.press('Enter');
        await page.getByText('A new search is queued. Acquisition will follow the saved automation policy.', { exact: true }).waitFor();
        await page.getByText('Another search is queued with the current quality requirements. Acquisition will follow the saved automation policy.', { exact: true }).waitFor();
        await page.waitForFunction(() => globalThis.document.activeElement?.id === 'missing-music-inspector-current-status');
        assert.equal(await button.count(), 0);
        const saved = (await f.pool.query('SELECT evidence FROM library_discovery_requests WHERE id=$1', [f.discoveryId])).rows[0].evidence;
        assert.equal(saved.musicQueueRediscovery.qualityReviewRequirement.profileCode, 'lossless_archive');
        assert.equal((await f.module.importCandidateService.getImportCandidate({ importCandidateId: f.candidateId })).status, 'failed');
        await page.reload(); await page.getByText('Search queued', { exact: true }).waitFor(); assert.equal(await button.count(), 0);
      });
    });
  });
});
