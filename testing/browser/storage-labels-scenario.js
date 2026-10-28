/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { expect } from 'playwright/test';
import { inspectSettingsForm, traverseSettingsForm } from './settings-form-keyboard.js';

async function verifyLabels(page, expectedFields = 29) {
  const fields = await page.locator('.cfg-page form .hx-field').evaluateAll(nodes => nodes.map(node => {
    const control = node.querySelector('input,select,textarea'), label = node.querySelector('label');
    return { id: control.id, label: label.textContent.trim(), linked: label.control === control,
      explicit: label.htmlFor === control.id, labels: control.labels.length };
  }));
  assert.equal(fields.length, expectedFields);
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
}

async function exerciseRows(page, { title, labels, edited, addLabel, fresh }) {
  const group = position => page.getByRole('group', { name: `${title} ${position}`, exact: true });
  const region = page.getByRole('region', { name: title === 'Path translation' ? 'Path translations' : 'Additional folders', exact: true });
  const removed = await group(1).locator('input').evaluateAll(nodes => nodes.map(node => node.id));
  const controls = labels.map(label => group(2).getByLabel(label, { exact: true }));
  const ids = await Promise.all(controls.map(control => control.getAttribute('id')));
  const handles = await Promise.all(controls.map(control => control.elementHandle()));
  try {
    for (let index = 0; index < controls.length; index++) await controls[index].fill(edited[index]);
    await page.locator(`[id="${ids[0]}"]`).focus();
    // Controlled preceding-row mutation must preserve an input that still owns focus.
    await group(1).locator('..').getByRole('button', { name: /^Remove /u }).evaluate(node => node.click());
    for (let index = 0; index < ids.length; index++) {
      const survivor = group(1).getByLabel(labels[index], { exact: true });
      assert.equal(await survivor.getAttribute('id'), ids[index]);
      assert.equal(await survivor.evaluate((node, original) => node === original, handles[index]), true);
      assert.equal(await survivor.inputValue() === edited[index], true);
    }
    await expect(page.locator(`[id="${ids[0]}"]`)).toBeFocused();
    await region.getByRole('button', { name: addLabel, exact: true }).click();
    await region.getByRole('button', { name: addLabel, exact: true }).click();
    const freshIds = await Promise.all([3, 4].map(position => group(position).locator('input').evaluateAll(nodes => nodes.map(node => node.id))));
    assert.equal(new Set(freshIds.flat()).size, 4); assert.equal(freshIds.flat().some(id => removed.includes(id)), false);
    for (let row = 0; row < fresh.length; row++) for (let column = 0; column < labels.length; column++) {
      await group(row + 3).getByLabel(labels[column], { exact: true }).fill(fresh[row][column]);
    }
    return { ids, removed, survivingNodesPreserved: true, freshIdsUnique: true };
  } finally { for (const handle of handles) await handle?.dispose(); }
}

export async function runStorageLabelsScenario({ page, browserContext, baseUrl, evidenceDir, configureZoom }) {
  const errors = [], scenes = [], screenshots = [], controlledSaves = [];
  let blockedWrites = 0, settingsReads = 0, allowSave = false;
  const onError = error => errors.push(error.name);
  const guard = async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (allowSave && request.method() === 'PUT' && path === '/api/v1/settings') {
      allowSave = false;
      const csrf = (await browserContext.cookies(baseUrl)).find(cookie => cookie.name === 'harmoniarr_csrf')?.value;
      assert.equal(typeof csrf === 'string' && csrf.length > 0 && request.headers()['x-csrf-token'] === csrf, true);
      const paths = request.postDataJSON().paths;
      assert.equal(paths.downloadMappings.length, 4); assert.equal(paths.userMusicRoots.length, 4);
      assert.equal(paths.downloadMappings.every(row => Object.keys(row).sort().join(',') === 'harmoniarrPrefix,slskdPrefix'), true);
      assert.equal(paths.userMusicRoots.every(row => Object.keys(row).sort().join(',') === 'relativeRoot,userId'), true);
      assert.equal(paths.downloadMappings[0].slskdPrefix === '/source/b-edited' && paths.downloadMappings[0].harmoniarrPrefix === '/fixture/downloads/b-edited', true);
      assert.equal(paths.userMusicRoots[0].userId === 'fixture_b_edited' && paths.userMusicRoots[0].relativeRoot === 'family/b-edited', true);
      controlledSaves.push({ csrfPreserved: true, canonicalRowKeys: true, editedRowsSerialized: true, mappingRows: 4, folderRows: 4 });
      await route.fulfill({ status: 503, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ error: { code: 'fixture', message: 'The storage fixture did not save changes.' } }) }); return;
    }
    if (!['GET', 'HEAD'].includes(request.method())) { blockedWrites++; await route.abort('blockedbyclient'); return; }
    if (path !== '/api/v1/settings' || request.method() !== 'GET') { await route.continue(); return; }
    const response = await route.fetch(); assert.equal(response.status(), 200); const body = await response.json();
    Object.assign(body.settings.paths, { downloads: '/fixture/downloads', music: '/fixture/music', staging: '/fixture/staging', transcodeTemp: '/fixture/work',
      downloadMappings: ['a', 'b', 'c'].map(value => ({ slskdPrefix: '/source/' + value, harmoniarrPrefix: '/fixture/downloads/' + value })),
      userMusicRoots: ['a', 'b', 'c'].map(value => ({ userId: 'fixture_' + value, relativeRoot: 'family/' + value })) });
    body.settings.artwork.fetchEnabled = true; body.pathValidation = null; settingsReads++;
    await route.fulfill({ response, json: body });
  };
  page.on('pageerror', onError); await browserContext.route('**/api/v1/**', guard);
  try {
    await page.goto(baseUrl + '/app/settings/media-storage', { waitUntil: 'domcontentloaded' });
    await page.locator('.cfg-page form .settings-save-bar').waitFor();
    await expect(page.locator('.settings-save-bar')).toHaveAttribute('data-save-state', 'initial');
    if (configureZoom) { await configureZoom(); assert.deepEqual(await page.evaluate(() => [globalThis.innerWidth, globalThis.innerHeight]), [320, 256]); }
    for (const name of ['path translations', 'additional folder options', 'cover art settings']) await page.getByRole('button', { name: 'Show ' + name, exact: true }).click();
    const mapping = await exerciseRows(page, { title: 'Path translation', labels: ['Download client path', 'Harmoniarr sees it as'], edited: ['/source/b-edited', '/fixture/downloads/b-edited'], addLabel: 'Add path translation', fresh: [['/source/d', '/fixture/downloads/d'], ['/source/e', '/fixture/downloads/e']] });
    const folder = await exerciseRows(page, { title: 'User library folder', labels: ['User', 'Subfolder'], edited: ['fixture_b_edited', 'family/b-edited'], addLabel: 'Add folder', fresh: [['fixture_d', 'family/d'], ['fixture_e', 'family/e']] });
    const preserved = async () => {
      assert.equal(await page.locator(`[id="${mapping.ids[0]}"]`).inputValue() === '/source/b-edited', true);
      assert.equal(await page.locator(`[id="${folder.ids[0]}"]`).inputValue() === 'fixture_b_edited', true);
    };
    const sizes = configureZoom ? [['native-zoom', 320, 256]] : [['desktop', 1440, 900], ['tablet', 800, 900], ['mobile', 390, 844], ['reflow', 320, 256]];
    for (const theme of ['light', 'dark']) for (const [label, width, height] of sizes) {
      await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
      if (!configureZoom) await page.setViewportSize({ width, height });
      await verifyLabels(page);
      const geometry = await inspectSettingsForm(page); assert.equal(geometry.noHorizontalOverflow, true); assert.equal(geometry.barWithinForm, true);
      const forward = await traverseSettingsForm(page), reverse = await traverseSettingsForm(page, { backwards: true }); await preserved();
      if (configureZoom) assert.deepEqual(await page.evaluate(() => [globalThis.innerWidth, globalThis.innerHeight]), [320, 256]);
      scenes.push({ label, theme, fields: 29, mappingRows: 4, folderRows: 4, geometry, forward, reverse });
      if (evidenceDir && label !== 'reflow') {
        const filename = `storage-labels-${theme}-${label}.png`;
        const group = page.getByRole('group', { name: 'Path translation 1', exact: true });
        if (configureZoom) { await group.getByLabel('Download client path', { exact: true }).focus(); await page.screenshot({ path: join(evidenceDir, filename), animations: 'disabled' }); }
        else await group.locator('..').screenshot({ path: join(evidenceDir, filename), animations: 'disabled' });
        screenshots.push(filename);
      }
    }
    const fetching = page.getByRole('checkbox', { name: 'Download cover art from the internet', exact: true });
    await fetching.uncheck(); await expect(page.getByLabel('Sources to try', { exact: true })).toHaveCount(0);
    await fetching.check(); await verifyLabels(page); await preserved();
    for (const name of ['path translations', 'additional folder options', 'cover art settings']) {
      await page.getByRole('button', { name: 'Hide ' + name, exact: true }).click();
      await page.getByRole('button', { name: 'Show ' + name, exact: true }).click();
    }
    await preserved(); allowSave = true; await page.locator('.settings-save-bar button[type="submit"]').click();
    await page.locator('.settings-save-bar__outcome').filter({ hasText: 'Settings could not be saved' }).waitFor(); await preserved();
    const removalFocus = [];
    for (const [title, firstLabel, addLabel] of [['Path translation', 'Download client path', 'Add path translation'], ['User library folder', 'User', 'Add folder']]) {
      const group = position => page.getByRole('group', { name: `${title} ${position}`, exact: true });
      const remove = async position => group(position).locator('..').getByRole('button', { name: /^Remove /u }).click();
      const visibleFocus = async target => {
        await expect(target).toBeFocused();
        assert.equal(await target.evaluate(node => { const rect = node.getBoundingClientRect(); return node.contains(globalThis.document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)); }), true);
      };
      await remove(1); await visibleFocus(group(1).getByLabel(firstLabel, { exact: true }));
      await remove(3); await visibleFocus(group(2).getByLabel(firstLabel, { exact: true }));
      await remove(1); await visibleFocus(group(1).getByLabel(firstLabel, { exact: true }));
      const region = page.getByRole('region', { name: title === 'Path translation' ? 'Path translations' : 'Additional folders', exact: true });
      await remove(1); await visibleFocus(region.getByRole('button', { name: addLabel, exact: true }));
      removalFocus.push({ type: title, nextRow: true, previousRow: true, emptyListAdd: true, visible: true });
    }
    assert.equal(controlledSaves.length, 1); assert.equal(blockedWrites, 0); assert.deepEqual(errors, []); assert.ok(settingsReads > 0);
    return { scenes, screenshots, fields: 29, rowIdentity: { mapping, folder }, controlledSaves, removalFocus,
      draftPreserved: true, conditionalFields: true, disclosureReopen: true, settingsReads, blockedWrites, pageErrors: errors, noForwardedMutation: true,
      unqualifiedBrowseActions: await page.getByRole('button', { name: 'Browse…', exact: true }).count(), nativeZoom: Boolean(configureZoom) };
  } finally { page.off('pageerror', onError); await browserContext.unroute('**/api/v1/**', guard); }
}
