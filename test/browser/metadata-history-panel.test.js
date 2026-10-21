import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { createMetadataCommandFixture, metadataCommandIds as id } from '../../testing/browser/metadata-command-fixture.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { assertLocatorFocused } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const evidence = '.tmp/metadata-history-panel-2026-10-21';
const config = resolveIntegrationTestRuntimeConfig();
const event = title => ({ id: title, title, primaryType: 'Album', occurredAt: '2026-10-21T00:00:00.000Z', monitoringDecision: 'already_satisfied', resultingWantedStatus: 'none' });
const entries = [];
const pageInfo = { hasMore: true, nextCursor: 'initial-cursor' };
let reads = [];
const fixture = createMetadataCommandFixture({ history: {
  entries, pageInfo,
  readPage: async args => { reads.push(args); return { entries: [event('Final discovery')], pageInfo: { hasMore: false, nextCursor: null } }; },
} });
let runtime;

async function prepare({ baseUrl, page }, { empty = false } = {}) {
  entries.splice(0, entries.length, ...(empty ? [] : Array.from({ length: 10 }, (_, index) => event(`Discovery ${index + 1}`))));
  Object.assign(pageInfo, { hasMore: !empty, nextCursor: empty ? null : 'initial-cursor' }); reads = [];
  await bootstrapAdminThroughUi(page, { baseUrl });
  await page.goto(`${baseUrl}/app/settings/library-browser?artistId=${id.artist}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Fixture artist', exact: true }).waitFor();
}

async function scenario(callback, name) {
  return runtime.runScenario(async context => {
    try { return await callback(context); }
    catch (error) {
      try { await mkdir(evidence, { recursive: true }); await context.page.screenshot({ path: `${evidence}/${name}-failure.png`, timeout: 5000 }); } catch { /* Preserve the original assertion. */ }
      throw error;
    }
  }, { scenarioName: name });
}

suite('Metadata history panel is independent of finite summary cards', () => {
  before(async () => { runtime = await createBrowserSmokeRuntime({ config, createAppFn: fixture.createAppFn }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('long history is a full-width sibling and append does not stretch the summary', { timeout: config.scenarioTimeoutMs }, async () => {
    await scenario(async context => {
      await prepare(context); const { page } = context;
      const heading = page.getByRole('heading', { name: 'Recent discoveries', exact: true });
      const summary = page.getByRole('heading', { name: 'Fixture artist', exact: true }).locator('../..');
      const headingNode = await heading.elementHandle();
      assert.equal(await summary.evaluate((node, target) => node.contains(target), headingNode), false, 'growing history must not be inside the finite summary');
      await headingNode.dispose();
      const panel = page.getByRole('region', { name: 'Recent discoveries', exact: true });
      assert.equal(await page.getByRole('region', { name: 'Artist summary', exact: true }).count(), 1);
      const headingId = await heading.getAttribute('id');
      assert.equal(await panel.getAttribute('aria-labelledby'), headingId);
      assert.equal(await page.evaluate(value => [...globalThis.document.querySelectorAll('[id]')].filter(node => node.id === value).length, headingId), 1);
      assert.equal(await heading.getAttribute('tabindex'), '-1');
      const structure = await panel.evaluate(node => ({ tag: node.tagName, previous: node.previousElementSibling.getAttribute('aria-label') }));
      assert.deepEqual(structure, { tag: 'SECTION', previous: 'Artist summary' });
      await mkdir(evidence, { recursive: true });
      for (const width of [320, 390, 768, 1280]) for (const theme of ['light', 'dark']) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
        const geometry = await panel.evaluate(node => {
          const prior = node.previousElementSibling; const history = node.getBoundingClientRect(); const finite = prior.getBoundingClientRect();
          return { below: history.top >= finite.bottom, sameLeft: Math.abs(history.left - finite.left) <= 1, sameWidth: Math.abs(history.width - finite.width) <= 1,
            historyFits: node.scrollWidth <= node.clientWidth, summaryFits: prior.scrollWidth <= prior.clientWidth,
            cards: [...prior.children].map(card => { const box = card.getBoundingClientRect(); return { top: box.top, left: box.left, width: box.width, height: box.height }; }) };
        });
        for (const key of ['below', 'sameLeft', 'sameWidth', 'historyFits', 'summaryFits']) assert.equal(geometry[key], true, `${width}/${theme}: ${key}`);
        assert.equal(geometry.cards.length, 3);
        assert.ok(geometry.cards.every(card => card.height < 600), 'summary cards must retain finite content height');
        if (width > 960) { assert.ok(geometry.cards.every(card => Math.abs(card.top - geometry.cards[0].top) <= 1)); assert.ok(geometry.cards[1].left > geometry.cards[0].left && geometry.cards[2].left > geometry.cards[1].left); }
        else if (width > 640) { assert.ok(Math.abs(geometry.cards[0].top - geometry.cards[1].top) <= 1); assert.ok(geometry.cards[2].top > geometry.cards[0].top); }
        else assert.ok(geometry.cards[1].top > geometry.cards[0].top && geometry.cards[2].top > geometry.cards[1].top);
        await page.getByRole('heading', { name: 'Fixture artist', exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${evidence}/summary-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
        await heading.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${evidence}/history-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
      }
      const summaryBeforeAppend = await summary.boundingBox(); const status = panel.getByRole('status', { name: 'Detection history status', exact: true });
      const statusNode = await status.elementHandle();
      await panel.getByRole('button', { name: 'Load more history', exact: true }).press('Enter');
      await panel.getByText('Final discovery', { exact: true }).waitFor(); await assertLocatorFocused(heading);
      assert.equal(await heading.getAttribute('id'), headingId);
      assert.equal((await summary.boundingBox()).height, summaryBeforeAppend.height);
      assert.equal(await panel.getByRole('listitem').count(), 11);
      assert.equal(await status.evaluate((node, original) => node === original, statusNode), true); await statusNode.dispose();
      assert.equal(await status.textContent(), 'Loaded 1 more history entry. All history loaded.');
      assert.equal(reads.length, 1); assert.equal(reads[0].before, 'initial-cursor'); assert.equal(reads[0].limit, 10);
      assert.deepEqual(fixture.calls, []);
    }, 'metadata_history_panel_long');
  });

  test('an empty history keeps its named section and stable silent status without a paging action', { timeout: config.scenarioTimeoutMs }, async () => {
    await scenario(async context => {
      await prepare(context, { empty: true }); const { page } = context;
      const panel = page.getByRole('region', { name: 'Recent discoveries', exact: true });
      await panel.getByText('No release detections have been recorded for this artist yet.', { exact: true }).waitFor();
      const heading = panel.getByRole('heading', { name: 'Recent discoveries', exact: true });
      assert.equal(await panel.getAttribute('aria-labelledby'), await heading.getAttribute('id'));
      const status = panel.getByRole('status', { name: 'Detection history status', exact: true });
      assert.equal(await status.textContent(), ''); assert.equal(await status.getAttribute('aria-live'), 'polite'); assert.equal(await status.getAttribute('aria-atomic'), 'true');
      assert.equal(await panel.getByRole('list').count(), 0); assert.equal(await panel.getByRole('button').count(), 0);
      assert.equal(await page.getByRole('region', { name: 'Artist summary', exact: true }).locator('article').count(), 3);
      assert.deepEqual(reads, []); assert.deepEqual(fixture.calls, []);
    }, 'metadata_history_panel_empty');
  });
});
