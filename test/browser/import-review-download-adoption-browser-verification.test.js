/* Harmoniarr — GPL-3.0; see LICENSE. */
import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createBrowserSmokeRuntime, isSkippableBrowserRuntimeError, toBrowserRuntimeUnavailableReason } from '../../testing/browser/playwright-smoke-runtime.js';
import { buildImportReviewCandidate, buildImportReviewExecutionRun, buildImportReviewPreview, buildImportReviewRunSummary, openImportReviewRunHistory } from '../../testing/browser/import-review-browser-helpers.js';
import { installMetadataBrowserFixtures, seedMetadataImportReviewWorkspace } from '../../testing/browser/metadata-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { assertLocatorFocused, assertTabFocusContained, assertVisibleFocusOutline } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { buildPublicImportCandidateExecution } from '../../src/server/import-candidates/import-candidate-execution-public-projection.js';

const config = resolveIntegrationTestRuntimeConfig();
const operationRunId = '10000000-0000-4000-8000-000000000001';
const importCandidateId = '20000000-0000-4000-8000-000000000001';
const transferIds = ['30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002'];
const reviewDigest = 'a'.repeat(64);
let runtime; let unavailable = null;
function deferred() { let resolvePromise; const promise = new Promise((done) => { resolvePromise = done; }); return { promise, resolve: resolvePromise }; }
function review(overrides = {}) {
  return { operationRunId, importCandidateId, reviewDigest, canAdopt: true, reasonCode: null, requestedFileCount: 2,
    files: ['01 Foil.flac', '02 Montreal.flac'].map((label, index) => ({ label, size: 50_000_000, choices: [{ id: transferIds[index], stateLabel: 'Downloading' }] })), ...overrides };
}
function workspace({ adopted = false, older = false } = {}) {
  const candidate = buildImportReviewCandidate({ id: importCandidateId, status: adopted ? 'downloading' : 'selected', fileCount: 2 });
  const item = { id: 'execution-item', importCandidateId, itemStatus: adopted ? 'queued' : 'awaiting_confirmation', downloadAdopted: adopted,
    automaticFailureRecoveryAllowed: !adopted,
    statusMessage: adopted ? 'Existing downloads were linked by an administrator.' : 'The download request still needs review.',
    planningSnapshot: { candidate: { id: importCandidateId }, execution: { requestedFiles: [{ filename: '01 Foil.flac', size: 50_000_000 }],
      handoff: { state: adopted ? 'operator_adopted' : 'awaiting_confirmation', attempt: { attemptId: 'private-attempt' },
        ...(adopted ? { adoption: { proof: 'private-adoption-proof', providerBinding: 'private-provider' } } : {}) } } },
    ...(adopted ? { liveTransferSummary: { status: 'active', total: 2, active: 2, queued: 0, completed: 0, failed: 0,
      totalBytes: 100_000_000, bytesTransferred: 20_000_000, percentComplete: 20, message: '2 transfers are actively progressing.' } } : {}) };
  const uncertainRun = buildImportReviewExecutionRun({ id: operationRunId, status: 'failed', items: [item], queuedCount: 0 });
  const recentRuns = older ? Array.from({ length: 5 }, (_, index) => buildImportReviewExecutionRun({ id: `recent-${index}`, items: [] })) : [uncertainRun];
  const summary = buildImportReviewRunSummary({ currentRun: older ? recentRuns[0] : uncertainRun, recentRuns,
    summary: { status: adopted ? 'ready' : 'attention', confirmationPending: !adopted, pendingConfirmationCount: adopted ? 0 : 1,
      message: adopted ? 'Existing downloads were linked by an administrator.' : 'A download request still needs review. Harmoniarr will not send it again automatically.' } });
  const executionSummary = buildPublicImportCandidateExecution({ ...summary, confirmationPending: !adopted,
    pendingConfirmationCount: adopted ? 0 : 1, unconfirmedRuns: older && !adopted ? [uncertainRun] : [] });
  assert.doesNotMatch(JSON.stringify(executionSummary), /private-|unconfirmedRuns|attemptId|providerBinding|"adoption"/u);
  return { candidates: [candidate], previewById: { [importCandidateId]: buildImportReviewPreview(candidate) }, executionSummary };
}
function executionPanel(page) { return page.locator('.review-panel').filter({ has: page.getByRole('heading', { name: 'Send selected matches to downloads', exact: true }) }); }
async function openWorkspace({ baseUrl, browserContext, page }, value = workspace()) {
  await installMetadataBrowserFixtures(browserContext); await bootstrapAdminThroughUi(page, { baseUrl });
  await seedMetadataImportReviewWorkspace(page, value);
  await page.goto(baseUrl + '/app/activity/candidates?status=selected', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Match diagnostics', exact: true }).waitFor(); await openImportReviewRunHistory(page);
  return executionPanel(page);
}
async function installReview(browserContext, state) {
  await browserContext.route('**/api/v1/import-candidates/execution-runs/*/items/*/download-adoption*', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      state.reads += 1; if (state.readWait) await state.readWait.promise;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, downloadAdoptionReview: state.review ?? review() }) }); return;
    }
    state.writes.push({ path: new URL(request.url()).pathname, body: request.postDataJSON(), key: request.headers()['idempotency-key'], csrf: request.headers()['x-csrf-token'] });
    if (state.writeWait) await state.writeWait.promise;
    if (state.failFirst && state.writes.length === 1) { await route.abort('connectionclosed'); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true,
      downloadAdoption: { outcome: 'adopted', operationRunId, importCandidateId, adoptedFileCount: 2, replayed: state.writes.length > 1 } }) });
  });
}
function createControl(overrides = {}) { return { reads: 0, writes: [], ...overrides }; }

suite('Import Review explicit existing-download adoption browser verification', () => {
  before(async () => { try { runtime = await createBrowserSmokeRuntime({ config }); } catch (error) { if (!isSkippableBrowserRuntimeError(error)) throw error; unavailable = toBrowserRuntimeUnavailableReason(error); } }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('Cancel and Escape perform no write; keyboard confirmation exposes pending outside the closed modal and refreshes truthful tracking', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async (context) => {
      const { page, browserContext } = context; const control = createControl({ writeWait: deferred() }); await installReview(browserContext, control);
      const panel = await openWorkspace(context); const invoker = panel.getByRole('button', { name: 'Review download request', exact: true });
      await invoker.focus(); await page.keyboard.press('Enter'); const dialog = page.getByRole('dialog', { name: 'Use existing downloads?' });
      await dialog.getByText('These existing downloads cover the full saved file list and have verified progress.', { exact: true }).waitFor();
      const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true }); await assertLocatorFocused(cancel); await assertVisibleFocusOutline(cancel);
      await assertTabFocusContained(page, dialog, { steps: 5 }); await cancel.click(); await assertLocatorFocused(invoker);
      await page.keyboard.press('Space'); await dialog.waitFor(); await page.keyboard.press('Escape'); await assertLocatorFocused(invoker); assert.equal(control.writes.length, 0);
      await page.keyboard.press('Enter'); await dialog.waitFor();
      const directory = resolve('.tmp/batch-download-handoff-2026-10'); await mkdir(directory, { recursive: true });
      for (const width of [390, 800, 1280]) {
        await page.setViewportSize({ width, height: 980 });
        for (const theme of ['light', 'dark']) {
          await page.evaluate((value) => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
          await cancel.focus(); await assertVisibleFocusOutline(cancel);
          const geometry = await dialog.evaluate((element) => ({ width: element.getBoundingClientRect().width, viewport: globalThis.innerWidth, overflow: element.scrollWidth > element.clientWidth }));
          assert.ok(geometry.width <= geometry.viewport); assert.equal(geometry.overflow, false);
          await dialog.screenshot({ path: resolve(directory, `adoption-${width}-${theme}.png`), animations: 'disabled' });
        }
      }
      const confirm = dialog.getByRole('button', { name: 'Use existing downloads', exact: true }); await confirm.focus(); await page.keyboard.press('Space');
      await page.waitForFunction(() => !globalThis.document.querySelector('.hx-download-adoption__dialog')?.open);
      const pending = panel.getByRole('status').filter({ hasText: 'Linking the reviewed existing downloads…' }); await pending.waitFor();
      assert.equal(await pending.evaluate((element) => Boolean(element.closest('[inert], [aria-busy="true"], dialog'))), false);
      assert.equal(await panel.getByRole('button', { name: 'Sync transfer state', exact: true }).isDisabled(), true);
      assert.equal(control.writes.length, 1); assert.deepEqual(control.writes[0].body, { reviewDigest, transferIds }); assert.ok(control.writes[0].key); assert.ok(control.writes[0].csrf);
      await seedMetadataImportReviewWorkspace(page, workspace({ adopted: true })); control.writeWait.resolve();
      await panel.locator('p.review-summary-copy').filter({ hasText: 'Existing downloads were linked by an administrator.' }).waitFor();
      await panel.getByText('2 transfers are actively progressing.', { exact: true }).waitFor();
      await assertLocatorFocused(panel.getByRole('heading', { name: 'Send selected matches to downloads', exact: true }));
      assert.equal(await panel.getByRole('button', { name: 'Review download request', exact: true }).count(), 0);
      assert.equal(control.writes.length, 1); await page.goto('about:blank');
    }, { scenarioName: 'import_review_adoption_keyboard_and_refresh' });
  });

  test('uncertain response preserves reviewed digest, full IDs and key; replay leaves user-moved focus and background scroll in place', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async (context) => {
      const { page, browserContext } = context; const control = createControl({ failFirst: true }); await installReview(browserContext, control); const panel = await openWorkspace(context);
      const invoker = panel.getByRole('button', { name: 'Review download request', exact: true }); await invoker.click();
      const dialog = page.getByRole('dialog', { name: 'Use existing downloads?' }); await dialog.getByRole('button', { name: 'Use existing downloads', exact: true }).click();
      await panel.getByRole('alert').filter({ hasText: 'The downloads could not be linked.' }).waitFor(); await assertLocatorFocused(invoker);
      await invoker.click(); await dialog.getByText('The saved choice may already have been accepted. Try the same choice again to check its result.', { exact: true }).waitFor();
      assert.equal(control.reads, 1, 'uncertain retry uses the saved review without changing the digest'); control.writeWait = deferred();
      await dialog.getByRole('button', { name: 'Use existing downloads', exact: true }).click(); await panel.getByRole('status').filter({ hasText: 'Linking the reviewed existing downloads…' }).waitFor();
      const refresh = panel.getByRole('button', { name: 'Refresh', exact: true }); await refresh.focus(); const main = page.locator('.hx-main');
      await main.evaluate((element) => { element.scrollTop = 0; });
      await seedMetadataImportReviewWorkspace(page, workspace({ adopted: true })); control.writeWait.resolve();
      await panel.locator('p.review-summary-copy').filter({ hasText: 'Existing downloads were linked by an administrator.' }).waitFor();
      await assertLocatorFocused(refresh); assert.equal(await main.evaluate((element) => element.scrollTop), 0); assert.deepEqual(control.writes[0], control.writes[1]);
      await page.evaluate(() => globalThis.document.dispatchEvent(new Event('visibilitychange'))); await assertLocatorFocused(refresh); assert.equal(await main.evaluate((element) => element.scrollTop), 0);
      await page.goto('about:blank');
    }, { scenarioName: 'import_review_adoption_uncertain_retry' });
  });

  test('an unresolved request beyond recent history remains reviewable while missing immutable evidence refuses confirmation', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async (context) => {
      const { page, browserContext } = context; const control = createControl({ review: review({ canAdopt: false, reviewDigest: null, reasonCode: 'immutable_download_evidence_missing', requestedFileCount: 0, files: [] }) });
      await installReview(browserContext, control); const panel = await openWorkspace(context, workspace({ older: true }));
      await panel.getByRole('button', { name: 'Review earlier request 10000000', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Use existing downloads?' }); await dialog.getByText('This request lacks the saved file and source evidence needed to link existing downloads safely.', { exact: true }).waitFor();
      assert.equal(await dialog.getByRole('button', { name: 'Use existing downloads', exact: true }).count(), 0); assert.equal(control.writes.length, 0);
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal(control.reads, 1); await page.goto('about:blank');
    }, { scenarioName: 'import_review_adoption_older_request_refusal' });
  });

  test('navigation prevents a pending adoption completion from refreshing or moving focus on another page', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async (context) => {
      const { page, browserContext } = context; const control = createControl({ writeWait: deferred() }); await installReview(browserContext, control); const panel = await openWorkspace(context);
      await panel.getByRole('button', { name: 'Review download request', exact: true }).click();
      await page.getByRole('dialog', { name: 'Use existing downloads?' }).getByRole('button', { name: 'Use existing downloads', exact: true }).click();
      await panel.getByRole('status').filter({ hasText: 'Linking the reviewed existing downloads…' }).waitFor();
      await page.locator('a[href="/app/missing"]').first().click();
      await page.getByRole('heading', { name: 'Missing Music', exact: true }).waitFor();
      const filter = page.getByLabel('Search releases', { exact: true }); await filter.focus();
      const settled = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/download-adoption'));
      control.writeWait.resolve(); await settled; await page.evaluate(() => new Promise((done) => { globalThis.requestAnimationFrame(done); }));
      await assertLocatorFocused(filter); assert.equal(await page.locator('dialog[open]').count(), 0); assert.equal(control.writes.length, 1);
      await page.goto('about:blank');
    }, { scenarioName: 'import_review_adoption_navigation_cleanup' });
  });
});
