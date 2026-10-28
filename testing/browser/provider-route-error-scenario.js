/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';

/** Built views with read-only controlled provider responses; no mutation reaches the server. */
export async function runProviderRouteErrorScenario({ page, browserContext, baseUrl, evidenceDir }) {
  const json = (payload, status = 200) => ({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(payload) });
  const failure = (code, message, status) => json({ ok: false, error: { code, message } }, status);
  const queue = { ok: true, downloader: { observedAt: new Date().toISOString(), provider: 'slskd', queueHealth: { counts: { active: 0, completed: 0, failed: 0, other: 0, queued: 0, total: 0 }, status: 'idle', message: 'No transfers are currently visible.', progress: { bytesTransferred: null, percentComplete: null, size: null } }, sourceGroups: [], transfers: [], truncated: false } };
  const results = [], screenshots = [], errors = [], holds = new Set();
  let blockedWrites = 0, artworkFixtures = 0, downloadMode = 'misconfigured', searchMode = 'misconfigured', queueReads = 0, searchReads = 0, heldRead = null;
  const onError = error => errors.push(error.name); page.on('pageerror', onError);
  const guard = async route => { if (!['GET', 'HEAD'].includes(route.request().method())) { blockedWrites++; await route.abort('blockedbyclient'); } else await route.continue(); };
  // Populated walkthrough data requests artwork even though this scenario never edits it.
  // Fulfill the exact read endpoint locally; no POST is allowed through to the server.
  const artwork = async route => {
    if (route.request().method() !== 'POST') { await guard(route); return; }
    artworkFixtures++;
    await route.fulfill(json({ resolved: {} }));
  };
  const artworkPath = /\/api\/v1\/artwork\/resolve-batch(?:\?.*)?$/u;
  const downloads = async route => {
    assert.equal(route.request().method(), 'GET'); queueReads++;
    const hold = heldRead; heldRead = null;
    if (hold) { hold.started.resolve(); await hold.promise; holds.delete(hold); }
    const payload = downloadMode === 'success' ? json(queue) : downloadMode === 'disabled' ? json({ ...queue, downloader: { ...queue.downloader, providerState: { enabled: false }, queueHealth: { ...queue.downloader.queueHealth, status: 'disabled' } } })
      : downloadMode === 'misconfigured' ? failure('slskd_misconfigured', 'Soulseek connection settings need review', 503) : failure('slskd_request_failed', 'Soulseek request failed. Try again.', 502);
    await route.fulfill(payload);
  };
  const searchResults = async route => {
    assert.equal(route.request().method(), 'GET'); searchReads++;
    await route.fulfill(searchMode === 'success' ? json({ provider: 'musicbrainz', search: { results: [] } }) : failure('musicbrainz_misconfigured', 'MusicBrainz configuration needs review', 503));
  };
  const holdRead = () => { const hold = Object.assign(Promise.withResolvers(), { started: Promise.withResolvers() }); holds.add(hold); heldRead = hold; return hold; };
  const flushFrames = () => page.evaluate(() => new Promise(resolve => { globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)); }));
  const pictures = async (locator, prefix) => {
    for (const [label, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
      await page.setViewportSize({ width, height }); await locator.scrollIntoViewIfNeeded();
      assert.equal(await locator.evaluate(node => node.scrollWidth <= node.clientWidth), true);
      if (evidenceDir) { const name = prefix + '-' + label + '.png'; await locator.screenshot({ path: join(evidenceDir, name), animations: 'disabled' }); screenshots.push(name); }
    }
  };
  await browserContext.route('**/api/v1/**', guard);
  await browserContext.route(artworkPath, artwork);
  await browserContext.route('**/api/v1/downloader/queue*', downloads);
  await browserContext.route('**/api/v1/metadata/musicbrainz/artists/search?*', searchResults);
  try {
    await page.goto(baseUrl + '/app/downloader', { waitUntil: 'domcontentloaded' });
    await page.getByRole('status').filter({ hasText: 'Soulseek connection settings need review' }).waitFor(); results.push('downloader-configuration-guidance');
    const refresh = page.locator('.downloader-page .hx-page-actions button').filter({ hasText: /^(?:Refresh|Loading…)$/u });
    downloadMode = 'request'; const initial = holdRead(); await refresh.click(); await initial.started.promise;
    assert.equal(await refresh.getAttribute('aria-disabled'), 'true'); assert.equal(await refresh.evaluate(node => node.disabled), false);
    assert.equal(await refresh.evaluate(node => node === globalThis.document.activeElement), true);
    let count = queueReads; await page.keyboard.press('Enter'); await page.keyboard.press('Space'); await refresh.evaluate(node => node.click()); await flushFrames(); assert.equal(queueReads, count);
    results.push('pending-initial-refresh-focus-and-duplicate-guard'); initial.resolve();
    const status = page.getByRole('status').filter({ hasText: 'Soulseek request failed. Try again.' }); await status.waitFor();
    assert.equal(await refresh.evaluate(node => node === globalThis.document.activeElement), true);
    await pictures(status, 'soulseek-failure'); results.push('downloader-request-failure-focus');
    downloadMode = 'success'; await refresh.click(); await page.getByText('Nothing downloading right now', { exact: true }).waitFor();
    assert.equal(await page.getByRole('status').filter({ hasText: 'Soulseek request failed. Try again.' }).count(), 0); results.push('downloader-success-recovery');
    const revalidation = holdRead(); await refresh.click(); await revalidation.started.promise;
    assert.equal(await refresh.getAttribute('aria-disabled'), 'true'); count = queueReads;
    await page.keyboard.press('Enter'); await page.keyboard.press('Space'); await refresh.evaluate(node => node.click()); await flushFrames(); assert.equal(queueReads, count);
    const otherFocus = page.getByRole('button', { name: 'Open menu', exact: true }); await otherFocus.focus(); revalidation.resolve();
    await page.waitForFunction(() => globalThis.document.querySelector('.downloader-page .hx-page-actions button:last-child')?.getAttribute('aria-disabled') === 'false');
    assert.equal(await otherFocus.evaluate(node => node === globalThis.document.activeElement), true); results.push('revalidation-duplicate-guard-and-user-focus-preserved');
    downloadMode = 'disabled'; await refresh.click();
    await page.waitForFunction(() => globalThis.document.querySelector('.downloader-page .hx-page-actions button:last-child')?.disabled === true);
    assert.equal(await refresh.evaluate(node => node.disabled), true); count = queueReads; await refresh.dispatchEvent('click'); await flushFrames(); assert.equal(queueReads, count); results.push('disabled-provider-native-and-handler-guard');
    await page.goto(baseUrl + '/app/discover', { waitUntil: 'domcontentloaded' });
    const search = page.locator('#discover-query'); await search.fill('Fixture Artist');
    const title = 'Artist search is temporarily unavailable. Try again in a moment.';
    await page.getByRole('heading', { name: title, exact: true }).waitFor(); assert.equal(await search.evaluate(node => node === globalThis.document.activeElement), true);
    await pictures(page.locator('.hx-empty').filter({ has: page.getByRole('heading', { name: title, exact: true }) }), 'artist-search-failure'); results.push('discover-friendly-provider-failure-focus');
    searchMode = 'success'; await search.fill('Fixture Artist Recovery'); await page.getByRole('heading', { name: 'No artists found', exact: true }).waitFor(); results.push('discover-success-recovery');
    assert.equal(blockedWrites, 0); assert.deepEqual(errors, []);
    return { results, screenshots, blockedWrites, artworkFixtures, queueReads, searchReads, focusPreserved: true, duplicateGuard: true, userFocusPreserved: true, providerDisabledGuard: true, noOverflow: true, pageErrors: errors };
  } finally {
    for (const hold of holds) hold.resolve();
    page.off('pageerror', onError);
    await browserContext.unroute('**/api/v1/metadata/musicbrainz/artists/search?*', searchResults);
    await browserContext.unroute('**/api/v1/downloader/queue*', downloads);
    await browserContext.unroute(artworkPath, artwork);
    await browserContext.unroute('**/api/v1/**', guard);
  }
}
