/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { expect } from 'playwright/test';
import { inspectSettingsForm, traverseSettingsForm } from './settings-form-keyboard.js';

const disclosures = ['advanced library controls', 'source safety', 'history retention', 'match ranking', 'audio verification thresholds', 'file naming'];

async function verifyLabels(page) {
  const fields = await page.locator('.cfg-page form input:not([type="checkbox"])').evaluateAll(nodes => nodes.map(control => {
    const label = control.closest('.hx-field').querySelector('label');
    return { id: control.id, label: label.textContent.trim(), linked: label.control === control,
      explicit: label.htmlFor === control.id, labels: control.labels.length };
  }));
  assert.equal(fields.length, 29);
  assert.deepEqual(await page.locator('[id]').evaluateAll(nodes => {
    const ids = nodes.map(node => node.id); return ids.filter((id, index) => ids.indexOf(id) !== index);
  }), []);
  assert.equal(await page.locator('.cfg-page form input').evaluateAll(nodes => nodes.every(node => node.labels.length > 0)), true);
  for (const field of fields) {
    assert.ok(field.id); assert.equal(field.linked, true); assert.equal(field.explicit, true); assert.equal(field.labels, 1);
    const control = page.locator(`[id="${field.id}"]`);
    await expect(control).toHaveAccessibleName(field.label);
    assert.equal(await control.and(page.getByLabel(field.label, { exact: true })).count(), 1);
    await page.locator(`label[for="${field.id}"]`).click(); await expect(control).toBeFocused();
  }
  for (const [groupName, id] of [['Operation runs', 'settings-library-operation-run-max-age-days'], ['Outcome events', 'settings-library-outcome-event-max-age-days']]) {
    const group = page.getByRole('group', { name: groupName, exact: true });
    await expect(group).toBeVisible();
    assert.equal(await group.getByRole('spinbutton', { name: 'Max age (days)', exact: true }).getAttribute('id'), id);
  }
}

export async function runLibraryLabelsScenario({ page, browserContext, baseUrl, evidenceDir, nativeZoom = false }) {
  const errors = [], scenes = [], screenshots = [];
  let blockedWrites = 0, settingsReads = 0;
  const onError = error => errors.push(error.name);
  const guard = async route => {
    const request = route.request();
    if (!['GET', 'HEAD'].includes(request.method())) { blockedWrites++; await route.abort('blockedbyclient'); return; }
    if (new URL(request.url()).pathname === '/api/v1/settings') settingsReads++;
    await route.continue();
  };
  page.on('pageerror', onError); await browserContext.route('**/api/v1/**', guard);
  try {
    if (!nativeZoom) await page.goto(baseUrl + '/app/settings/library', { waitUntil: 'domcontentloaded' });
    else { assert.equal(new URL(page.url()).pathname, '/app/settings/library'); assert.deepEqual(await page.evaluate(() => [globalThis.innerWidth, globalThis.innerHeight]), [320, 256]); }
    for (const name of disclosures) await page.getByRole('button', { name: 'Show ' + name, exact: true }).click();
    const enabled = page.getByRole('checkbox', { name: 'Automatically ignore low-reputation source users', exact: true });
    const cooldown = page.getByLabel('Cooldown (hours)', { exact: true });
    await enabled.uncheck(); await expect(cooldown).toBeDisabled();
    await enabled.check(); await expect(cooldown).toBeEnabled();
    await cooldown.fill('-1'); assert.equal(await cooldown.evaluate(node => node.validity.rangeUnderflow), true);
    await cooldown.fill('25'); assert.equal(await cooldown.evaluate(node => node.checkValidity()), true);
    const draft = page.getByLabel('Artist folder format', { exact: true });
    await draft.fill('{ArtistName} - LibraryLabelFixture');
    const sizes = nativeZoom ? [['native-zoom', 320, 256]] : [['desktop', 1440, 900], ['tablet', 800, 900], ['mobile', 390, 844], ['reflow', 320, 256]];
    for (const theme of ['light', 'dark']) for (const [label, width, height] of sizes) {
      await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
      if (!nativeZoom) await page.setViewportSize({ width, height });
      await verifyLabels(page);
      const geometry = await inspectSettingsForm(page); assert.equal(geometry.noHorizontalOverflow, true); assert.equal(geometry.barWithinForm, true);
      const forward = await traverseSettingsForm(page), reverse = await traverseSettingsForm(page, { backwards: true });
      assert.equal(await draft.inputValue() === '{ArtistName} - LibraryLabelFixture', true, 'Naming draft survives label activation and native keyboard traversal');
      assert.equal(await cooldown.inputValue() === '25', true);
      if (nativeZoom) assert.deepEqual(await page.evaluate(() => [globalThis.innerWidth, globalThis.innerHeight]), [320, 256]);
      scenes.push({ label, theme, fields: 29, namedRetentionGroups: 2, forward, reverse, geometry });
      if (evidenceDir && label !== 'reflow') {
        const filename = `library-labels-${theme}-${label}.png`;
        if (nativeZoom) { await page.getByRole('group', { name: 'Operation runs', exact: true }).getByRole('spinbutton', { name: 'Max age (days)', exact: true }).focus(); await page.screenshot({ path: join(evidenceDir, filename), animations: 'disabled' }); }
        else await page.locator('#settings-library-retention').screenshot({ path: join(evidenceDir, filename), animations: 'disabled' });
        screenshots.push(filename);
      }
    }
    const ranking = page.getByRole('region', { name: 'How matches are ranked', exact: true });
    const format = page.getByLabel('Format tier', { exact: true }); await format.fill('0.30');
    await ranking.getByRole('button', { name: 'Reset to defaults', exact: true }).click();
    assert.equal(await format.inputValue() === '0.25', true); assert.equal(await cooldown.inputValue() === '25', true);
    assert.equal(await draft.inputValue() === '{ArtistName} - LibraryLabelFixture', true);
    await page.getByRole('button', { name: 'Hide advanced library controls', exact: true }).click();
    await page.getByRole('button', { name: 'Show advanced library controls', exact: true }).click();
    await verifyLabels(page);
    assert.equal(await draft.inputValue() === '{ArtistName} - LibraryLabelFixture', true); assert.equal(await cooldown.inputValue() === '25', true);
    assert.equal(blockedWrites, 0); assert.deepEqual(errors, []);
    // Native-zoom callers navigate before setting zoom, so their load precedes this guard.
    if (!nativeZoom) assert.ok(settingsReads > 0);
    return { scenes, screenshots, fields: 29, namedRetentionGroups: 2, disabledCooldown: true, numericRange: true, scopedReset: true,
      draftPreserved: true, disclosureReopen: true, settingsReads, blockedWrites, pageErrors: errors, noForwardedMutation: true, nativeZoom };
  } finally { page.off('pageerror', onError); await browserContext.unroute('**/api/v1/**', guard); }
}
