/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';

export async function runProviderAuthorizationActionsScenario({ page, browserContext, baseUrl, evidenceDir }) {
  const results = [], requests = [], screenshots = [], errors = [], holds = new Set();
  const linked = { spotify: true, youtube: true };
  const commandPath = /\/api\/v1\/providers\/(spotify|youtube)\/oauth\/(start|clear)$/u;
  const providerPath = /\/provider-action-fixture(?:\?.*)?$/u;
  let mode = 'failure', nextHold, blockedWrites = 0;
  const json = (body, status = 200) => ({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(body) });
  const savedResponse = await page.request.get(baseUrl + '/api/v1/settings');
  assert.equal(savedResponse.status(), 200);
  const savedSettings = await savedResponse.json();
  const guard = async route => { if (!['GET', 'HEAD'].includes(route.request().method())) { blockedWrites++; await route.abort('blockedbyclient'); } else await route.continue(); };
  const settings = async route => {
    assert.equal(route.request().method(), 'GET'); const body = savedSettings;
    await route.fulfill(json({ ...body, secretStatus: { ...body.secretStatus, providers: { ...body.secretStatus?.providers,
      spotifyOAuth: { linked: linked.spotify }, youtubeOAuth: { linked: linked.youtube } } } }));
  };
  const commands = async route => {
    const request = route.request(), [, provider, kind] = new URL(request.url()).pathname.match(commandPath);
    assert.equal(request.method(), 'POST'); assert.equal(request.postData(), null);
    const csrf = (await browserContext.cookies(baseUrl)).find(cookie => cookie.name === 'harmoniarr_csrf')?.value;
    assert.equal(typeof csrf === 'string' && csrf.length > 0 && request.headers()['x-csrf-token'] === csrf, true, 'Current CSRF cookie must accompany the command');
    requests.push({ provider, kind, csrfPreserved: true });
    const chosen = mode, hold = nextHold; nextHold = null;
    if (hold) { hold.started.resolve(); await hold.promise; holds.delete(hold); }
    let reply;
    if (chosen === 'failure') reply = json({ ok: false, error: { code: 'PRIVATE', message: 'PRIVATE command /data/key.pem' } }, 503);
    else if (kind === 'clear') {
      if (chosen !== 'malformed') linked[provider] = false;
      reply = json({ ok: true, provider, status: { linked: chosen === 'malformed' } });
    } else reply = json({ ok: true, provider, authorizationUrl: `${baseUrl}/provider-action-fixture?provider=${provider}` }, 202);
    await route.fulfill(reply);
  };
  const provider = async route => { assert.equal(route.request().method(), 'GET'); await route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><title>Provider handoff fixture</title><h1>Provider handoff fixture</h1></html>' }); };
  const card = name => page.locator('.cfg-provider-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
  const buttons = () => page.locator('.settings-connections__authorization-actions button');
  const spotifyStart = card('Spotify').locator('.settings-connections__authorization-actions button').nth(0);
  const spotifyClear = card('Spotify').locator('.settings-connections__authorization-actions button').nth(1);
  const youtubeStart = card('YouTube').locator('.settings-connections__authorization-actions button').nth(0);
  const youtubeClear = card('YouTube').locator('.settings-connections__authorization-actions button').nth(1);
  const status = page.locator('.settings-connections__authorization-feedback');
  const frame = () => page.evaluate(() => new Promise(resolve => { globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)); }));
  const held = () => { const hold = Object.assign(Promise.withResolvers(), { started: Promise.withResolvers() }); nextHold = hold; holds.add(hold); return hold; };
  const reveal = async () => {
    await page.getByRole('heading', { name: 'Soulseek downloads', exact: true }).waitFor();
    const show = page.getByRole('button', { name: 'Set up optional services', exact: true });
    if (await show.count()) await show.click();
    await spotifyStart.waitFor();
  };
  const open = async () => { await page.goto(baseUrl + '/app/settings/connections', { waitUntil: 'domcontentloaded' }); await reveal(); };
  const onError = error => errors.push(error.name); page.on('pageerror', onError);
  await browserContext.addInitScript(() => { globalThis.addEventListener('pageshow', event => { globalThis.__authorizationPagePersisted = event.persisted; }); });
  await browserContext.route('**/api/v1/**', guard); await browserContext.route('**/api/v1/settings', settings);
  await browserContext.route(commandPath, commands); await browserContext.route(providerPath, provider);
  try {
    await open(); assert.equal(await status.getAttribute('role'), 'status'); assert.equal(await status.getAttribute('aria-atomic'), 'true');
    assert.equal((await status.textContent()).trim(), ''); assert.equal(requests.length, 0); results.push('persistent-empty-feedback-no-automatic-command');
    const draft = card('Spotify').locator('.hx-input').first(); await draft.fill('FixtureDraft');
    const save = page.locator('.settings-save-bar button[type="submit"]'); await page.waitForFunction(() => !globalThis.document.querySelector('.settings-save-bar button[type="submit"]')?.disabled);
    const first = held(); await spotifyStart.click(); await first.started.promise;
    for (const button of await buttons().all()) { assert.equal(await button.getAttribute('aria-disabled'), 'true'); assert.equal(await button.evaluate(node => node.disabled), false); await button.evaluate(node => node.click()); }
    await page.keyboard.press('Enter'); await page.keyboard.press('Space'); await page.locator('form').dispatchEvent('submit'); await frame();
    assert.equal(requests.length, 1); assert.equal(await save.evaluate(node => node.disabled), true); assert.equal(await spotifyStart.evaluate(node => node === globalThis.document.activeElement), true);
    first.resolve(); await status.filter({ hasText: 'Spotify authorization start could not be confirmed.' }).waitFor();
    assert.equal(await spotifyStart.evaluate(node => node === globalThis.document.activeElement), true); assert.equal(await draft.inputValue(), 'FixtureDraft');
    assert.equal(requests.length, 1); assert.doesNotMatch(await status.innerText(), /PRIVATE|key\.pem/u); results.push('held-start-cross-command-keyboard-and-settings-guard');
    for (const theme of ['light', 'dark']) for (const [label, width, height] of [['desktop', 1440, 900], ['tablet', 800, 900], ['mobile', 390, 844]]) {
      await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme); await page.setViewportSize({ width, height });
      await status.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })); await frame();
      assert.equal(await status.evaluate(node => node.scrollWidth <= node.clientWidth), true);
      assert.equal(await status.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return [[rect.left + 8, rect.top + 8], [rect.right - 8, rect.top + 8], [rect.left + 8, rect.bottom - 8], [rect.right - 8, rect.bottom - 8]]
          .every(([x, y]) => node.contains(globalThis.document.elementFromPoint(x, y)));
      }), true, 'Feedback must be unobscured at the captured viewport');
      assert.ok((await spotifyStart.boundingBox()).height >= 44);
      if (evidenceDir) { const name = 'authorization-actions-' + theme + '-' + label + '.png'; await status.screenshot({ path: join(evidenceDir, name), animations: 'disabled' }); screenshots.push(name); }
    }
    results.push('three-breakpoints-both-themes-no-overflow');
    mode = 'success'; const clear = held(); await spotifyClear.click(); await clear.started.promise;
    for (const button of await buttons().all()) await button.evaluate(node => node.click()); await frame(); assert.equal(requests.length, 2);
    clear.resolve(); await status.filter({ hasText: 'Spotify authorization cleared.' }).waitFor();
    assert.equal(await spotifyClear.evaluate(node => node === globalThis.document.activeElement), true); assert.equal(await spotifyClear.evaluate(node => node.disabled), false);
    assert.equal(await spotifyClear.getAttribute('aria-disabled'), 'true'); await spotifyClear.evaluate(node => node.click()); await frame(); assert.equal(requests.length, 2);
    assert.equal(await draft.inputValue(), 'FixtureDraft'); results.push('confirmed-clear-retains-focus-and-refuses-absent-clear');
    mode = 'failure'; await youtubeClear.click(); await status.filter({ hasText: 'YouTube authorization clear could not be confirmed.' }).waitFor();
    assert.equal(await youtubeClear.getAttribute('aria-disabled'), 'false'); results.push('clear-failure-keeps-saved-link-and-allows-explicit-recovery');
    mode = 'success'; const recovery = held(); await youtubeClear.click(); await recovery.started.promise; await spotifyStart.focus(); recovery.resolve();
    await status.filter({ hasText: 'YouTube authorization cleared.' }).waitFor(); assert.equal(await spotifyStart.evaluate(node => node === globalThis.document.activeElement), true); results.push('clear-recovery-does-not-steal-user-focus');
    const late = held(); await spotifyStart.click(); await late.started.promise;
    await page.getByRole('navigation', { name: 'Settings sections', exact: true }).getByRole('link', { name: 'Setup', exact: true }).click();
    await page.waitForURL(baseUrl + '/app/settings');
    const lateResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/providers/spotify/oauth/start');
    late.resolve(); await (await lateResponse).finished(); await frame();
    await page.getByRole('heading', { name: 'Setup readiness', exact: true }).waitFor(); assert.equal(new URL(page.url()).pathname, '/app/settings'); results.push('leaving-view-suppresses-late-navigation');
    await page.getByRole('navigation', { name: 'Settings sections', exact: true }).getByRole('link', { name: 'Connections', exact: true }).click(); await reveal();
    await youtubeStart.click(); await page.waitForURL(baseUrl + '/provider-action-fixture?provider=youtube');
    await page.getByRole('heading', { name: 'Provider handoff fixture', exact: true }).waitFor(); results.push('acknowledged-start-real-owned-navigation');
    await page.goBack({ waitUntil: 'domcontentloaded' }); await reveal();
    const nativeBackPersisted = await page.evaluate(() => globalThis.__authorizationPagePersisted === true);
    assert.equal(await youtubeStart.getAttribute('aria-disabled'), 'false'); results.push('actual-back-return-accepts-new-explicit-actions');
    linked.spotify = true; mode = 'malformed'; await open(); await spotifyClear.click();
    await status.filter({ hasText: 'Spotify authorization clear could not be confirmed.' }).waitFor(); assert.equal(await spotifyClear.getAttribute('aria-disabled'), 'false'); results.push('malformed-clear-keeps-saved-link');
    assert.equal(requests.length, 7); assert.equal(blockedWrites, 0); assert.deepEqual(errors, []);
    return { results, screenshots, requests, blockedWrites, pageErrors: errors, nativeBackPersisted, noLiveProvider: true, noForwardedMutation: true,
      focusPreserved: true, duplicateGuard: true, settingsGuard: true, userFocusPreserved: true, noOverflow: true, noSecretEcho: true };
  } finally {
    for (const hold of holds) hold.resolve(); page.off('pageerror', onError);
    await browserContext.unroute(providerPath, provider); await browserContext.unroute(commandPath, commands);
    await browserContext.unroute('**/api/v1/settings', settings); await browserContext.unroute('**/api/v1/**', guard);
  }
}
