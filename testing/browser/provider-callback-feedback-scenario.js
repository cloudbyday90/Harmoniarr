/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';

export async function runProviderCallbackFeedbackScenario({ page, browserContext, baseUrl, evidenceDir }) {
  let mode = 'absent', reads = 0, blockedWrites = 0, nextHold;
  const holds = new Set(), results = [], screenshots = [], errors = [];
  const json = (body, status = 200) => ({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(body) });
  const onError = error => errors.push(error.name);
  const guard = async route => { if (!['GET', 'HEAD'].includes(route.request().method())) { blockedWrites++; await route.abort('blockedbyclient'); } else await route.continue(); };
  const statuses = async route => {
    assert.equal(route.request().method(), 'GET'); reads++;
    const hold = nextHold; nextHold = null;
    if (hold) { hold.started.resolve(); await hold.promise; holds.delete(hold); }
    const body = Object.fromEntries(['spotify', 'youtube', 'plex'].map(provider => [provider, { linked: mode === 'present', ...(mode === 'unavailable' ? { availability: 'unavailable' } : {}) }]));
    body.statusSummary = { state: mode === 'unavailable' ? 'unavailable' : 'complete', unavailableProviders: mode === 'unavailable' ? ['spotify', 'youtube', 'plex'] : [] };
    await route.fulfill(mode === 'failure' ? json({ ok: false, error: { code: 'PRIVATE', message: 'PRIVATE response /data/key.pem' } }, 503) : json(body));
  };
  const panel = page.locator('.hx-provider-callback-feedback'), status = panel.getByRole('status');
  const button = panel.getByRole('button', { name: /^(?:Check saved status|Checking saved status…)$/u });
  const clean = () => page.waitForFunction(() => !['spotifyOAuth', 'youtubeOAuth', 'plexOAuth', 'code', 'state', 'error', 'error_description'].some(key => new URL(globalThis.location.href).searchParams.has(key)));
  const open = query => page.goto(baseUrl + '/app/settings' + query, { waitUntil: 'domcontentloaded' });
  const held = () => { const hold = Object.assign(Promise.withResolvers(), { started: Promise.withResolvers() }); holds.add(hold); nextHold = hold; return hold; };
  const frames = () => page.evaluate(() => new Promise(resolve => { globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)); }));
  page.on('pageerror', onError);
  await browserContext.addInitScript(() => { globalThis.__callbackHistoryLength = globalThis.history.length; });
  await browserContext.route('**/api/v1/**', guard);
  await browserContext.route('**/api/v1/providers/status', statuses);
  try {
    await open(''); await page.getByRole('heading', { name: 'Setup readiness', exact: true }).waitFor();
    assert.equal(await status.textContent(), ' '); assert.equal(reads, 0); results.push('ordinary-settings-no-callback-read');
    const first = held(); await open('?spotifyOAuth=linked&code=PRIVATE&state=PRIVATE&error=PRIVATE&error_description=PRIVATE&keep=retained#settings-setup-title');
    await first.started.promise; await clean(); await status.filter({ hasText: 'Checking saved Spotify link…' }).waitFor();
    assert.equal(await status.getAttribute('aria-atomic'), 'true'); assert.equal(await status.getAttribute('aria-busy'), null);
    assert.equal(new URL(page.url()).searchParams.get('keep'), 'retained'); assert.equal(new URL(page.url()).hash, '#settings-setup-title');
    assert.equal(await page.evaluate(() => globalThis.history.length === globalThis.__callbackHistoryLength), true);
    await button.focus(); assert.equal(await button.evaluate(node => node.disabled), false); assert.equal(await button.getAttribute('aria-disabled'), 'true');
    const count = reads; await page.keyboard.press('Enter'); await page.keyboard.press('Space'); await button.evaluate(node => node.click()); await frames(); assert.equal(reads, count);
    first.resolve(); await status.filter({ hasText: 'Last check found no saved Spotify link.' }).waitFor();
    assert.equal(await button.evaluate(node => node === globalThis.document.activeElement), true); assert.doesNotMatch(await panel.innerText(), /PRIVATE|key\.pem/u);
    results.push('forged-success-saved-absence-cleanup-history-and-pending-guard');
    mode = 'failure'; await button.click(); await status.filter({ hasText: 'could not be checked' }).waitFor();
    assert.equal(await button.evaluate(node => node === globalThis.document.activeElement), true); assert.doesNotMatch(await panel.innerText(), /PRIVATE|key\.pem/u); results.push('bounded-read-failure-focus');
    for (const theme of ['light', 'dark']) for (const [label, width, height] of [['desktop', 1440, 900], ['tablet', 800, 900], ['mobile', 390, 844]]) {
      await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme); await page.setViewportSize({ width, height });
      await panel.scrollIntoViewIfNeeded(); assert.equal(await panel.evaluate(node => node.scrollWidth <= node.clientWidth), true);
      assert.ok((await button.boundingBox()).height >= 44);
      if (evidenceDir) { const name = 'callback-feedback-' + theme + '-' + label + '.png'; await panel.screenshot({ path: join(evidenceDir, name), animations: 'disabled' }); screenshots.push(name); }
    }
    results.push('three-breakpoints-both-themes-no-overflow');
    mode = 'present'; const retry = held(); await button.click(); await retry.started.promise;
    const other = panel.getByRole('link', { name: 'Review Connections', exact: true }); await other.focus(); retry.resolve();
    await status.filter({ hasText: 'Last check found a saved Spotify link.' }).waitFor(); assert.equal(await other.evaluate(node => node === globalThis.document.activeElement), true); results.push('explicit-retry-server-observation-user-focus-preserved');
    const beforeReload = reads; await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('heading', { name: 'Setup readiness', exact: true }).waitFor();
    assert.equal(await status.textContent(), ' '); assert.equal(reads, beforeReload); results.push('clean-reload-no-callback-replay');
    mode = 'unavailable'; await open('?youtubeOAuth=failed&code=youtube_client_secret_required'); await clean();
    await status.filter({ hasText: 'Saved YouTube link could not be checked.' }).waitFor(); assert.match(await status.innerText(), /Review the saved provider credentials/u); results.push('configuration-guidance-unavailable-is-unknown');
    mode = 'absent'; await open('?plexOAuth=failed&code=plex_link_restricted_account'); await clean();
    await status.filter({ hasText: 'Last check found no saved Plex link.' }).waitFor(); assert.match(await status.innerText(), /unrestricted Plex owner/u); results.push('plex-owner-guidance');
    for (const query of ['?spotifyOAuth=linked&spotifyOAuth=failed&code=PRIVATE', '?youtubeOAuth=PRIVATE&error=PRIVATE', '?plexOAuth=linked&youtubeOAuth=failed&code=PRIVATE']) {
      const before = reads; await open(query); await clean(); await status.filter({ hasText: 'Provider linking needs review.' }).waitFor();
      assert.equal(reads, before); assert.equal(await button.count(), 0); assert.doesNotMatch(await panel.innerText(), /PRIVATE/u);
    }
    results.push('ambiguous-duplicate-unknown-hints-no-read');
    assert.equal(blockedWrites, 0); assert.deepEqual(errors, []);
    return { results, screenshots, reads, blockedWrites, pageErrors: errors, noOverflow: true, focusPreserved: true, duplicateGuard: true, userFocusPreserved: true, historyReplaced: true, noQueryEcho: true, noAutomaticLinking: true };
  } finally {
    for (const hold of holds) hold.resolve(); page.off('pageerror', onError);
    await browserContext.unroute('**/api/v1/providers/status', statuses); await browserContext.unroute('**/api/v1/**', guard);
  }
}
