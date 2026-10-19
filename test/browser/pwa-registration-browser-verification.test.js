/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

test('service worker first claim and another tab update preserve forms; requested update reloads', {
  timeout: 30_000,
}, async (testContext) => {
  const registrationSource = await readFile(new URL('../../src/client/lib/pwa-registration.js', import.meta.url));
  const workerSource = await readFile(new URL('../../src/client/public/service-worker.js', import.meta.url), 'utf8');
  const installEntered = Promise.withResolvers();
  const installRelease = Promise.withResolvers();
  let workerVersion = 1;
  const html = `<!doctype html><html lang="en"><title>PWA lifecycle fixture</title>
    <label>Draft<input aria-label="Draft"></label><button type="button">Reload</button>
    <script type="module">
      import { createPwaRegistration } from '/pwa-registration.js';
      const handle = createPwaRegistration();
      document.querySelector('button').addEventListener('click', () => handle.applyUpdate());
      await handle.init();
      globalThis.registration = await navigator.serviceWorker.getRegistration();
    </script></html>`;
  const server = createServer((request, response) => {
    void (async () => {
      if (request.url === '/manifest.webmanifest' && workerVersion === 1) {
        installEntered.resolve();
        await installRelease.promise;
      }
      const path = request.url;
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', path === '/service-worker.js' || path === '/pwa-registration.js'
        ? 'text/javascript' : 'text/html');
      response.end(path === '/service-worker.js' ? `${workerSource}\n// fixture version ${workerVersion}\n`
        : path === '/pwa-registration.js' ? registrationSource : html);
    })().catch(error => response.destroy(error));
  });
  let browser;
  const onAbort = () => {
    installEntered.resolve();
    installRelease.resolve();
    void browser?.close().catch(() => {});
  };
  testContext.signal.addEventListener('abort', onAbort, { once: true });
  await withWorkerTaskCleanup(async () => {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    await context.addInitScript(() => {
      globalThis.documentMarker = crypto.randomUUID();
      globalThis.controllerChanges = 0;
      navigator.serviceWorker.addEventListener('controllerchange', () => globalThis.controllerChanges++);
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    await page.goto(baseUrl);
    await installEntered.promise;
    await page.waitForFunction(() => !!globalThis.registration);
    const marker = await page.evaluate(() => globalThis.documentMarker);
    const draft = page.getByRole('textbox', { name: 'Draft' });
    await draft.fill('unsaved first-install draft');
    await draft.focus();
    assert.equal(await page.evaluate(() => navigator.serviceWorker.controller), null);
    installRelease.resolve();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller && globalThis.controllerChanges === 1);
    assert.equal(await page.evaluate(() => globalThis.documentMarker), marker);
    assert.equal(await draft.inputValue(), 'unsaved first-install draft');
    assert.equal(await draft.evaluate(element => element === globalThis.document.activeElement), true);

    const sibling = await context.newPage();
    sibling.setDefaultTimeout(10_000);
    await sibling.goto(baseUrl);
    await sibling.waitForFunction(() => !!globalThis.registration && !!navigator.serviceWorker.controller);
    const siblingMarker = await sibling.evaluate(() => globalThis.documentMarker);
    const siblingDraft = sibling.getByRole('textbox', { name: 'Draft' });
    await siblingDraft.fill('unsaved sibling draft');
    await siblingDraft.focus();
    workerVersion = 2;
    await page.evaluate(() => globalThis.registration.update());
    await page.waitForFunction(() => !!globalThis.registration.waiting);
    await Promise.all([
      page.waitForEvent('domcontentloaded'),
      page.getByRole('button', { name: 'Reload', exact: true }).click(),
    ]);
    assert.notEqual(await page.evaluate(() => globalThis.documentMarker), marker);
    await sibling.waitForFunction(() => globalThis.controllerChanges === 1);
    assert.equal(await sibling.evaluate(() => globalThis.documentMarker), siblingMarker);
    assert.equal(await siblingDraft.inputValue(), 'unsaved sibling draft');
    assert.equal(await siblingDraft.evaluate(element => element === globalThis.document.activeElement), true);
  }, async () => {
    testContext.signal.removeEventListener('abort', onAbort);
    installRelease.resolve();
    try { await browser?.close(); }
    finally {
      if (server.listening) await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    }
  });
});
