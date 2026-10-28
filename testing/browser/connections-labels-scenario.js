/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { expect } from 'playwright/test';

const secretFields = [
  ['settings-slskd-api-key', 'Remove the stored API key on save'],
  ['settings-spotify-client-secret', 'Remove the stored Spotify client secret on save'],
  ['settings-youtube-api-key', 'Remove API key'],
  ['settings-youtube-client-secret', 'Remove OAuth secret'],
  ['settings-apple-private-key', 'Remove the stored Apple Music private key on save'],
  ['settings-fanart-project-key', 'Remove project key'],
  ['settings-fanart-personal-key', 'Remove personal key'],
];

async function inspectLabels(page) {
  const fields = await page.locator('.cfg-page form .hx-field').evaluateAll(nodes => nodes.map(node => {
    const label = node.querySelector('label'), control = node.querySelector('input, select, textarea');
    return { id: control.id, label: label.textContent.trim(), linked: label.control === control,
      explicit: label.htmlFor === control.id, labels: control.labels.length };
  }));
  assert.equal(fields.length, 17);
  const duplicates = await page.locator('[id]').evaluateAll(nodes => {
    const ids = nodes.map(node => node.id); return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  assert.deepEqual(duplicates, []);
  assert.equal(await page.locator('.cfg-page form input').evaluateAll(nodes => nodes.every(node => node.labels.length > 0)), true);
  for (const field of fields) {
    assert.ok(field.id); assert.equal(field.linked, true); assert.equal(field.explicit, true); assert.equal(field.labels, 1);
    const control = page.locator(`[id="${field.id}"]`);
    await expect(control).toHaveAccessibleName(field.label);
    assert.equal(await control.and(page.getByLabel(field.label, { exact: true })).count(), 1);
    await page.locator(`label[for="${field.id}"]`).click();
    await expect(control).toBeFocused();
  }
  return fields.map(({ id, label }) => ({ id, label }));
}

export async function runConnectionsLabelsScenario({ page, browserContext, baseUrl, evidenceDir }) {
  const errors = [], scenes = [], screenshots = [];
  let blockedWrites = 0, fixtureReads = 0;
  const onError = error => errors.push(error.name);
  const guard = async route => {
    const request = route.request();
    if (!['GET', 'HEAD'].includes(request.method())) { blockedWrites++; await route.abort('blockedbyclient'); return; }
    if (new URL(request.url()).pathname !== '/api/v1/settings' || request.method() !== 'GET') { await route.continue(); return; }
    const response = await route.fetch(); assert.equal(response.status(), 200);
    const body = await response.json();
    body.settings.slskd.providerMode = 'external';
    body.secretStatus ??= {}; body.secretStatus.slskd = { providerMode: 'external', managedDeploymentDetected: false, providerModeLocked: false, apiKeyConfigured: true };
    body.secretStatus.providers ??= {};
    for (const [provider, flags] of Object.entries({ spotify: ['clientSecretConfigured'], youtube: ['apiKeyConfigured', 'clientSecretConfigured'], appleMusic: ['privateKeyConfigured'], fanartTv: ['apiKeyConfigured', 'clientKeyConfigured'] })) {
      body.secretStatus.providers[provider] = Object.fromEntries(flags.map(flag => [flag, true]));
    }
    fixtureReads++;
    await route.fulfill({ response, json: body });
  };
  page.on('pageerror', onError);
  await browserContext.route('**/api/v1/**', guard);
  try {
    await page.goto(baseUrl + '/app/settings/connections', { waitUntil: 'domcontentloaded' });
    const behavior = page.getByRole('button', { name: 'Show connection behavior', exact: true });
    const optional = page.getByRole('button', { name: 'Set up optional services', exact: true });
    await behavior.click(); await optional.click();
    const draft = page.getByLabel('Client ID', { exact: true });
    await draft.fill('LabelFixtureDraft');
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
      for (const [label, width] of [['desktop', 1440], ['tablet', 800], ['mobile', 390]]) {
        await page.setViewportSize({ width, height: 900 });
        const fields = await inspectLabels(page);
        assert.equal(await draft.inputValue(), 'LabelFixtureDraft');
        scenes.push({ label, theme, fields: fields.length, nativeActivation: true, accessibleNames: true, duplicateIds: 0 });
        if (evidenceDir) {
          const filename = `connections-labels-${theme}-${label}.png`;
          await page.locator('.cfg-provider-card').filter({ has: page.getByRole('heading', { name: 'Spotify', exact: true }) }).screenshot({ path: join(evidenceDir, filename), animations: 'disabled' });
          screenshots.push(filename);
        }
      }
    }
    for (const [id, removeLabel] of secretFields) {
      const control = page.locator(`[id="${id}"]`), remove = page.getByRole('checkbox', { name: removeLabel, exact: true });
      assert.equal(await control.inputValue(), '');
      assert.equal(await control.getAttribute('autocomplete'), 'new-password');
      if (id !== 'settings-apple-private-key') assert.equal(await control.getAttribute('type'), 'password');
      await control.fill('SyntheticLabelDraft');
      await remove.check(); await expect(control).toBeDisabled();
      // Locator.click retargets labels to their controls and waits for enabled.
      // A real pointer click can instead verify the disabled control stays inert.
      const label = page.locator(`label[for="${id}"]`);
      await label.scrollIntoViewIfNeeded();
      const box = await label.boundingBox(); assert.ok(box);
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      assert.equal(await label.evaluate((node, position) => node.contains(globalThis.document.elementFromPoint(position.x, position.y)), point), true);
      await page.mouse.click(point.x, point.y); await expect(control).not.toBeFocused();
      await remove.uncheck(); await expect(control).toBeEnabled();
      assert.equal(await control.inputValue(), 'SyntheticLabelDraft');
    }
    await page.getByRole('button', { name: 'Hide optional services', exact: true }).click();
    await page.getByRole('button', { name: 'Hide connection behavior', exact: true }).click();
    await behavior.click(); await optional.click();
    await inspectLabels(page); assert.equal(await draft.inputValue(), 'LabelFixtureDraft');
    for (const [id] of secretFields) assert.equal(await page.locator(`[id="${id}"]`).inputValue(), 'SyntheticLabelDraft');
    // Connections loads its draft and setup progress through separate GET owners.
    assert.equal(blockedWrites, 0); assert.deepEqual(errors, []); assert.equal(fixtureReads, 2);
    return { scenes, screenshots, fields: 17, secretFields: secretFields.length, draftPreserved: true, disclosureReopen: true,
      fixtureReads, blockedWrites, pageErrors: errors, noForwardedMutation: true, noProviderCommands: true };
  } finally { page.off('pageerror', onError); await browserContext.unroute('**/api/v1/**', guard); }
}
