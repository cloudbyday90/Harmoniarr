/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';

export async function runProviderAuthorizationStatusScenario({ page, browserContext, baseUrl, evidenceDir }) {
  const results = [], requests = [], screenshots = [], errors = [], holds = new Set();
  const [savedResponse, sessionResponse] = await Promise.all([page.request.get(baseUrl + '/api/v1/settings'), page.request.get(baseUrl + '/api/v1/auth/session')]);
  assert.equal(savedResponse.status(), 200); assert.equal(sessionResponse.status(), 200);
  const saved = await savedResponse.json(), session = await sessionResponse.json(), linked = { spotify: true, youtube: true };
  let sessionValid = true, statusAvailable = true, blockedWrites = 0, nextSession, nextStatus;
  const json = (body, status = 200) => ({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(body) });
  const hold = kind => { const value = Object.assign(Promise.withResolvers(), { started: Promise.withResolvers(), finished: Promise.withResolvers() }); holds.add(value); if (kind === 'session') nextSession = value; else nextStatus = value; return value; };
  const settle = async (route, body, pending) => {
    if (pending) { pending.started.resolve(); await pending.promise; holds.delete(pending); }
    try { await route.fulfill(json(body)); }
    catch (error) { if (!pending) throw error; /* An invalidated GET may already be aborted. */ }
    finally { pending?.finished.resolve(); }
  };
  const guard = async route => { if (!['GET', 'HEAD'].includes(route.request().method())) { blockedWrites++; await route.abort('blockedbyclient'); } else await route.continue(); };
  const settings = async route => {
    assert.equal(route.request().method(), 'GET');
    await route.fulfill(json({ ...saved, secretStatus: { ...saved.secretStatus, providers: { ...saved.secretStatus?.providers, spotifyOAuth: { linked: linked.spotify }, youtubeOAuth: { linked: linked.youtube } } } }));
  };
  const sessionRead = async route => {
    assert.equal(route.request().method(), 'GET'); requests.push({ kind: 'session', method: 'GET' });
    const pending = nextSession; nextSession = null;
    await settle(route, sessionValid ? session : { ok: true, user: null }, pending);
  };
  const statusRead = async route => {
    assert.equal(route.request().method(), 'GET'); requests.push({ kind: 'status', method: 'GET' });
    const pending = nextStatus; nextStatus = null;
    await settle(route, { spotify: { linked: linked.spotify, privateDetail: 'PRIVATE' }, youtube: { linked: linked.youtube },
      statusSummary: { state: statusAvailable ? 'complete' : 'partial', unavailableProviders: statusAvailable ? [] : ['spotify'] } }, pending);
  };
  const commandPath = /\/api\/v1\/providers\/(spotify|youtube)\/oauth\/(start|clear)$/u;
  const command = async route => {
    const request = route.request(), [, provider, kind] = new URL(request.url()).pathname.match(commandPath);
    assert.equal(request.method(), 'POST'); assert.equal(request.postData(), null);
    const csrf = (await browserContext.cookies(baseUrl)).find(cookie => cookie.name === 'harmoniarr_csrf')?.value;
    assert.equal(typeof csrf === 'string' && csrf.length > 0 && request.headers()['x-csrf-token'] === csrf, true, 'Current CSRF contract must accompany the command');
    requests.push({ kind: 'command', provider, action: kind, method: 'POST', csrfPreserved: true });
    if (kind === 'clear') { linked[provider] = false; await route.fulfill(json({ status: { linked: false } })); }
    else await route.fulfill(json({ error: { code: 'PRIVATE', message: 'PRIVATE command /data/key.pem' } }, 503));
  };
  const card = name => page.locator('.cfg-provider-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
  const spotifyStart = card('Spotify').getByRole('button', { name: 'Connect Spotify', exact: true });
  const youtubeClear = card('YouTube').getByRole('button', { name: 'Clear authorization', exact: true });
  const feedback = page.locator('.hx-authorization-status__feedback'), commandFeedback = page.locator('.settings-connections__authorization-feedback');
  const retry = page.locator('.hx-authorization-status button'), draft = card('Spotify').locator('.hx-input').first();
  const frame = () => page.evaluate(() => new Promise(resolve => { globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)); }));
  const count = kind => requests.filter(row => row.kind === kind).length;
  const onError = error => errors.push(error.name); page.on('pageerror', onError);
  const routes = [['**/api/v1/**', guard], ['**/api/v1/settings', settings], ['**/api/v1/auth/session', sessionRead], ['**/api/v1/providers/status', statusRead], [commandPath, command]];
  for (const [path, handler] of routes) await browserContext.route(path, handler);
  try {
    await page.goto(baseUrl + '/app/settings/connections', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Soulseek downloads', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Set up optional services', exact: true }).click(); await spotifyStart.waitFor();
    assert.equal(await feedback.getAttribute('role'), 'status'); assert.equal(await feedback.getAttribute('aria-atomic'), 'true');
    assert.equal((await feedback.textContent()).trim(), ''); assert.equal(await retry.count(), 0); results.push('persistent-empty-read-feedback');
    await draft.fill('UnsavedStatusFixture'); const beforeSession = count('session'), beforeInitialStatus = count('status'), first = hold('session');
    await spotifyStart.click(); await first.started.promise; await feedback.filter({ hasText: 'Checking saved Spotify link' }).waitFor();
    assert.equal(await spotifyStart.evaluate(node => node === globalThis.document.activeElement), true);
    for (let index = 0; index < 3; index++) await retry.evaluate(node => node.click());
    await retry.focus();
    await page.keyboard.press('Enter'); await page.keyboard.press('Space'); await frame();
    assert.equal(count('command'), 1); assert.equal(count('session'), beforeSession + 1); assert.equal(count('status'), beforeInitialStatus);
    assert.equal(await retry.evaluate(node => node === globalThis.document.activeElement), true);
    linked.spotify = false; const status = hold('status'); first.resolve(); await status.started.promise;
    assert.deepEqual(requests.slice(-2).map(row => row.kind), ['session', 'status']); status.resolve();
    await feedback.filter({ hasText: 'Last check found no saved Spotify link.' }).waitFor();
    assert.equal(await draft.inputValue(), 'UnsavedStatusFixture'); assert.equal(await card('Spotify').getByText('Not linked', { exact: true }).count(), 1);
    assert.match(await commandFeedback.innerText(), /could not be confirmed/u); assert.equal(count('command'), 1); results.push('ordered-current-session-status-read-preserves-draft-and-command-outcome');
    statusAvailable = false; await retry.click(); await feedback.filter({ hasText: 'could not be checked' }).waitFor();
    assert.equal(await retry.evaluate(node => node === globalThis.document.activeElement), true);
    assert.equal(await card('Spotify').getByText('Not linked', { exact: true }).count(), 1); results.push('partial-unavailable-preserves-older-observation-and-retry-focus');
    statusAvailable = true; linked.spotify = true; const recovered = hold('status'); await retry.click(); await recovered.started.promise;
    await draft.focus(); recovered.resolve(); await feedback.filter({ hasText: 'Last check found a saved Spotify link.' }).waitFor();
    assert.equal(await draft.evaluate(node => node === globalThis.document.activeElement), true); assert.equal(await draft.inputValue(), 'UnsavedStatusFixture'); results.push('explicit-read-recovery-does-not-steal-user-focus');
    sessionValid = false; const beforeStatus = count('status'); await retry.click(); await feedback.filter({ hasText: 'Current administrator session could not be confirmed.' }).waitFor();
    assert.equal(count('status'), beforeStatus);
    for (const button of await page.locator('.settings-connections__authorization-actions button').all()) { assert.equal(await button.getAttribute('aria-disabled'), 'true'); await button.evaluate(node => node.click()); }
    await frame(); assert.equal(count('command'), 1); assert.doesNotMatch(await feedback.innerText(), /PRIVATE|key\.pem/u);
    for (const theme of ['light', 'dark']) for (const [label, width, height] of [['desktop', 1440, 900], ['tablet', 800, 900], ['mobile', 390, 844]]) {
      await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme); await page.setViewportSize({ width, height });
      const panel = page.locator('.hx-authorization-status'); await panel.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })); await frame();
      assert.equal(await feedback.evaluate(node => node.scrollWidth <= node.clientWidth), true); assert.ok((await retry.boundingBox()).height >= 44);
      assert.equal(await retry.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(globalThis.document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true);
      if (evidenceDir) { const name = 'authorization-status-' + theme + '-' + label + '.png'; await panel.screenshot({ path: join(evidenceDir, name), animations: 'disabled' }); screenshots.push(name); }
    }
    results.push('session-refusal-blocks-provider-read-and-commands-with-responsive-fixed-guidance');
    sessionValid = true; await retry.click(); await feedback.filter({ hasText: 'Last check found a saved Spotify link.' }).waitFor();
    assert.equal(await spotifyStart.getAttribute('aria-disabled'), 'false'); results.push('explicit-check-recovers-current-session-admission');
    linked.spotify = false; const obsolete = hold('status'); await retry.click(); await obsolete.started.promise;
    await youtubeClear.click(); await commandFeedback.filter({ hasText: 'YouTube authorization cleared.' }).waitFor(); obsolete.resolve(); await obsolete.finished.promise; await frame();
    assert.equal((await feedback.textContent()).trim(), ''); assert.equal(await card('Spotify').getByText('Linked', { exact: true }).count(), 1);
    assert.equal(await youtubeClear.evaluate(node => node === globalThis.document.activeElement), true); results.push('newer-command-fences-held-read-and-keeps-its-outcome');
    const leaving = hold('status'); await spotifyStart.click(); await leaving.started.promise;
    await page.getByRole('navigation', { name: 'Settings sections', exact: true }).getByRole('link', { name: 'Setup', exact: true }).click();
    await page.waitForURL(baseUrl + '/app/settings'); leaving.resolve(); await leaving.finished.promise; await frame();
    await page.getByRole('heading', { name: 'Setup readiness', exact: true }).waitFor(); assert.equal(new URL(page.url()).pathname, '/app/settings');
    results.push('scope-disposal-suppresses-late-status');
    assert.equal(count('command'), 3); assert.equal(blockedWrites, 0); assert.deepEqual(errors, []);
    return { results, requests, screenshots, blockedWrites, pageErrors: errors, noForwardedMutation: true, noLiveProvider: true, draftPreserved: true,
      requestOrder: true, duplicateGuard: true, focusPreserved: true, noSecretEcho: true, newerCommandGuard: true, disposalGuard: true };
  } finally {
    for (const pending of holds) pending.resolve(); page.off('pageerror', onError);
    for (const [path, handler] of routes.toReversed()) await browserContext.unroute(path, handler);
  }
}
