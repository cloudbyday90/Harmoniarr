/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { expect } from 'playwright/test';

const targets = [
  ['downloads folder', 'Downloads folder', 'Downloads folder', 'downloads'],
  ['music library', 'Music library', 'Music library', 'music'],
  ['staging area', 'Staging area', 'Staging area', 'staging'],
  ['transcode workspace', 'Transcode workspace', 'Transcode workspace', 'transcodeTemp'],
];

async function inspectDialog(page, dialog) {
  const geometry = await dialog.evaluate(node => {
    const box = node.getBoundingClientRect();
    return { withinViewport: box.left >= 0 && box.top >= 0 && box.right <= globalThis.innerWidth + 1 && box.bottom <= globalThis.innerHeight + 1,
      noHorizontalOverflow: node.scrollWidth <= node.clientWidth + 1,
      modal: node.matches(':modal'), named: Boolean(node.getAttribute('aria-labelledby')) };
  });
  assert.equal(Object.values(geometry).every(Boolean), true);
  // Native wrapping may briefly focus the document body; it must never reach an outside control.
  for (const key of ['Tab', 'Shift+Tab']) for (let step = 0; step < 9; step++) {
    await page.keyboard.press(key);
    assert.equal(await dialog.evaluate(node => node.contains(globalThis.document.activeElement) || globalThis.document.activeElement === globalThis.document.body), true);
  }
  for (const button of [dialog.getByRole('button', { name: 'Cancel', exact: true }), dialog.getByRole('button', { name: 'Select this folder', exact: true })]) {
    await button.scrollIntoViewIfNeeded();
    assert.equal(await button.evaluate(node => {
      const r = node.getBoundingClientRect();
      return r.width >= 24 && r.height >= 24 && r.left >= 0 && r.right <= globalThis.innerWidth + 1
        && r.top >= 0 && r.bottom <= globalThis.innerHeight + 1 && node.contains(globalThis.document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), true);
  }
  return geometry;
}

/** Synthetic read-only filesystem scenes; no filesystem GET or mutation is forwarded. */
export async function runFolderBrowserScenario({ page, browserContext, baseUrl, evidenceDir, configureZoom }) {
  const errors = [], scenes = [], pageScenes = [], screenshots = [], pending = new Set();
  const drafts = { downloads: '/fixture/downloads', music: '/fixture/music', staging: '/fixture/staging', transcodeTemp: '/fixture/work' };
  let mode = 'success', paging = false, reads = 0, blockedWrites = 0, settingsReads = 0;
  const onError = error => errors.push(error.name);
  const guard = async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) { blockedWrites++; await route.abort('blockedbyclient'); return; }
    if (url.pathname === '/api/v1/system/fs/browse') {
      reads++; const path = url.searchParams.get('path'), selectedMode = mode; mode = 'success';
      const payload = { ok: true, path, parent: '/fixture', entries: path.endsWith('/albums') ? [] : [{ name: 'Albums', path: path + '/albums' }] };
      payload.page = { limit: 100, total: payload.entries.length, from: payload.entries.length ? 1 : 0, to: payload.entries.length, previousCursor: null, nextCursor: null };
      if (paging) {
        const offset = url.searchParams.get('cursor') === 'page-3' ? 200 : url.searchParams.get('cursor') === 'page-2' ? 100 : 0;
        payload.entries = Array.from({ length: Math.min(100, 205 - offset) }, (_, index) => {
          const name = 'Folder ' + String(offset + index).padStart(3, '0'); return { name, path: path + '/' + name };
        });
        payload.page = { limit: 100, total: 205, from: offset + 1, to: offset + payload.entries.length,
          previousCursor: offset === 200 ? 'page-2' : offset === 100 ? 'page-1' : null,
          nextCursor: offset === 0 ? 'page-2' : offset === 100 ? 'page-3' : null };
      }
      if (selectedMode === 'hold') {
        await new Promise(resolve => {
          const release = async () => {
            pending.delete(release);
            try { await route.fulfill({ json: payload }); } finally { resolve(); }
          };
          pending.add(release);
        }); return;
      }
      if (selectedMode === 'fail') { await route.fulfill({ status: 403, json: { ok: false, error: 'Fixture refusal' } }); return; }
      if (selectedMode === 'changed' || selectedMode === 'ceiling') {
        await route.fulfill({ status: selectedMode === 'changed' ? 409 : 422, json: { error: { code: selectedMode === 'changed' ? 'folder_page_changed' : 'folder_scan_limit', message: 'Fixture refusal' } } }); return;
      }
      await route.fulfill({ json: selectedMode === 'malformed' ? { ...payload, ok: false } : payload }); return;
    }
    if (url.pathname === '/api/v1/settings') {
      const response = await route.fetch(); assert.equal(response.status(), 200);
      const body = await response.json(); Object.assign(body.settings.paths, drafts); body.pathValidation = null; settingsReads++;
      await route.fulfill({ response, json: body }); return;
    }
    await route.continue();
  };
  const invoker = target => page.getByRole('button', { name: 'Browse ' + target[0], exact: true });
  const field = target => page.getByLabel(target[2], { exact: true });
  const dialogFor = target => page.getByRole('dialog', { name: target[1], exact: true });
  const open = async (target, keyboard = true) => {
    const button = invoker(target);
    if (keyboard) { await button.focus(); await button.press('Enter'); } else await button.click();
    const dialog = dialogFor(target); await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close folder browser', exact: true })).toBeFocused();
    return dialog;
  };
  const assertDrafts = async () => {
    for (const target of targets) assert.equal(await field(target).inputValue() === drafts[target[3]], true);
  };
  const returned = async target => { await expect(page.getByRole('dialog')).toHaveCount(0); await expect(invoker(target)).toBeFocused(); await assertDrafts(); };
  page.on('pageerror', onError); await browserContext.route('**/api/v1/**', guard);
  try {
    await page.goto(baseUrl + '/app/settings/media-storage', { waitUntil: 'domcontentloaded' });
    await page.locator('.settings-save-bar').waitFor();
    await page.getByRole('button', { name: 'Show additional folder options', exact: true }).click();
    if (configureZoom) await configureZoom();
    // Preserve an unrelated unsaved draft through every open, navigation and dismissal.
    drafts.music = '/fixture/music-draft'; await field(targets[1]).fill(drafts.music);
    const sizes = configureZoom ? [['native-zoom', 320, 256]] : [['desktop', 1440, 900], ['tablet', 800, 900], ['mobile', 390, 844], ['reflow', 320, 256]];
    for (const theme of ['light', 'dark']) for (const [label, width, height] of sizes) {
      await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
      if (!configureZoom) await page.setViewportSize({ width, height });
      for (const target of targets) {
        drafts[target[3]] = `/fixture/${target[3]}/${label}-${theme}-draft`;
        await field(target).fill(drafts[target[3]]);
      }
      for (let index = 0; index < targets.length; index++) {
        const target = targets[index], dialog = await open(target, index % 2 === 0);
        const select = dialog.getByRole('button', { name: 'Select this folder', exact: true });
        await expect(select).toBeEnabled();
        assert.equal(await dialog.getByRole('list', { name: 'Folders', exact: true }).count(), 1);
        assert.equal(await dialog.getByRole('listbox').count(), 0);
        const geometry = await inspectDialog(page, dialog);
        await dialog.getByRole('button', { name: 'Albums', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(dialog.locator('.fb-current-path')).toBeFocused();
        await expect(dialog.getByRole('status')).toHaveText('No subfolders here.');
        drafts[target[3]] += '/albums';
        if (evidenceDir && index === 3 && (configureZoom || label === 'desktop' || label === 'mobile' || label === 'reflow')) {
          const file = `${label}-${theme}-dialog.png`; await page.screenshot({ path: join(evidenceDir, file) }); screenshots.push(file);
        }
        await select.focus(); await select.press('Enter'); await returned(target);
        scenes.push({ label, theme, target: target[3], geometry, navigationFocus: true, nativeReturn: true, draftOnly: true });
      }
      if (configureZoom) assert.deepEqual(await page.evaluate(() => [globalThis.innerWidth, globalThis.innerHeight]), [320, 256]);
    }
    const target = targets[0];
    for (const exit of ['escape', 'cancel', 'close', 'backdrop']) {
      const dialog = await open(target); await expect(dialog.getByRole('button', { name: 'Select this folder', exact: true })).toBeEnabled();
      if (exit === 'escape') await page.keyboard.press('Escape');
      else if (exit === 'backdrop') await page.mouse.click(1, 1);
      else await dialog.getByRole('button', { name: exit === 'cancel' ? 'Cancel' : 'Close folder browser', exact: true }).click();
      await returned(target);
    }
    mode = 'hold'; let dialog = await open(target);
    await expect.poll(() => pending.size).toBe(1);
    await expect(dialog.getByRole('status')).toHaveText('Loading folders…');
    await expect(dialog.getByRole('button', { name: 'Select this folder', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape'); await returned(target);
    const second = targets[1]; dialog = await open(second);
    await expect(dialog.getByRole('button', { name: 'Select this folder', exact: true })).toBeEnabled();
    await Promise.all([...pending].map(release => release()));
    await expect(dialog.locator('.fb-current-path')).toHaveText(drafts.music);
    await expect(dialog.getByRole('button', { name: 'Close folder browser', exact: true })).toBeFocused();
    await page.keyboard.press('Escape'); await returned(second);
    for (const refusal of ['fail', 'malformed']) {
      mode = refusal; dialog = await open(target);
      await expect(dialog.getByRole('status')).toHaveText('Could not read this folder. Try again.');
      await expect(dialog.getByRole('button', { name: 'Select this folder', exact: true })).toBeDisabled();
      await dialog.getByRole('button', { name: 'Retry', exact: true }).focus(); await page.keyboard.press('Enter');
      await expect(dialog.locator('.fb-current-path')).toBeFocused();
      await expect(dialog.getByRole('button', { name: 'Select this folder', exact: true })).toBeEnabled();
      await page.keyboard.press('Escape'); await returned(target);
    }
    dialog = await open(target);
    await expect(dialog.getByRole('button', { name: 'Select this folder', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: '↑ Up', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(dialog.locator('.fb-current-path')).toBeFocused();
    await expect(dialog.locator('.fb-current-path')).toHaveText('/fixture');
    await page.keyboard.press('Escape'); await returned(target);
    paging = true;
    for (const theme of ['light', 'dark']) for (const [label, width, height] of sizes) {
      await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
      if (!configureZoom) await page.setViewportSize({ width, height });
      dialog = await open(target);
      const next = dialog.getByRole('button', { name: 'Next folders', exact: true });
      const previous = dialog.getByRole('button', { name: 'Previous folders', exact: true });
      const restart = dialog.getByRole('button', { name: 'Start again', exact: true });
      const select = dialog.getByRole('button', { name: 'Select this folder', exact: true });
      const checkPage = async (from, to, count) => {
        await expect(dialog.getByRole('status')).toHaveText(`Folders ${from}–${to} of 205.`);
        await expect(dialog.locator('.fb-entry')).toHaveCount(count);
        await expect(select).toBeEnabled();
      };
      await checkPage(1, 100, 100); await expect(previous).toBeDisabled();
      mode = 'hold'; await next.focus(); await next.press('Enter');
      await expect.poll(() => pending.size).toBe(1); await expect(select).toBeDisabled();
      await expect(dialog.locator('.fb-current-path')).toBeFocused();
      const close = dialog.getByRole('button', { name: 'Close folder browser', exact: true }); await close.focus();
      await Promise.all([...pending].map(release => release()));
      await checkPage(101, 200, 100); await expect(close).toBeFocused();
      await expect(dialog.getByRole('button', { name: 'Folder 000', exact: true })).toHaveCount(0);
      const geometry = await inspectDialog(page, dialog);
      if (evidenceDir && (configureZoom || label === 'desktop' || label === 'mobile' || label === 'reflow')) {
        const file = `paged-${label}-${theme}.png`; await page.screenshot({ path: join(evidenceDir, file) }); screenshots.push(file);
      }
      await next.focus(); await next.press('Enter'); await checkPage(201, 205, 5); await expect(next).toBeDisabled();
      await previous.focus(); await previous.press('Enter'); await checkPage(101, 200, 100);
      mode = 'changed'; await next.focus(); await next.press('Enter');
      await expect(dialog.getByRole('status')).toContainText('Start again to reload'); await expect(select).toBeDisabled();
      await restart.focus(); await restart.press('Enter'); await checkPage(1, 100, 100);
      mode = 'ceiling'; await restart.focus(); await restart.press('Enter');
      await expect(dialog.getByRole('status')).toHaveText('This folder is too large to browse. Enter a more specific path.');
      await expect(select).toBeDisabled();
      await restart.focus(); await restart.press('Enter'); await checkPage(1, 100, 100);
      await page.keyboard.press('Escape'); await returned(target);
      pageScenes.push({ label, theme, geometry, maxRendered: 100, terminalRendered: 5, noAppend: true, previousAndRestart: true, refusalPreservesDrafts: true, lateFocusPreserved: true });
      if (configureZoom) assert.deepEqual(await page.evaluate(() => [globalThis.innerWidth, globalThis.innerHeight]), [320, 256]);
    }
    assert.equal(blockedWrites, 0); assert.equal(settingsReads, 1); assert.deepEqual(errors, []);
    return { scenes, pageScenes, screenshots, folderReads: reads, syntheticFilesystemOnly: true, blockedWrites, settingsReads,
      dismissalPaths: 4, heldReadRetired: true, crossTargetReadFenced: true, retryCases: 2, draftsPreserved: true, pageErrors: 0 };
  } finally {
    await Promise.all([...pending].map(release => release()));
    page.off('pageerror', onError); await browserContext.unroute('**/api/v1/**', guard);
  }
}
