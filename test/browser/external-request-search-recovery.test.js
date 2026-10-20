import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { before, after, suite, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { assertLocatorFocused, assertVisibleFocusOutline } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { getExternalSearchRecoveryMessage } from '../../src/shared/external-request-search-recovery-policy.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const requestId = '11111111-2222-4333-8444-555555555555';
const intentId = '33333333-2222-4333-8444-555555555555';
const oldRunId = '44444444-2222-4333-8444-555555555555';
const newRunId = '55555555-2222-4333-8444-555555555555';
const detailPath = `/api/v1/library/media-requests/${requestId}`;
const reviewPath = `${detailPath}/external-review`;
const commandPath = `${reviewPath}/intents/${intentId}/search-again`;
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

async function fixtures(context, { loseFirstResponse = false, failRefresh = false } = {}) {
  let accepted = false; let enabled = true; const calls = []; const held = deferred();
  const user = { id: '22222222-2222-4333-8444-555555555555', username: 'Household listener', role: 'requester' };
  await context.route(`**${detailPath}`, route => route.fulfill({ json: { ok: true, mediaRequest: { id: requestId,
    requestKind: 'external_url', requestState: 'needs_fetch', sourceProvider: 'spotify', sourceUrl: 'https://open.spotify.com/album/fixture',
    createdAt: '2026-10-20T12:00:00Z', requestedByUser: user, requestedForUser: user,
    fulfillmentStatus: { code: 'under_review', detail: 'Approved release needs review.' } }, events: [], hasMoreEvents: false } }));
  await context.route(`**${detailPath}/pipeline`, route => route.fulfill({ json: { ok: true, candidates: [] } }));
  const run = { id: oldRunId, operationType: 'library_external_request_discovery', status: 'failed', startedAt: '2026-10-20T12:00:00Z',
    summary: { mediaRequestId: requestId, intentId, failureCode: 'slskd_search_continuation_expired' } };
  await context.route('**/api/v1/operations/**', async route => {
    assert.equal(route.request().method(), 'GET');
    await route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/history')
      ? { runs: [run] } : { operationRun: { run, auditEvents: [] } } });
  });
  await context.route(new RegExp(`${reviewPath}(?:\\?.*)?$`), async route => {
    if (accepted && failRefresh) { await route.fulfill({ status: 503, json: { error: { code: 'database_unavailable', message: 'Review is temporarily unavailable.' } } }); return; }
    await route.fulfill({ json: { items: [], preparation: { canRecover: false, action: null }, intents: [{ id: intentId,
      requestedForUserId: user.id, artistName: 'Prepared Artist', releaseTitle: 'Prepared Album',
      operationRunId: accepted ? newRunId : oldRunId, status: accepted ? 'pending' : 'failed',
      ...(!accepted ? { searchRecovery: { canSearchAgain: enabled, expectedOperationRunId: oldRunId,
        message: getExternalSearchRecoveryMessage('slskd_search_continuation_expired') } } : {}) }] } });
  });
  await context.route(`**${commandPath}`, async route => {
    calls.push({ body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key'], csrf: route.request().headers()['x-csrf-token'] });
    if (calls.length === 1) await held.promise;
    accepted = true;
    if (loseFirstResponse && calls.length === 1) { await route.abort('failed'); return; }
    await route.fulfill({ status: 202, json: { searchRecovery: { outcome: 'queued', mediaRequestId: requestId, intentId,
      previousOperationRunId: oldRunId, operationRunId: newRunId, reusedExistingRun: calls.length > 1 } } });
  });
  return { calls, release: held.resolve, setEnabled: value => { enabled = value; } };
}

suite('approved external search recovery browser interaction', () => {
  before(async () => { runtime = await createBrowserSmokeRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('job review handoff, keyboard pending feedback and uncertain replay retain one saved command', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await fixtures(browserContext, { loseFirstResponse: true });
      await page.goto(`${baseUrl}/app/activity/operations?runId=${oldRunId}`, { waitUntil: 'domcontentloaded' });
      const link = page.getByRole('link', { name: 'Review approved release search', exact: true });
      await link.focus(); await assertVisibleFocusOutline(link, 'Job recovery link needs visible focus'); await link.press('Enter');
      const panel = page.getByRole('article', { name: 'Review external music' });
      const button = panel.getByRole('button', { name: 'Search again for Prepared Artist — Prepared Album', exact: true });
      await button.waitFor(); assert.equal(fixture.calls.length, 0);
      const refresh = panel.getByRole('button', { name: 'Refresh review', exact: true });
      fixture.setEnabled(false); await refresh.focus(); await refresh.press('Enter');
      await button.waitFor({ state: 'hidden' });
      await panel.getByText(getExternalSearchRecoveryMessage('slskd_search_continuation_expired'), { exact: true }).waitFor();
      assert.equal(await button.count(), 0, 'A read-only target cannot request a new search');
      fixture.setEnabled(true); await refresh.focus(); await refresh.press('Enter'); await button.waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      await button.focus(); await assertVisibleFocusOutline(button, 'Recovery button needs visible keyboard focus');
      assert.ok((await button.boundingBox()).height >= 44);
      try {
        await button.press('Enter');
        await panel.getByRole('status').filter({ hasText: 'Queueing a new search for the approved release…' }).waitFor();
        assert.equal(await button.isDisabled(), true);
        assert.equal(await panel.getByRole('button', { name: 'Refresh review', exact: true }).isDisabled(), true);
        const feedback = panel.getByRole('status').filter({ hasText: 'Queueing a new search for the approved release…' });
        assert.equal(await feedback.evaluate(element => Boolean(element.closest('[aria-busy="true"]'))), false);
      } finally { fixture.release(); }
      await panel.getByRole('alert').filter({ hasText: 'The result is uncertain.' }).waitFor();
      await panel.getByRole('button', { name: 'Refresh review', exact: true }).click();
      await panel.getByText('Search queued', { exact: true }).waitFor();
      const retry = panel.getByRole('button', { name: 'Retry saved search request for Prepared Artist — Prepared Album', exact: true });
      await retry.focus(); await retry.press('Enter');
      await panel.getByRole('status').filter({ hasText: 'This new search was already queued.' }).waitFor();
      await assertLocatorFocused(panel.getByRole('heading', { name: 'Search recovery', exact: true }), 'Completed recovery should focus its updated result');
      assert.equal(await retry.count(), 0); assert.equal(fixture.calls.length, 2);
      assert.deepEqual(fixture.calls[0], fixture.calls[1]);
      assert.deepEqual(fixture.calls[0].body, { expectedOperationRunId: oldRunId });
      assert.ok(fixture.calls[0].key); assert.ok(fixture.calls[0].csrf);
      const recovery = panel.getByRole('region', { name: 'Search recovery for Prepared Artist — Prepared Album' });
      assert.equal(await recovery.evaluate(element => element.scrollWidth <= element.clientWidth), true);
      await mkdir('.tmp/external-search-recovery-2026-10-20', { recursive: true });
      await panel.screenshot({ path: '.tmp/external-search-recovery-2026-10-20/recovery-mobile.png' });
      assert.deepEqual(errors, []);
    }, { scenarioName: 'external_search_recovery_uncertain_keyboard' });
  });

  test('accepted intent survives refresh failure and preserves a user’s move to another control', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const fixture = await fixtures(browserContext, { failRefresh: true });
      await page.goto(`${baseUrl}/app/requests/${requestId}`, { waitUntil: 'domcontentloaded' });
      const panel = page.getByRole('article', { name: 'Review external music' });
      const button = panel.getByRole('button', { name: 'Search again for Prepared Artist — Prepared Album', exact: true });
      const elsewhere = page.locator('.hx-sidebar').getByRole('link', { name: 'Home', exact: true });
      try {
        await button.focus(); await button.press('Enter');
        await panel.getByRole('status').filter({ hasText: 'Queueing a new search for the approved release…' }).waitFor();
        await elsewhere.focus();
      } finally { fixture.release(); }
      await panel.getByText('The new search is queued. Refresh the review to see its latest status.', { exact: true }).waitFor();
      await assertLocatorFocused(elsewhere, 'A user move during the command must be preserved');
      assert.equal(fixture.calls.length, 1);
      await panel.getByRole('status').filter({ hasText: 'A new search is queued for the approved release.' }).waitFor();
    }, { scenarioName: 'external_search_recovery_refresh_failure' });
  });
});
