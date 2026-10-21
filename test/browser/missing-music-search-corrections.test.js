import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { before, after, suite, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi, loginThroughUi, logoutThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { assertLocatorFocused, assertVisibleFocusOutline } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const counts = { provider: 'slskd', candidateCount: 0, responseCount: 2, responseFileCount: 4,
  ignoredUserResponseCount: 1, malformedFileCount: 1 };
function detail() {
  return { decision: { decisionId: 'correction-decision', expectedTrackCount: 1, matchedTrackCount: 0, missingTrackCount: 1,
    release: { artistName: 'Correction Artist', title: 'Correction Album' },
    requestedFor: { id: 'listener', username: 'Listener', accountStatus: 'active' },
    state: 'searching', status: { code: 'retrying_search', label: 'Waiting to search', message: 'Waiting for automatic cooldown.', tone: 'info' } },
  searchDiagnostics: counts, permissions: { canReviewIgnoredSources: true, canReviewProviderConnection: true, isReadOnly: false } };
}
async function installDetail(browserContext, state) {
  await browserContext.route('**/api/v1/missing-music/decisions**', route => {
    const url = new URL(route.request().url());
    return route.fulfill({ json: url.pathname.endsWith('/correction-decision') ? { ok: true, ...state.detail }
      : { ok: true, decisions: [state.detail.decision], users: [], filters: { state: 'searching' }, page: { total: 1, limit: 50 }, scope: 'mine' } });
  });
}
const diagnostic = page => page.getByRole('region', { name: 'Last recorded search', exact: true });
suite('role-aware Missing Music search correction review', () => {
  before(async () => { runtime = await createBrowserSmokeRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('administrator keyboard links reach actual review pages without policy/search mutation and Refresh revokes them', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const state = { detail: detail() }; await installDetail(browserContext, state);
      const mutations = [];
      page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.method()); });
      await page.goto(`${baseUrl}/app/missing/correction-decision`, { waitUntil: 'domcontentloaded' });
      const section = diagnostic(page); await section.waitFor();
      await mkdir('.tmp/search-corrections-2026-10-20', { recursive: true });
      for (const [width, theme] of [[390, 'light'], [800, 'dark'], [1280, 'light']]) {
        await page.setViewportSize({ width, height: 1100 });
        await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
        assert.equal(await section.evaluate(element => element.scrollWidth <= element.clientWidth), true);
        const link = section.getByRole('link', { name: 'Review ignored sources', exact: true });
        const box = await link.boundingBox(); assert.ok(box.height >= 44);
        await section.screenshot({ path: `.tmp/search-corrections-2026-10-20/corrections-${width}-${theme}.png`, animations: 'disabled' });
        if (width === 390) {
          await page.screenshot({ path: '.tmp/search-corrections-2026-10-20/mobile-page.png', fullPage: true, animations: 'disabled' });
          await writeFile('.tmp/search-corrections-2026-10-20/mobile-bounds.json', JSON.stringify(await section.evaluate(element => {
            const rows = [];
            for (let current = element; current; current = current.parentElement) {
              const rect = current.getBoundingClientRect(); const style = globalThis.getComputedStyle(current);
              rows.push({ tag: current.tagName, class: current.className, x: rect.x, width: rect.width, scrollLeft: current.scrollLeft, overflow: style.overflow });
            }
            return rows;
          }), null, 2));
          const bounds = await section.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
        }
      }
      const ignored = section.getByRole('link', { name: 'Review ignored sources', exact: true });
      await ignored.focus(); await ignored.press('Tab');
      const provider = section.getByRole('link', { name: 'Review provider connection', exact: true });
      await assertLocatorFocused(provider); await assertVisibleFocusOutline(provider);
      await provider.press('Shift+Tab'); await assertLocatorFocused(ignored); await assertVisibleFocusOutline(ignored);
      await ignored.press('Enter'); await page.waitForURL('**/app/activity/ignored?returnTo=missing_music_decision&returnReleaseId=correction-decision');
      await page.getByRole('heading', { name: 'Ignored source users', exact: true }).waitFor();
      await page.goBack(); await section.waitFor();
      await section.getByRole('link', { name: 'Review provider connection', exact: true }).press('Enter');
      await page.waitForURL('**/app/settings/connections?returnTo=missing_music_decision&returnReleaseId=correction-decision');
      await page.getByRole('heading', { name: 'Soulseek downloads', exact: true }).waitFor();
      await page.goBack(); await section.waitFor();
      state.detail.permissions = { isReadOnly: false };
      const refresh = page.locator('.hx-page-header').getByRole('button', { name: 'Refresh', exact: true });
      await refresh.focus(); await refresh.press('Enter');
      await section.getByText(/Ask a household administrator to review the ignored sources/).waitFor();
      assert.equal(await section.getByRole('link').count(), 0); await assertLocatorFocused(refresh);
      state.detail = detail(); state.detail.decision.requestedFor.accountStatus = 'disabled';
      state.detail.permissions.isReadOnly = true;
      await refresh.press('Enter'); await section.getByText(/Search corrections are unavailable here/).waitFor();
      assert.equal(await section.getByRole('link').count(), 0); assert.deepEqual(mutations, []);
    }, { scenarioName: 'missing_music_correction_destinations' });
  });
  test('requester and operator see administrator guidance without inaccessible correction links', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async ({ baseUrl, browserContext, page, client, getPoolFn }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' });
      const state = { detail: detail() }; state.detail.permissions = { isReadOnly: false };
      await installDetail(browserContext, state);
      for (const role of ['requester', 'operator']) {
        const created = await client.requestJson('/api/v1/users', { method: 'POST', json: { username: `correction-${role}`, password: 'CorrectionPass123!', role } });
        assert.equal(created.response.status, 201);
        await getPoolFn().query('UPDATE app_users SET must_change_password=false WHERE id=$1', [created.payload.user.id]);
        await logoutThroughUi(page); await loginThroughUi(page, { baseUrl, username: `correction-${role}`, password: 'CorrectionPass123!' });
        await page.goto(`${baseUrl}/app/missing/correction-decision`, { waitUntil: 'domcontentloaded' });
        const section = diagnostic(page); await section.getByText(/Ask a household administrator to review the ignored sources/).waitFor();
        assert.equal(await section.getByRole('link').count(), 0);
        assert.equal(await section.getByText(/Ask a household administrator to review the provider response issues/).count(), 1);
      }
    }, { scenarioName: 'missing_music_correction_roles' });
  });
});
