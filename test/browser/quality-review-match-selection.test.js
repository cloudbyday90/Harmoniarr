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
import { seedQualityReviewAlternative } from '../../testing/integration/quality-review-match-fixture.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withBrowserSession } from '../../testing/browser/browser-session.js';

const fixture = createPreflightReviewFixture(); const config = resolveIntegrationTestRuntimeConfig(); let runtime;
suite('Choose another match in rendered Missing Music', () => {
  before(async () => { runtime = await fixture.createRuntime({ clientDistDir: resolve('dist/client') }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('native disclosure preserves keyboard focus and selects through the real API without starting a download', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start();
      const candidate = await seedQualityReviewAlternative(f);
      await seedQualityReviewAlternative(f, { extension: 'mp3' });
      await withBrowserSession({}, async ({ browserContext }) => {
        await browserContext.addCookies(context.client.getCookieHeader().split(';').filter(Boolean).map(cookie => {
          const [name, ...value] = cookie.trim().split('='); return { name, value: value.join('='), url: context.baseUrl };
        }));
        const page = await browserContext.newPage(); page.setDefaultTimeout(config.browserActionTimeoutMs);
        await page.goto(`${context.baseUrl}/app/missing/${f.wantedId}`);
        const disclosure = page.getByRole('button', { name: 'Choose another match', exact: true }); await disclosure.waitFor();
        assert.equal(await disclosure.getAttribute('aria-expanded'), 'false');
        assert.equal(await page.getByRole('list', { name: 'Available matches', exact: true }).isVisible(), false);
        await disclosure.focus(); await page.keyboard.press('Enter');
        assert.equal(await disclosure.getAttribute('aria-expanded'), 'true');
        assert.equal(await disclosure.evaluate(element => element === element.ownerDocument.activeElement), true);
        assert.equal(await page.getByRole('button', { name: /^Use this match for/u }).count(), 1);
        await page.keyboard.press('Space'); assert.equal(await disclosure.getAttribute('aria-expanded'), 'false');
        await page.keyboard.press('Space'); await page.keyboard.press('Tab');
        const use = page.getByRole('button', { name: /^Use this match for/u });
        assert.equal(await use.evaluate(element => element === element.ownerDocument.activeElement), true);
        await page.keyboard.press('Enter');
        await page.getByText('Match selected. Download has not started.', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Start download', exact: true }).waitFor();
        assert.equal(await page.getByRole('heading', { name: 'Current status', exact: true }).evaluate(element => element === element.ownerDocument.activeElement), true);
        assert.equal((await f.module.importCandidateService.getImportCandidate({ importCandidateId: candidate.id })).status, 'selected');
        const runs = (await f.pool.query("SELECT id FROM operation_runs WHERE operation_type IN ('import_candidate_apply','import_candidate_execution')")).rows;
        assert.deepEqual(runs, []);
        await page.reload(); await page.getByRole('button', { name: 'Start download', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Choose another match', exact: true }).count(), 0);
      });
    });
  });
});
