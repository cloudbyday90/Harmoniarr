import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { before, after, suite, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { assertLocatorFocused } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const counts = { provider: 'slskd', candidateCount: 0, responseCount: 4, responseFileCount: 10,
  ignoredUserResponseCount: 2, blacklistedFileCount: 3, missingUsernameResponseCount: 1, malformedFileCount: 2 };
async function assertCounts(list) {
  for (const [label, value] of [['Provider responses', '4'], ['Provider files', '10'], ['Ignored-source responses', '2'],
    ['Files excluded by title', '3'], ['Responses missing identity', '1'], ['Malformed files', '2']]) {
    const term = list.locator('dt').filter({ hasText: new RegExp(`^${label}$`) });
    assert.equal(await term.count(), 1); assert.equal(await term.locator('xpath=following-sibling::dd[1]').textContent(), value);
  }
  assert.doesNotMatch(await list.textContent(), /Filtered|private|secret/);
}
suite('unit-aware search diagnostics in canonical and advanced views', () => {
  before(async () => { runtime = await createBrowserSmokeRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('canonical inspector shows separate units and Refresh removes stale evidence without actions or focus theft', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl }); let diagnostics = counts; let mutations = 0;
      const decision = { decisionId: 'counts-decision', expectedTrackCount: 1, matchedTrackCount: 0, missingTrackCount: 1,
        release: { artistName: 'Counts Artist', title: 'Counts Album', releaseGroupType: 'Album' },
        requestedFor: { id: 'listener', username: 'Listener', accountStatus: 'active' },
        state: 'searching', status: { code: 'retrying_search', label: 'Waiting to search', message: 'Waiting for automatic cooldown.', tone: 'info', nextAction: null } };
      await browserContext.route('**/api/v1/missing-music/decisions**', route => {
        if (route.request().method() !== 'GET') mutations++;
        const url = new URL(route.request().url());
        return route.fulfill({ json: url.pathname.endsWith('/counts-decision')
          ? { ok: true, decision, permissions: { isReadOnly: false }, searchDiagnostics: diagnostics && { ...diagnostics, reasonCodes: ['private'], username: 'private-peer' } }
          : { ok: true, decisions: [decision], users: [], filters: { state: 'searching' }, page: { total: 1, limit: 50 }, scope: 'all' } });
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${baseUrl}/app/missing/counts-decision`, { waitUntil: 'domcontentloaded' });
      const section = page.getByRole('region', { name: 'Last recorded search', exact: true });
      await section.waitFor(); await assertCounts(section.locator('dl'));
      await mkdir('.tmp/missing-search-counts-2026-10-20', { recursive: true });
      await section.screenshot({ path: '.tmp/missing-search-counts-2026-10-20/canonical-mobile.png' });
      diagnostics = null;
      const refresh = page.locator('.hx-page-header').getByRole('button', { name: 'Refresh', exact: true });
      await refresh.focus(); await refresh.press('Enter'); await section.waitFor({ state: 'hidden' });
      await assertLocatorFocused(refresh, 'Refreshing evidence must preserve the invoking focus');
      assert.equal(mutations, 0);
    }, { scenarioName: 'missing_search_counts_canonical' });
  });
  test('advanced Wanted renders separate cause counts instead of a mixed total or raw reason', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route('**/api/v1/library/wanted-releases**', route => route.fulfill({ json: { ok: true, total: 1, wantedReleases: [{
        id: 'counts-wanted', artistName: 'Counts Artist', releaseTitle: 'Counts Album', wantedStatus: 'missing',
        expectedTrackCount: 1, matchedTrackCount: 0, missingTrackCount: 1,
        discoveryRequest: { requestStatus: 'cooldown', evidence: { lastSearchResult: { candidateCount: 0, fileCount: 0,
          ingestionDiagnostics: { ...counts, reasonCodes: ['private-code'] } } } },
      }] } }));
      await page.goto(`${baseUrl}/app/activity/wanted`, { waitUntil: 'domcontentloaded' });
      const details = page.locator('dl[aria-label="Discovery dispatch result details"]');
      await details.waitFor(); await assertCounts(details);
    }, { scenarioName: 'missing_search_counts_advanced' });
  });
});
