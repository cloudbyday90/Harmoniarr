import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { createMetadataCommandFixture, metadataCommandIds as id } from '../../testing/browser/metadata-command-fixture.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const evidence = '.tmp/metadata-history-presentation-2026-10-21';
const config = resolveIntegrationTestRuntimeConfig();
const instant = '2026-10-21T00:00:00.000Z';
const literalTitle = '<img src=x onerror="window.historyPresentationInjected=true"> Long discovery ' + 'A'.repeat(100);
const entries = [
  { id: 'one', title: 'Linked discovery', primaryType: 'Album', occurredAt: instant, monitoringDecision: 'already_satisfied', resultingWantedStatus: 'none', metadataReleaseGroupId: id.group },
  { id: 'two', title: literalTitle, primaryType: '', occurredAt: null, monitoringDecision: 'ignored_release_type', resultingWantedStatus: 'partial' },
  { id: 'three', title: 'Invalid timestamp discovery', occurredAt: '2026-02-30T00:00:00.000Z', monitoringDecision: 'wanted_release_detected', resultingWantedStatus: 'missing' },
];
const fixture = createMetadataCommandFixture({
  history: { entries, pageInfo: { hasMore: false, nextCursor: null }, readPage: async () => { throw new Error('Unexpected history page'); } },
  monitoring: { isMonitored: false, lastRefreshedAt: instant, nextRefreshAt: '2026-10-22T01:02:03+02:00' },
});
let runtime;

suite('Metadata history entry presentation', () => {
  before(async () => { runtime = await createBrowserSmokeRuntime({ config, createAppFn: fixture.createAppFn }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('labels each history detail, preserves time identity and wraps literal provider text', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async ({ baseUrl, page }) => {
      try {
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await bootstrapAdminThroughUi(page, { baseUrl });
        await page.goto(`${baseUrl}/app/settings/library-browser?artistId=${id.artist}`, { waitUntil: 'domcontentloaded' });
        await page.getByText('Linked discovery', { exact: true }).waitFor();
        const item = page.getByRole('listitem').filter({ has: page.getByText('Linked discovery', { exact: true }) });
        assert.deepEqual(await item.locator('dt').allTextContents(), ['Release type', 'Detected', 'Monitoring decision', 'Wanted state']);
        assert.deepEqual(await item.locator('dd').allTextContents().then(values => [values[0], values[2], values[3]]), ['Album', 'Catalog already has this release — no action needed.', 'None']);
        const time = item.locator('time'); assert.equal(await time.getAttribute('datetime'), instant);
        assert.notEqual(await time.textContent(), instant);
        const offset = await page.evaluate(value => new Intl.DateTimeFormat(undefined, { timeZoneName: 'shortOffset' }).formatToParts(new Date(value)).find(part => part.type === 'timeZoneName').value, instant);
        assert.ok((await time.textContent()).includes(offset));
        const last = page.getByText('Last refresh', { exact: true }).locator('..').locator('time');
        const next = page.getByText('Next refresh', { exact: true }).locator('..').locator('time');
        assert.equal(await last.getAttribute('datetime'), instant); assert.equal(await last.textContent(), await time.textContent());
        assert.equal(await next.getAttribute('datetime'), '2026-10-21T23:02:03.000Z');
        const unknown = page.getByRole('listitem').filter({ has: page.getByText(literalTitle, { exact: true }) });
        const invalid = page.getByRole('listitem').filter({ has: page.getByText('Invalid timestamp discovery', { exact: true }) });
        for (const fallback of [unknown, invalid]) { assert.equal(await fallback.locator('time').count(), 0); assert.equal(await fallback.getByText('Not recorded', { exact: true }).count(), 1); }
        assert.equal(await unknown.getByText('Unknown type', { exact: true }).count(), 1);
        assert.equal(await unknown.locator('img').count(), 0); assert.equal(await page.evaluate(() => globalThis.historyPresentationInjected), undefined);
        await mkdir(evidence, { recursive: true });
        for (const width of [390, 768, 1280]) for (const theme of ['light', 'dark']) {
          await page.setViewportSize({ width, height: 1000 });
          await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
          for (const policyTime of [last, next]) {
            assert.equal(await policyTime.locator('../..').evaluate(node => {
              const term = node.querySelector('dt').getBoundingClientRect(); const detail = node.querySelector('dd').getBoundingClientRect();
              return detail.top >= term.bottom && detail.right <= node.getBoundingClientRect().right + 1;
            }), true, 'policy timestamps need the full card width below their label');
          }
          await last.scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${evidence}/policy-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
          await item.scrollIntoViewIfNeeded();
          for (const entry of [item, unknown, invalid]) {
            assert.equal(await entry.evaluate(node => node.scrollWidth <= node.clientWidth), true, 'history entry must not overflow horizontally');
            const layout = await entry.evaluate(node => [...node.querySelectorAll('dl > div')].map(row => {
              const term = row.querySelector('dt').getBoundingClientRect(); const detail = row.querySelector('dd').getBoundingClientRect();
              return { separated: detail.top >= term.bottom, contained: detail.right <= node.getBoundingClientRect().right + 1, wraps: row.scrollWidth <= row.clientWidth };
            }));
            assert.equal(layout.length, 4); for (const row of layout) assert.deepEqual(row, { separated: true, contained: true, wraps: true });
          }
          await page.screenshot({ path: `${evidence}/history-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
        }
        const link = item.getByRole('link', { name: 'Open release group', exact: true });
        await link.press('Enter');
        await page.waitForURL(url => url.searchParams.get('releaseGroupId') === id.group);
        await page.locator('article').filter({ has: page.getByText('Selected release group', { exact: true }) }).getByRole('heading', { name: 'Saved group', exact: true }).waitFor();
        assert.deepEqual(fixture.calls, []); assert.deepEqual(errors, []);
      } catch (error) {
        try { await mkdir(evidence, { recursive: true }); await page.screenshot({ path: `${evidence}/presentation-failure.png`, timeout: 5000 }); } catch { /* Preserve the original assertion. */ }
        throw error;
      }
    }, { scenarioName: 'metadata_history_presentation' });
  });
});
