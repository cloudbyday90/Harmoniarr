import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { createMetadataCommandFixture, metadataCommandIds as id } from '../../testing/browser/metadata-command-fixture.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { assertLocatorFocused } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createFixtureGate, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';

const config = resolveIntegrationTestRuntimeConfig();
const historyPath = `/api/v1/metadata/artists/${id.artist}/detection-events`;
const event = title => ({ id: title, title, primaryType: 'Album', occurredAt: '2026-10-21T00:00:00.000Z', monitoringDecision: 'already_satisfied', resultingWantedStatus: 'none' });
const initialEntries = [];
let readPage; let reads = [];
const fixture = createMetadataCommandFixture({ history: {
  entries: initialEntries, pageInfo: { hasMore: true, nextCursor: 'initial-cursor' },
  readPage: args => { reads.push(args); return readPage(args); },
} });
let runtime;

async function prepare({ baseUrl, page }, { longHistory = false } = {}) {
  reads = [];
  initialEntries.splice(0, initialEntries.length, event('Initial discovery'), ...(longHistory ? Array.from({ length: 9 }, (_, index) => event(`Earlier discovery ${index + 1}`)) : []));
  await bootstrapAdminThroughUi(page, { baseUrl });
  await page.goto(`${baseUrl}/app/settings/library-browser?artistId=${id.artist}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Load more history', exact: true }).waitFor();
}

async function runScenario(callback, scenarioName) {
  return runtime.runScenario(async context => {
    try { return await callback(context); }
    catch (error) {
      try {
        await mkdir('.tmp/metadata-history-feedback-2026-10-21', { recursive: true });
        await context.page.screenshot({ path: `.tmp/metadata-history-feedback-2026-10-21/${scenarioName}-failure.png`, timeout: 5000 });
      } catch { /* Keep the original browser failure. */ }
      throw error;
    }
  }, { scenarioName });
}

suite('Metadata history feedback and owned focus', () => {
  before(async () => { runtime = await createBrowserSmokeRuntime({ config, createAppFn: fixture.createAppFn }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('final page moves owned keyboard focus to the surviving history heading', { timeout: config.scenarioTimeoutMs }, async () => {
    await runScenario(async context => {
      await prepare(context, { longHistory: true }); const { page } = context;
      const status = page.getByRole('status', { name: 'Detection history status', exact: true });
      await status.waitFor({ state: 'attached' }); assert.equal(await status.textContent(), '');
      const original = await status.elementHandle();
      assert.equal(await status.getAttribute('aria-live'), 'polite'); assert.equal(await status.getAttribute('aria-atomic'), 'true');
      readPage = async () => ({ entries: [event('Final discovery')], pageInfo: { hasMore: false, nextCursor: null } });
      await page.getByRole('button', { name: 'Load more history', exact: true }).press('Enter');
      await page.getByText('Final discovery', { exact: true }).waitFor();
      const heading = page.getByRole('heading', { name: 'Recent discoveries', exact: true });
      await assertLocatorFocused(heading);
      const bounds = await heading.boundingBox();
      assert.ok(bounds.y >= 56 && bounds.y + bounds.height <= page.viewportSize().height, 'the owned completion target must scroll into the visible workspace');
      assert.equal(await status.textContent(), 'Loaded 1 more history entry. All history loaded.');
      assert.equal(await status.evaluate((node, previous) => node === previous, original), true); await original.dispose();
      assert.equal(await heading.getAttribute('tabindex'), '-1');
      assert.equal(await page.getByRole('button', { name: 'Load more history', exact: true }).count(), 0);
      await mkdir('.tmp/metadata-history-feedback-2026-10-21', { recursive: true });
      for (const [width, theme] of [[390, 'light'], [768, 'dark'], [1280, 'dark']]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
        await heading.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `.tmp/metadata-history-feedback-2026-10-21/history-feedback-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
      }
      assert.deepEqual(fixture.calls, []);
    }, 'history_final_page_focus');
  });

  test('a non-final page restores its keyboard invoker and reports the appended count', { timeout: config.scenarioTimeoutMs }, async () => {
    await runScenario(async context => {
      await prepare(context); const { page } = context;
      readPage = async () => ({ entries: [event('Another discovery')], pageInfo: { hasMore: true, nextCursor: 'next-cursor' } });
      const load = page.getByRole('button', { name: 'Load more history', exact: true });
      await load.press('Enter'); await page.getByText('Another discovery', { exact: true }).waitFor();
      await assertLocatorFocused(load);
      assert.equal(await page.getByRole('status', { name: 'Detection history status', exact: true }).textContent(), 'Loaded 1 more history entry.');
      assert.equal(await load.isEnabled(), true); assert.equal(reads.length, 1);
    }, 'history_continuing_page_focus');
  });

  test('native service failure restores retry focus and successful retry clears its feedback', { timeout: config.scenarioTimeoutMs }, async () => {
    await runScenario(async context => {
      await prepare(context); const { page } = context;
      readPage = async () => { throw new Error('controlled history failure'); };
      const load = page.getByRole('button', { name: 'Load more history', exact: true });
      const failed = page.waitForResponse(response => new URL(response.url()).pathname === historyPath && response.status() === 500);
      await load.press('Enter'); await failed;
      const status = page.getByRole('status', { name: 'Detection history status', exact: true });
      await status.getByText(/Could not load more history\./).waitFor(); await assertLocatorFocused(load);
      await page.setViewportSize({ width: 390, height: 1000 }); await status.scrollIntoViewIfNeeded();
      await page.screenshot({ path: '.tmp/metadata-history-feedback-2026-10-21/history-error-390-light.png', fullPage: true, animations: 'disabled' });
      readPage = async () => ({ entries: [], pageInfo: { hasMore: false, nextCursor: null } });
      await load.press('Enter'); await page.getByText('No additional history entries were returned. All history loaded.', { exact: true }).waitFor();
      await assertLocatorFocused(page.getByRole('heading', { name: 'Recent discoveries', exact: true }));
      assert.deepEqual(reads.map(row => row.before), ['initial-cursor', 'initial-cursor']);
      assert.equal(await status.getByText(/Could not load more history\./).count(), 0);
    }, 'history_failure_retry_focus');
  });

  for (const fail of [false, true]) test(`a held ${fail ? 'failed' : 'final'} page preserves a user's move elsewhere`, { timeout: config.scenarioTimeoutMs }, async t => {
    await runScenario(context => withFixtureLifecycle({ signal: t.signal }, async scope => {
      await prepare(context); const { page } = context;
      const reached = createFixtureGate({ signal: scope.signal }); const hold = createFixtureGate();
      scope.onRelease(() => hold.release()); scope.onRelease(() => reached.release());
      const expectedFailure = new Error('controlled history failure');
      readPage = () => {
        const execution = (async () => { reached.release(); await hold.promise; if (fail) throw expectedFailure; return { entries: [event('Held discovery')], pageInfo: { hasMore: false, nextCursor: null } }; })();
        scope.track(execution.then(() => { assert.equal(fail, false); }, error => { assert.equal(error, expectedFailure); }));
        return execution;
      };
      const status = page.getByRole('status', { name: 'Detection history status', exact: true });
      await page.getByRole('button', { name: 'Load more history', exact: true }).press('Enter'); await reached.promise;
      await status.getByText('Loading more history.', { exact: true }).waitFor();
      assert.equal(await status.evaluate(node => node.closest('[aria-busy="true"]') === null), true);
      const input = page.getByLabel('Artist name', { exact: true }); await input.focus();
      hold.release();
      await status.getByText(fail ? /Could not load more history\./ : 'Loaded 1 more history entry. All history loaded.', { exact: !fail }).waitFor();
      await assertLocatorFocused(input); assert.equal(reads.length, 1); assert.deepEqual(fixture.calls, []);
    }), `history_moved_focus_${fail ? 'failure' : 'final'}`);
  });
});
