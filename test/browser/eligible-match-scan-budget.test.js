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
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withBrowserSession } from '../../testing/browser/browser-session.js';

const fixture = createPreflightReviewFixture(); const config = resolveIntegrationTestRuntimeConfig(); let runtime;
suite('Explicit continuation from an empty quality-review window', () => {
  before(async () => { runtime = await fixture.createRuntime({ clientDistDir: resolve('dist/client') }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('keyboard continuation retains focus, reveals a later match and preserves explicit selection and refresh', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start(); await seedQualityReviewScanRows(f);
      const eligible = await seedQualityReviewAlternative(f);
      await withBrowserSession({}, async ({ browserContext }) => {
        await browserContext.addCookies(context.client.getCookieHeader().split(';').filter(Boolean).map(cookie => {
          const [name, ...value] = cookie.trim().split('='); return { name, value: value.join('='), url: context.baseUrl };
        }));
        const page = await browserContext.newPage(); page.setDefaultTimeout(config.browserActionTimeoutMs);
        await page.goto(`${context.baseUrl}/app/missing/${f.wantedId}`);
        const disclosure = page.getByRole('button', { name: 'Check available matches', exact: true });
        await disclosure.focus(); await page.keyboard.press('Enter');
        assert.equal(await page.getByRole('button', { name: 'Search again', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: /^Use this match for/u }).count(), 0);
        const continuation = page.getByRole('button', { name: 'Continue checking matches', exact: true });
        await continuation.focus(); await page.keyboard.press('Enter');
        await page.getByText('Showing 1 match.', { exact: true }).waitFor();
        const next = page.getByRole('button', { name: 'Next matches', exact: true });
        assert.equal(await next.evaluate(el => el === el.ownerDocument.activeElement), true);
        assert.equal(await next.getAttribute('aria-disabled'), 'true');
        assert.equal(await page.getByRole('button', { name: /^Use this match for/u }).count(), 1);
        await page.getByRole('navigation', { name: 'Available match pages' }).getByRole('button', { name: 'First page', exact: true }).click();
        await page.getByRole('button', { name: 'Continue checking matches', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: /^Use this match for/u }).count(), 0);
        await page.getByRole('button', { name: 'Continue checking matches', exact: true }).click();
        await page.getByText('Showing 1 match.', { exact: true }).waitFor();
        await page.getByRole('button', { name: /^Use this match for/u }).click();
        await page.getByText('Match selected. Download has not started.', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Start download', exact: true }).waitFor();
        assert.equal((await f.module.importCandidateService.getImportCandidate({ importCandidateId: eligible.id })).status, 'selected');
        assert.equal((await f.pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type IN ('import_candidate_apply','import_candidate_execution')")).rows[0].count, 0);
      });
    });
  });
});
