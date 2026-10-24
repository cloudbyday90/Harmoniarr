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
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withBrowserSession } from '../../testing/browser/browser-session.js';

const fixture = createPreflightReviewFixture(); const config = resolveIntegrationTestRuntimeConfig(); let runtime;
async function openDecision({ browserContext, baseUrl, client, wantedId }) {
  await browserContext.addCookies(client.getCookieHeader().split(';').filter(Boolean).map(cookie => {
    const [name, ...value] = cookie.trim().split('='); return { name, value: value.join('='), url: baseUrl };
  }));
  const page = await browserContext.newPage(); page.setDefaultTimeout(config.browserActionTimeoutMs);
  await page.goto(`${baseUrl}/app/missing/${wantedId}`); return page;
}
suite('Durable initial quality review in rendered Missing Music', () => {
  before(async () => { runtime = await fixture.createRuntime({ clientDistDir: resolve('dist/client') }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('measured lossless refusal is explained after navigation and reload without a quality bypass', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start();
      await withBrowserSession({}, async ({ browserContext }) => {
        const page = await openDecision({ browserContext, ...context, wantedId: f.wantedId });
        await page.getByRole('heading', { name: 'Lossless audio needs review', exact: true }).waitFor();
        await page.getByText('No eligible matches remain from this search. Search again using the current quality requirements.', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Search again', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Check the files again', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Add to library', exact: true }).count(), 0);
        assert.doesNotMatch(await page.locator('body').innerText(), /private\/provider|raw tool output|file\.flac/u);
        await page.reload(); await page.getByRole('heading', { name: 'Lossless audio needs review', exact: true }).waitFor();
      });
    });
  });
  test('an interrupted check exposes its existing command and refreshes the accepted guarded queue state', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); fixture.controls.code = 'safe_auto_spectral_proof_unavailable'; await f.start();
      await withBrowserSession({}, async ({ browserContext }) => {
        const page = await openDecision({ browserContext, ...context, wantedId: f.wantedId });
        const button = page.getByRole('button', { name: 'Check the files again', exact: true }); await button.waitFor();
        fixture.controls.eligible = true; await button.click();
        await page.getByRole('heading', { name: 'Library-add checks queued', exact: true }).waitFor();
        await page.getByText('Harmoniarr queued this release for library-add checks. The files will be added only if the plan remains safe.', { exact: true }).waitFor();
        const runs = (await f.pool.query("SELECT summary FROM operation_runs WHERE operation_type='import_candidate_apply'")).rows;
        assert.equal(runs.length, 1); assert.deepEqual(runs[0].summary.importCandidateIds, [f.candidateId]);
        assert.equal(runs[0].summary.applySafetyMode, 'safe_auto');
      });
    });
  });
});
