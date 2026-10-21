/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecoveryDockerCommand } from '../../scripts/postgres-recovery-command.js';
import { withBrowserSession } from '../../testing/browser/browser-session.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { withManualHistorySession } from '../../testing/manual/metadata-history-session.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
test('manual fixture serves real authenticated history with held/failure/retry/final states and retires a held read', { timeout: config.suiteSetupTimeoutMs + config.scenarioTimeoutMs + config.suiteTeardownTimeoutMs }, async () => {
  let base; let control; let containerId;
  const runDocker = createRecoveryDockerCommand();
  await withManualHistorySession(context => withBrowserSession({}, async ({ browser, browserContext }) => {
    const { baseUrl, artistUrl, controller } = context; base = baseUrl; control = controller;
    // Resolve the owned database by its actual acknowledged port, not another session's label.
    const ids = (await runDocker(['container', 'ls', '--filter', 'label=io.harmoniarr.manual-history', '--format', '{{.ID}}'])).stdout.trim().split(/\r?\n/u).filter(Boolean);
    const containers = JSON.parse((await runDocker(['container', 'inspect', ...ids])).stdout);
    const owned = containers.find(row => row.NetworkSettings.Ports['5432/tcp']?.some(binding => Number(binding.HostPort) === context.databaseConfig.port));
    assert.ok(owned); containerId = owned.Id;
    assert.deepEqual(owned.NetworkSettings.Ports['5432/tcp'], [{ HostIp: '127.0.0.1', HostPort: String(context.databaseConfig.port) }]);
    assert.equal(owned.HostConfig.Memory, 512 * 1024 * 1024); assert.equal(owned.HostConfig.NanoCpus, 2_000_000_000);
    const page = await browserContext.newPage(); page.setDefaultTimeout(config.browserActionTimeoutMs);
    await bootstrapAdminThroughUi(page, { baseUrl });
    await page.goto(artistUrl, { waitUntil: 'domcontentloaded' });
    const load = page.getByRole('button', { name: 'Load more history', exact: true }); await load.waitFor();
    const status = page.getByRole('status', { name: 'Detection history status', exact: true });
    controller.command('hold'); await load.press('Enter');
    await status.getByText('Loading more history.', { exact: true }).waitFor();
    assert.equal(controller.status().pending, true);
    const input = page.getByLabel('Artist name', { exact: true }); await input.focus();
    controller.command('release'); await status.getByText('Loaded 10 more history entries.', { exact: true }).waitFor();
    assert.equal(await input.evaluate(node => node.ownerDocument.activeElement === node), true);
    controller.command('fail'); await load.press('Enter');
    await status.getByText(/Controlled manual history failure/u).waitFor(); assert.equal(await load.isEnabled(), true);
    await load.press('Enter'); await status.getByText('Loaded 1 more history entry. All history loaded.', { exact: true }).waitFor();
    assert.equal(await load.count(), 0);
    assert.equal(await page.getByRole('heading', { name: 'Recent discoveries', exact: true }).evaluate(node => node.ownerDocument.activeElement === node), true);
    // The outer HTTP guard, rather than renderer interception, refuses these calls.
    for (const [path, method] of [['/api/v1/metadata/artists/search?q=fixture', 'GET'], [new URL(artistUrl).searchParams.get('artistId'), 'POST']]) {
      const url = method === 'POST' ? `/api/v1/metadata/artists/${path}/refresh` : path;
      assert.equal((await page.request.fetch(`${baseUrl}${url}`, { method })).status(), 403);
    }
    assert.equal((await context.getPoolFn().query('select count(*)::int as count from app_users')).rows[0].count, 1);
    console.log(`[manual-history-fixture] Chromium ${browser.version()}; fresh PostgreSQL; controlled UI states only`);
    controller.command('reset'); await page.reload({ waitUntil: 'domcontentloaded' }); await load.waitFor();
    controller.command('hold'); await load.press('Enter'); await status.getByText('Loading more history.', { exact: true }).waitFor();
    assert.equal(controller.status().pending, true);
    // Browser disconnect precedes controller/HTTP/database retirement.
  }));
  assert.equal(control.status().closed, true); assert.equal(control.status().pending, false);
  await assert.rejects(fetch(`${base}/api/v1/auth/session`));
  assert.equal((await runDocker(['container', 'ls', '--all', '--filter', `id=${containerId}`, '--format', '{{.ID}}'])).stdout.trim(), '');
});
