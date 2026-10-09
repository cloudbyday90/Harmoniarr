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
const newerRunId = '10000000-0000-4000-8000-000000000002';
const importCandidateId = '20000000-0000-4000-8000-000000000001';
const reviewDigest = 'a'.repeat(64);
let runtime; let unavailable = null;
function deferred() { let resolvePromise; const promise = new Promise((done) => { resolvePromise = done; }); return { promise, resolve: resolvePromise }; }
function createControl(overrides = {}) { return { adoptionReads: 0, originReads: 0, adoptionWrites: 0, writes: [], ...overrides }; }
function originReview(overrides = {}) { return { operationRunId, importCandidateId, canRestore: true, reasonCode: null, reviewDigest,
  verifiedFileCount: 10, retiredRequestCount: 1, ...overrides }; }
function workspace({ restored = false } = {}) {
  const candidate = buildImportReviewCandidate({ id: importCandidateId, status: restored ? 'downloading' : 'selected', fileCount: 10 });
  const original = buildImportReviewExecutionRun({ id: operationRunId, status: 'failed', executionMode: 'download_enqueue', downloadOriginResolved: restored, queuedCount: 0, startedAt: '2026-10-08T00:00:00.000Z',
    items: [{ id: 'earlier-item', importCandidateId, itemStatus: restored ? 'queued' : 'awaiting_confirmation',
      statusMessage: restored ? '10 transfers are actively progressing.' : 'The earlier download request still needs review.',
      planningSnapshot: { candidate: { id: importCandidateId }, execution: { handoff: { state: restored ? 'confirmed' : 'awaiting_confirmation',
        attempt: { attemptId: 'private-attempt', binding: 'private-provider-binding' },
        ...(restored ? { originResolution: { actorUserId: 'private-actor', requestHash: 'private-hash' } } : {}) } } },
      ...(restored ? { liveTransferSummary: { status: 'active', total: 10, active: 10, queued: 0, completed: 0, failed: 0,
        totalBytes: 100_000_000, bytesTransferred: 20_000_000, percentComplete: 20, message: '10 transfers are actively progressing.' } } : {}) }] });
  const latest = buildImportReviewExecutionRun({ id: newerRunId, status: restored ? 'cancelled' : 'pending', executionMode: 'download_enqueue', queuedCount: 0, readyCount: 0, startedAt: '2026-10-08T01:00:00.000Z',
    summary: { selectedCandidateId: importCandidateId, requestedCandidateCount: 1, executionMode: 'download_enqueue', triggerSource: 'missing_music_manual',
      ...(restored ? { downloadOriginSupersession: { actorUserId: 'private-actor', requestHash: 'private-hash' } } : {}) }, items: [] });
  const recentRuns = [latest, original];
  const value = buildImportReviewRunSummary({ currentRun: restored ? original : latest, recentRuns,
    summary: { status: restored ? 'ready' : 'attention', confirmationPending: !restored, pendingConfirmationCount: restored ? 0 : 1,
      message: restored ? 'The original request was restored. Harmoniarr is tracking its verified downloads.' : 'A download request is still being confirmed with Downloader. Harmoniarr will not send it again automatically.' } });
  const executionSummary = buildPublicImportCandidateExecution({ ...value, confirmationPending: !restored, pendingConfirmationCount: restored ? 0 : 1,
    unconfirmedRuns: restored ? [] : [original], restoredRuns: restored ? [original] : [] });
  assert.doesNotMatch(JSON.stringify(executionSummary), /private-|unconfirmedRuns|restoredRuns|attemptId|downloadOriginSupersession|originResolution/u);
  return { candidates: [candidate], previewById: { [importCandidateId]: buildImportReviewPreview(candidate) }, executionSummary };
}
function panel(page) { return page.locator('.review-panel').filter({ has: page.getByRole('heading', { name: 'Send selected matches to downloads', exact: true }) }); }
async function openWorkspace({ page, browserContext, baseUrl }) {
  await installMetadataBrowserFixtures(browserContext); await bootstrapAdminThroughUi(page, { baseUrl }); await seedMetadataImportReviewWorkspace(page, workspace());
  await page.goto(baseUrl + '/app/activity/candidates?status=selected'); await page.getByRole('heading', { name: 'Match diagnostics', exact: true }).waitFor();
  await openImportReviewRunHistory(page); return panel(page);
}
async function installReview(browserContext, control) {
  await browserContext.route('**/api/v1/import-candidates/execution-runs/*/items/*/download-*', async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (path.endsWith('/download-adoption-review')) {
      control.adoptionReads += 1; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true,
        downloadAdoptionReview: { operationRunId, importCandidateId, canAdopt: false, reasonCode: control.restored ? 'download_episode_not_available' : 'download_episode_not_current', requestedFileCount: 0, files: [] } }) }); return;
    }
    if (path.endsWith('/download-origin-review')) {
      control.originReads += 1; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, downloadOriginReview: control.review ?? originReview() }) }); return;
    }
    if (path.endsWith('/download-adoption')) { control.adoptionWrites += 1; await route.fulfill({ status: 409, body: '{}' }); return; }
    control.writes.push({ path, body: request.postDataJSON(), key: request.headers()['idempotency-key'], csrf: request.headers()['x-csrf-token'] });
    if (control.writeWait) await control.writeWait.promise; control.restored = true;
    if (control.failFirst && control.writes.length === 1) { await route.abort('connectionclosed'); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, downloadOriginResolution: {
      outcome: 'restored', operationRunId, importCandidateId, verifiedFileCount: 10, retiredRequestCount: 1, replayed: control.writes.length > 1 } }) });
  });
}
async function openOriginReview(page, executionPanel) {
  const invoker = executionPanel.getByRole('button', { name: 'Review earlier request 10000000', exact: true }); await invoker.focus(); await page.keyboard.press('Enter');
  const adoption = page.getByRole('dialog', { name: 'Use existing downloads?', exact: true }); await adoption.getByText('A newer download request owns this match. Review its current status before continuing.', { exact: true }).waitFor();
  await adoption.getByRole('button', { name: 'Review earlier download request', exact: true }).focus(); await page.keyboard.press('Enter');
  const origin = page.getByRole('dialog', { name: 'Continue verified downloads?', exact: true }); await origin.waitFor();
  assert.equal(await page.locator('dialog[open]').count(), 1); assert.equal(await origin.evaluate((element) => Boolean(element.parentElement.closest('dialog'))), false);
  return { invoker, dialog: origin };
}

suite('Import Review guarded download-origin resolution browser verification', () => {
  before(async () => { try { runtime = await createBrowserSmokeRuntime({ config }); } catch (error) { if (!isSkippableBrowserRuntimeError(error)) throw error; unavailable = toBrowserRuntimeUnavailableReason(error); } }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('sequential native dialogs cancel without writes, confirm by keyboard, and keep commands excluded until both summaries refresh', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async (context) => {
      const { page, browserContext } = context; const control = createControl({ writeWait: deferred() }); await installReview(browserContext, control); const executionPanel = await openWorkspace(context);
      let opened = await openOriginReview(page, executionPanel); const cancel = opened.dialog.getByRole('button', { name: 'Cancel', exact: true });
      await assertLocatorFocused(cancel); await assertVisibleFocusOutline(cancel); await assertTabFocusContained(page, opened.dialog, { steps: 4 });
      await cancel.click(); await assertLocatorFocused(opened.invoker); assert.equal(control.writes.length, 0); assert.equal(control.adoptionWrites, 0);
      opened = await openOriginReview(page, executionPanel); await page.keyboard.press('Escape'); await assertLocatorFocused(opened.invoker); assert.equal(control.writes.length, 0);
      opened = await openOriginReview(page, executionPanel); await opened.dialog.getByText('10', { exact: true }).waitFor();
      const directory = resolve('.tmp/download-origin-resolution-2026-10'); await mkdir(directory, { recursive: true });
      for (const width of [390, 800, 1280]) {
        await page.setViewportSize({ width, height: 980 });
        for (const theme of ['light', 'dark']) {
          await page.evaluate((value) => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
          await opened.dialog.getByRole('button', { name: 'Cancel', exact: true }).focus(); await assertVisibleFocusOutline(opened.dialog.getByRole('button', { name: 'Cancel', exact: true }));
          assert.equal(await opened.dialog.evaluate((element) => element.scrollWidth <= element.clientWidth), true);
          await opened.dialog.screenshot({ path: resolve(directory, `origin-${width}-${theme}.png`), animations: 'disabled' });
        }
      }
      await opened.dialog.getByRole('button', { name: 'Continue verified downloads', exact: true }).focus(); await page.keyboard.press('Space');
      const pending = executionPanel.getByRole('status').filter({ hasText: 'Resolving the reviewed download request…' }); await pending.waitFor();
      assert.equal(await page.locator('dialog[open]').count(), 0); assert.equal(await pending.evaluate((element) => Boolean(element.closest('dialog, [inert], [aria-busy="true"]'))), false);
      assert.equal(await executionPanel.getByRole('button', { name: 'Sync transfer state', exact: true }).isDisabled(), true);
      assert.equal(await opened.invoker.isDisabled(), true); assert.equal(control.writes.length, 1); assert.deepEqual(control.writes[0].body, { reviewDigest }); assert.ok(control.writes[0].key); assert.ok(control.writes[0].csrf);
      await page.evaluate(() => {
        const originalFetch = globalThis.fetch.bind(globalThis); globalThis.originSelectedGate = { paused: true, reads: 0, release: null };
        globalThis.fetch = async (input, init) => {
          const path = new URL(typeof input === 'string' ? input : input.url, globalThis.location.origin).pathname;
          if (path === '/api/v1/import-candidates/selected-summary' && globalThis.originSelectedGate.paused) { globalThis.originSelectedGate.reads += 1; await new Promise((done) => { globalThis.originSelectedGate.release = done; }); }
          return originalFetch(input, init);
        };
      });
      await seedMetadataImportReviewWorkspace(page, workspace({ restored: true })); control.writeWait.resolve();
      await executionPanel.locator('p.review-summary-copy').filter({ hasText: 'The original request was restored. Harmoniarr is tracking its verified downloads.' }).waitFor(); await page.waitForFunction(() => globalThis.originSelectedGate.reads > 0);
      assert.equal(await executionPanel.getByRole('button', { name: 'Start download run', exact: true }).isDisabled(), true, 'removed review row must not release the command gate before selected counts finish');
      assert.equal(await executionPanel.getByRole('button', { name: 'Sync transfer state', exact: true }).isDisabled(), true);
      await page.evaluate(() => { globalThis.originSelectedGate.paused = false; globalThis.originSelectedGate.release(); });
      await page.waitForFunction(() => globalThis.document.activeElement?.textContent === 'Send selected matches to downloads');
      await assertLocatorFocused(executionPanel.getByRole('heading', { name: 'Send selected matches to downloads', exact: true }));
      assert.equal(await executionPanel.getByRole('button', { name: 'Start download run', exact: true }).isDisabled(), true, 'refreshed selected count is zero');
      assert.equal(control.adoptionWrites, 0); assert.equal(control.writes.length, 1); await page.goto('about:blank');
    }, { scenarioName: 'import_review_origin_resolution_keyboard_refresh' });
  });

  test('an uncertain resolution reopens its original digest without rereading adoption and preserves moved focus on saved replay', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async (context) => {
      const { page, browserContext } = context; const control = createControl({ failFirst: true }); await installReview(browserContext, control); const executionPanel = await openWorkspace(context);
      const { invoker, dialog } = await openOriginReview(page, executionPanel); await dialog.getByRole('button', { name: 'Continue verified downloads', exact: true }).click();
      await executionPanel.getByRole('alert').filter({ hasText: 'This download request could not be resolved.' }).waitFor(); await assertLocatorFocused(invoker);
      await invoker.click(); await page.getByRole('dialog', { name: 'Continue verified downloads?', exact: true }).getByText('The saved choice may already have been accepted. Try the same choice again to check its result.', { exact: true }).waitFor();
      assert.equal(control.adoptionReads, 1, 'a committed response loss must not replace the saved choice with an adoption refusal'); assert.equal(control.originReads, 1);
      control.writeWait = deferred(); await page.getByRole('dialog', { name: 'Continue verified downloads?', exact: true }).getByRole('button', { name: 'Continue verified downloads', exact: true }).click();
      await executionPanel.getByRole('status').filter({ hasText: 'Resolving the reviewed download request…' }).waitFor(); const refresh = executionPanel.getByRole('button', { name: 'Refresh', exact: true }); await refresh.focus();
      const main = page.locator('.hx-main'); await main.evaluate((element) => { element.scrollTop = 0; }); await seedMetadataImportReviewWorkspace(page, workspace({ restored: true })); control.writeWait.resolve();
      await executionPanel.locator('p.review-summary-copy').filter({ hasText: 'The original request was restored. Harmoniarr is tracking its verified downloads.' }).waitFor();
      await assertLocatorFocused(refresh); assert.equal(await main.evaluate((element) => element.scrollTop), 0); assert.deepEqual(control.writes[0], control.writes[1]); assert.equal(control.adoptionWrites, 0);
      await page.goto('about:blank');
    }, { scenarioName: 'import_review_origin_resolution_uncertain_retry' });
  });

  test('server refusal shows no Continue command and keeps private reasons and evidence out of the review', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async (context) => {
      const { page, browserContext } = context; const control = createControl({ review: originReview({ canRestore: false, reasonCode: 'private-reserved-job', reviewDigest: null, verifiedFileCount: 0, retiredRequestCount: 0 }) });
      await installReview(browserContext, control); const executionPanel = await openWorkspace(context); const { dialog, invoker } = await openOriginReview(page, executionPanel);
      await dialog.getByText('This download request cannot be resolved safely here. Review its current status before continuing.', { exact: true }).waitFor();
      assert.equal(await dialog.getByRole('button', { name: 'Continue verified downloads', exact: true }).count(), 0); assert.doesNotMatch(await dialog.innerText(), /private|attemptId|providerBinding|requestHash|transferId|\/mnt/u);
      await page.keyboard.press('Escape'); await assertLocatorFocused(invoker); assert.equal(control.writes.length, 0); assert.equal(control.adoptionWrites, 0); await page.goto('about:blank');
    }, { scenarioName: 'import_review_origin_resolution_refusal' });
  });

  test('SPA navigation during resolution preserves the new page focus when the old command response arrives', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async (context) => {
      const { page, browserContext } = context; const control = createControl({ writeWait: deferred() }); await installReview(browserContext, control); const executionPanel = await openWorkspace(context);
      const { dialog } = await openOriginReview(page, executionPanel); await dialog.getByRole('button', { name: 'Continue verified downloads', exact: true }).click();
      await executionPanel.getByRole('status').filter({ hasText: 'Resolving the reviewed download request…' }).waitFor(); await page.locator('a[href="/app/missing"]').first().click();
      await page.getByRole('heading', { name: 'Missing Music', exact: true }).waitFor(); const filter = page.getByLabel('Search releases', { exact: true }); await filter.focus();
      const settled = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/download-origin-resolution')); control.writeWait.resolve(); await settled;
      await page.evaluate(() => new Promise((done) => { globalThis.requestAnimationFrame(done); })); await assertLocatorFocused(filter);
      assert.equal(await page.locator('dialog[open]').count(), 0); assert.equal(control.writes.length, 1); await page.goto('about:blank');
    }, { scenarioName: 'import_review_origin_resolution_navigation' });
  });
});
