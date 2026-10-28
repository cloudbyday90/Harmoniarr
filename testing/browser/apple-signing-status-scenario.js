/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';

/** Actual built Settings view; only named API responses are controlled. No settings PUT reaches the server. */
export async function runAppleSigningStatusScenario({ page, browserContext, baseUrl, evidenceDir }) {
  const valid = { state: 'valid', checks: { teamId: 'valid', keyId: 'valid', privateKey: 'valid' } };
  const incomplete = { state: 'incomplete', checks: { ...valid.checks, privateKey: 'missing' } };
  const invalid = { state: 'invalid', checks: { ...valid.checks, privateKey: 'invalid' } };
  const firstRead = Promise.withResolvers(), holds = new Set([firstRead]);
  let settings, mode = valid, readCount = 0, putCount = 0, rejectSave = false, heldRead = firstRead, heldSave = null;
  const pageErrors = [], results = [], screenshots = [];
  const errorListener = error => pageErrors.push(error.name);
  page.on('pageerror', errorListener);
  const json = value => ({ contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(value) });
  const statusRoute = async route => {
    readCount++; assert.equal(route.request().method(), 'GET'); assert.equal(route.request().postData(), null); assert.equal(new URL(route.request().url()).search, '');
    const hold = heldRead; heldRead = null;
    if (hold) { hold.started?.resolve(); await hold.promise; holds.delete(hold); }
    try {
      await route.fulfill(mode === 'error' ? { ...json({ error: { code: 'unknown', message: 'PRIVATE-response-sentinel' } }), status: 500 }
        : json({ appleMusic: { localSigning: mode, rawKey: 'PRIVATE-response-sentinel' } }));
    } catch (error) {
      if (!/already handled|Target.*closed|interrupted|aborted/iu.test(error.message)) throw error;
    }
  };
  const settingsRoute = async route => {
    if (route.request().method() === 'GET') {
      const response = await route.fetch(); settings = await response.json();
      Object.assign(settings.settings.providers, { appleMusicTeamId: 'TESTTEAM01', appleMusicKeyId: 'TESTKEY001' });
      settings.secretStatus.providers.appleMusic = { privateKeyConfigured: true, privateKeySource: 'stored' };
      await route.fulfill({ ...json(settings), response }); return;
    }
    assert.equal(route.request().method(), 'PUT'); putCount++;
    const hold = heldSave; heldSave = null; if (hold) { hold.started.resolve(); await hold.promise; holds.delete(hold); }
    if (rejectSave) { rejectSave = false; await route.fulfill({ ...json({ error: { code: 'validation_error', message: 'Settings could not be saved.' } }), status: 400 }); return; }
    const patch = route.request().postDataJSON();
    for (const [namespace, values] of Object.entries(patch)) for (const [key, value] of Object.entries(values)) {
      if (Object.hasOwn(settings.settings[namespace] ?? {}, key)) settings.settings[namespace][key] = value;
    }
    await route.fulfill(json(settings));
  };
  const slskdRoute = route => route.fulfill(json({ ok: true, status: { status: 'healthy', provider: 'slskd' } }));
  await browserContext.route('**/api/v1/providers/status', statusRoute);
  await browserContext.route('**/api/v1/settings', settingsRoute);
  await browserContext.route('**/api/v1/slskd/status', slskdRoute);
  const holdRead = () => { const hold = Object.assign(Promise.withResolvers(), { started: Promise.withResolvers() }); holds.add(hold); heldRead = hold; return hold; };
  const expectStatus = async text => page.getByRole('region', { name: 'Saved Apple signing status' }).getByRole('status').filter({ hasText: text }).waitFor();
  try {
    await page.goto(baseUrl + '/app/settings/connections', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Set up optional services', exact: true }).click();
    const region = page.getByRole('region', { name: 'Saved Apple signing status' }), feedback = region.getByRole('status');
    const refresh = region.getByRole('button', { name: 'Refresh saved status', exact: true });
    await expectStatus('Checking saved Apple credentials');
    assert.equal(await feedback.getAttribute('aria-atomic'), 'true');
    assert.equal(await feedback.evaluate(node => Boolean(node.closest('[aria-busy="true"]'))), false);
    await refresh.focus(); await page.keyboard.press('Enter'); assert.equal(readCount, 1);
    firstRead.resolve(); await expectStatus('pass local checks');
    assert.equal(await refresh.evaluate(node => node === globalThis.document.activeElement), true); results.push('persistent-live-status-and-duplicate-keyboard-guard');
    mode = invalid; await refresh.click(); await expectStatus('need review'); await region.getByText('Saved private key: Invalid saved value', { exact: true }).waitFor();
    mode = incomplete; await refresh.click(); await expectStatus('are incomplete'); results.push('saved-invalid-and-incomplete-field-feedback');
    mode = 'error'; await refresh.click(); await expectStatus('unavailable'); assert.ok(!(await region.textContent()).includes('PRIVATE-response-sentinel'));
    assert.equal(await refresh.evaluate(node => node === globalThis.document.activeElement), true);
    mode = valid; await refresh.click(); await expectStatus('pass local checks'); results.push('safe-error-and-focused-retry');
    const countBeforeDraft = readCount;
    await page.getByLabel('Team ID', { exact: true }).fill('NEXTTEAM01');
    await page.getByLabel('Private key', { exact: true }).fill('SYNTHETIC-DRAFT-KEY');
    await expectStatus('Unsaved Apple credential changes'); assert.equal(readCount, countBeforeDraft);
    assert.equal(await page.getByLabel('Team ID', { exact: true }).getAttribute('aria-invalid'), null);
    await page.getByLabel('Remove the stored Apple Music private key on save').check();
    await expectStatus('Unsaved Apple credential changes'); await page.getByLabel('Remove the stored Apple Music private key on save').uncheck();
    results.push('draft-ids-key-and-clear-stay-separate-without-status-requests');
    rejectSave = true; await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expectStatus('pass local checks'); await expectStatus('Unsaved Apple credential changes');
    assert.equal(await page.getByLabel('Team ID', { exact: true }).inputValue(), 'NEXTTEAM01');
    assert.equal(await page.getByLabel('Private key', { exact: true }).inputValue(), 'SYNTHETIC-DRAFT-KEY'); results.push('failed-save-preserves-drafts-and-refreshes-saved-status');
    const pendingRead = holdRead(); await refresh.click(); await pendingRead.started.promise; await expectStatus('Checking saved');
    const saving = Object.assign(Promise.withResolvers(), { started: Promise.withResolvers() }); holds.add(saving); heldSave = saving;
    await page.getByRole('button', { name: 'Try saving again', exact: true }).click(); await saving.started.promise; await expectStatus('Saving Apple credentials');
    const countAtSave = readCount; await refresh.focus(); await page.keyboard.press('Enter'); assert.equal(readCount, countAtSave);
    pendingRead.resolve(); saving.resolve(); await expectStatus('pass local checks');
    await page.waitForFunction(() => !globalThis.document.querySelector('[aria-labelledby="settings-apple-signing-heading"] [role="status"]').textContent.includes('Unsaved Apple credential changes'));
    assert.equal(await page.getByLabel('Private key', { exact: true }).inputValue(), ''); results.push('save-invalidates-held-read-and-refreshes-saved-state');
    const unmount = holdRead(); await refresh.click(); await unmount.started.promise;
    await page.goto(baseUrl + '/app/settings/general', { waitUntil: 'domcontentloaded' }); unmount.resolve();
    await page.goto(baseUrl + '/app/settings/connections', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Set up optional services', exact: true }).click(); await expectStatus('pass local checks'); results.push('navigation-retires-old-view-and-reloads-current-state');
    for (const theme of ['light', 'dark']) for (const [name, width] of [['desktop', 1440], ['tablet', 800], ['mobile', 390]]) {
      await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
      await page.setViewportSize({ width, height: 900 }); await region.scrollIntoViewIfNeeded();
      assert.equal(await region.evaluate(node => node.scrollWidth <= node.clientWidth), true);
      assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.window.innerWidth), true);
      assert.ok((await refresh.boundingBox()).height >= 44);
      if (evidenceDir) { const file = `apple-signing-${theme}-${name}.png`; await region.screenshot({ path: join(evidenceDir, file), animations: 'disabled' }); screenshots.push(file); }
    }
    results.push('three-breakpoints-both-themes-and-mobile-target');
    assert.deepEqual(pageErrors, []); assert.equal(putCount, 2);
    return { results, readCount, controlledPuts: putCount, rawErrorExcluded: true, focusPreserved: true, noOverflow: true, screenshots };
  } finally {
    for (const hold of holds) hold.resolve();
    await browserContext.unroute('**/api/v1/providers/status', statusRoute);
    await browserContext.unroute('**/api/v1/settings', settingsRoute);
    await browserContext.unroute('**/api/v1/slskd/status', slskdRoute);
    page.off('pageerror', errorListener);
  }
}
