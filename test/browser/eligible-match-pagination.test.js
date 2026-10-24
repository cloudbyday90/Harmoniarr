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
suite('Bounded eligible-match navigation in the existing application', () => {
  before(async () => { runtime = await fixture.createRuntime({ clientDistDir: resolve('dist/client') }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('keyboard pages preserve navigation focus, refresh returns first and a later choice starts no download', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start();
      for (let n = 0; n < 13; n++) await seedQualityReviewAlternative(f);
      await withBrowserSession({}, async ({ browserContext }) => {
        await browserContext.addCookies(context.client.getCookieHeader().split(';').filter(Boolean).map(cookie => {
          const [name, ...value] = cookie.trim().split('='); return { name, value: value.join('='), url: context.baseUrl };
        }));
        const page = await browserContext.newPage(); page.setDefaultTimeout(config.browserActionTimeoutMs);
        await page.goto(`${context.baseUrl}/app/missing/${f.wantedId}`);
        const disclosure = page.getByRole('button', { name: 'Choose another match', exact: true }); await disclosure.click();
        const choices = page.getByRole('button', { name: /^Use this match for/u }); assert.equal(await choices.count(), 12);
        let releaseRead; let observeRead;
        const heldRead = new Promise(resolveRead => { observeRead = resolveRead; });
        await page.route('**/api/v1/missing-music/decisions/*', async route => {
          await new Promise(release => { releaseRead = release; observeRead(); });
          await route.continue();
        }, { times: 1 });
        await choices.first().focus();
        await page.evaluate(() => globalThis.window.dispatchEvent(new globalThis.Event('focus')));
        await heldRead;
        assert.equal(await choices.first().isDisabled(), false);
        assert.equal(await choices.first().evaluate(el => el === el.ownerDocument.activeElement), true);
        const refreshed = page.waitForResponse(response => response.url().endsWith(`/api/v1/missing-music/decisions/${f.wantedId}`));
        releaseRead(); await refreshed;
        const next = page.getByRole('button', { name: 'Next matches', exact: true });
        const previous = page.getByRole('button', { name: 'Previous matches', exact: true });
        await next.focus(); await page.keyboard.press('Enter'); await page.getByText('Showing 1 match.', { exact: true }).waitFor();
        assert.equal(await choices.count(), 1); assert.equal(await next.getAttribute('aria-disabled'), 'true');
        assert.equal(await next.evaluate(el => el === el.ownerDocument.activeElement), true);
        await previous.focus(); await page.keyboard.press('Enter'); await page.getByText('Showing 12 matches.', { exact: true }).waitFor();
        assert.equal(await choices.count(), 12); assert.equal(await previous.getAttribute('aria-disabled'), 'true');
        assert.equal(await previous.evaluate(el => el === el.ownerDocument.activeElement), true);
        await next.click(); await page.getByText('Showing 1 match.', { exact: true }).waitFor();
        await page.locator('header').filter({ hasText: 'Missing Music' }).getByRole('button', { name: 'Refresh', exact: true }).click();
        await page.waitForFunction(() => globalThis.document.querySelectorAll('[aria-label="Available matches"] li').length === 12);
        await next.click(); await page.getByText('Showing 1 match.', { exact: true }).waitFor();
        await choices.click(); await page.getByText('Match selected. Download has not started.', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Start download', exact: true }).waitFor();
        assert.equal(await disclosure.count(), 0);
        assert.equal((await f.pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type IN ('import_candidate_apply','import_candidate_execution')")).rows[0].count, 0);
      });
    });
  });
});
