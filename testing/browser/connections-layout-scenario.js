/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { inspectSettingsForm, traverseSettingsForm } from './settings-form-keyboard.js';

export async function runConnectionsLayoutScenario({ page, browserContext, baseUrl, evidenceDir, nativeZoom = false }) {
  const scenes = [], screenshots = [], errors = [], controlledSaves = [];
  let allowSaveFailure = false, blockedWrites = 0;
  const guard = async route => {
    const request = route.request();
    if (['GET', 'HEAD'].includes(request.method())) { await route.continue(); return; }
    if (allowSaveFailure && request.method() === 'PUT' && new URL(request.url()).pathname === '/api/v1/settings') {
      const csrf = (await browserContext.cookies(baseUrl)).find(cookie => cookie.name === 'harmoniarr_csrf')?.value;
      assert.equal(typeof csrf === 'string' && csrf.length > 0 && request.headers()['x-csrf-token'] === csrf, true, 'Controlled save preserves current CSRF contract');
      controlledSaves.push({ method: 'PUT', csrfPreserved: true });
      await route.fulfill({ status: 503, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ error: { code: 'fixture', message: 'The selected setting is temporarily unavailable. Review the saved configuration before trying again.' } }) });
    } else { blockedWrites++; await route.abort('blockedbyclient'); }
  };
  const onError = error => errors.push(error.name); page.on('pageerror', onError);
  await browserContext.route('**/api/v1/**', guard);
  const frame = () => page.evaluate(() => new Promise(resolve => { globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)); }));
  try {
    if (!nativeZoom) await page.goto(baseUrl + '/app/settings/connections', { waitUntil: 'domcontentloaded' });
    else assert.equal(new URL(page.url()).pathname, '/app/settings/connections');
    await page.getByRole('button', { name: 'Set up optional services', exact: true }).click();
    const spotify = page.locator('.cfg-provider-card').filter({ has: page.getByRole('heading', { name: 'Spotify', exact: true }) });
    const draft = spotify.locator('.hx-input').first(); await draft.fill('LayoutFixtureDraft');
    const viewport = await page.evaluate(() => [globalThis.innerWidth, globalThis.innerHeight]);
    if (nativeZoom) assert.deepEqual(viewport, [320, 256], 'Native zoom must remain active after opening the form');
    const sizes = nativeZoom ? [['native-zoom', ...viewport]] : [['desktop', 1440, 900], ['tablet', 800, 900], ['mobile', 390, 844], ['reflow', 320, 256], ['mobile-boundary', 640, 900], ['row-boundary', 641, 900], ['short-boundary', 1000, 600], ['sticky-boundary', 1000, 601]];
    for (const theme of ['light', 'dark']) for (const [label, width, height] of sizes) {
      await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
      if (!nativeZoom) await page.setViewportSize({ width, height }); await frame();
      const fields = await spotify.locator('.hx-form-row').evaluate(row => ({ width: row.getBoundingClientRect().width,
        fields: [...row.children].map(field => ({ width: field.getBoundingClientRect().width, height: field.getBoundingClientRect().height, inputHeight: field.querySelector('input').getBoundingClientRect().height })) }));
      for (const field of fields.fields) { assert.ok(field.height < 100); assert.ok(field.inputHeight < 60); if (width <= 640) assert.ok(Math.abs(field.width - fields.width) < 1); }
      const geometry = await inspectSettingsForm(page), sticky = width > 640 && height > 600;
      assert.equal(geometry.position, sticky ? 'sticky' : 'static'); assert.equal(geometry.barWithinForm, true); assert.equal(geometry.noHorizontalOverflow, true);
      assert.equal(geometry.reservation, sticky ? Math.ceil(geometry.barHeight) : 0); assert.ok(geometry.scrollPaddingBottom >= geometry.reservation + 16);
      const forward = await traverseSettingsForm(page), reverse = await traverseSettingsForm(page, { backwards: true });
      assert.equal(await draft.inputValue(), 'LayoutFixtureDraft'); scenes.push({ label, theme, fields, geometry, forward, reverse });
      if (evidenceDir && ['desktop', 'tablet', 'mobile', 'native-zoom'].includes(label)) {
        const name = `connections-${theme}-${label}.png`;
        if (nativeZoom) { await draft.focus(); await page.screenshot({ path: join(evidenceDir, name), animations: 'disabled' }); }
        else await spotify.screenshot({ path: join(evidenceDir, name), animations: 'disabled' });
        screenshots.push(name);
      }
    }
    if (!nativeZoom) {
      await page.setViewportSize({ width: 800, height: 900 }); await frame(); allowSaveFailure = true;
      const save = page.locator('.settings-save-bar button[type="submit"]'); await save.click();
      await page.locator('.settings-save-bar__outcome').filter({ hasText: 'Settings could not be saved' }).waitFor(); await frame();
      const wrapped = await inspectSettingsForm(page); assert.equal(wrapped.position, 'sticky'); assert.equal(wrapped.reservation, Math.ceil(wrapped.barHeight));
      scenes.push({ label: 'wrapped-failure', geometry: wrapped, forward: await traverseSettingsForm(page), reverse: await traverseSettingsForm(page, { backwards: true }) });
      const enlarged = await page.addStyleTag({ content: '.settings-save-bar__outcome p { font-size: 64px !important; line-height: 1.8 !important; }' }); await frame();
      const tall = await inspectSettingsForm(page); assert.equal(tall.overflowFlow, true); assert.equal(tall.position, 'static'); assert.equal(tall.reservation, 0);
      scenes.push({ label: 'enlarged-feedback', geometry: tall, forward: await traverseSettingsForm(page), reverse: await traverseSettingsForm(page, { backwards: true }) });
      await enlarged.evaluate(node => node.remove()); await frame(); assert.equal((await inspectSettingsForm(page)).position, 'sticky');
      assert.equal(await draft.inputValue(), 'LayoutFixtureDraft'); assert.equal(controlledSaves.length, 1);
    }
    await page.getByRole('navigation', { name: 'Settings sections', exact: true }).getByRole('link', { name: 'Setup', exact: true }).click();
    await page.waitForURL(baseUrl + '/app/settings');
    assert.equal(await page.locator('.hx-main').evaluate(node => node.style.getPropertyValue('--hx-settings-save-bar-height')), '');
    const more = page.getByRole('button', { name: 'More settings', exact: true }); if (await more.count()) await more.click();
    await page.getByRole('navigation', { name: 'More settings sections', exact: true }).getByRole('link', { name: 'System & security', exact: true }).click();
    await page.locator('.cfg-page form .settings-save-bar').waitFor(); await frame();
    if (nativeZoom) assert.deepEqual(await page.evaluate(() => [globalThis.innerWidth, globalThis.innerHeight]), [320, 256]);
    scenes.push({ label: 'shared-general-consumer', geometry: await inspectSettingsForm(page), forward: await traverseSettingsForm(page), reverse: await traverseSettingsForm(page, { backwards: true }) });
    assert.equal(blockedWrites, 0); assert.deepEqual(errors, []);
    return { scenes, screenshots, controlledSaves, blockedWrites, pageErrors: errors, draftPreserved: true, nativeKeyboard: true,
      noPerStepCorrection: true, reservationRetired: true, noForwardedMutation: true, noProviderCommands: true, nativeZoom };
  } finally { page.off('pageerror', onError); await browserContext.unroute('**/api/v1/**', guard); }
}
