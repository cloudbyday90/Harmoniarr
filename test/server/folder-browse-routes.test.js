/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { registerFolderBrowseRoutes } from '../../src/server/routes/folder-browse-routes.js';
import { createApiError } from '../../src/server/api-error.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

test('default HTTP composition serves real bounded pages and refuses repeated query values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-folder-http-'));
  assert.equal(dirname(resolvePath(root)), resolvePath(tmpdir()));
  try {
    await mkdir(join(root, 'Album'));
    const app = createJsonTestApp(routerApp => registerFolderBrowseRoutes(routerApp, { requireAdminSession: async () => ({ appUserId: 'admin-1' }) }));
    await withServer(app, async baseUrl => {
      const response = await fetch(baseUrl + '/api/v1/system/fs/browse?' + new URLSearchParams({ path: root }));
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.json(); assert.equal(body.entries[0].name, 'Album'); assert.equal(body.page.total, 1); assert.equal(body.page.limit, 100);
      const invalid = await fetch(baseUrl + '/api/v1/system/fs/browse?path=one&path=two');
      assert.equal(invalid.status, 400); assert.equal((await invalid.json()).error.code, 'folder_query_invalid');
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('folder route authenticates every page, passes owned inputs and marks responses no-store', async () => {
  const calls = []; let allowed = false;
  const app = createJsonTestApp(routerApp => registerFolderBrowseRoutes(routerApp, {
    requireAdminSession: async () => { if (!allowed) throw createApiError(403, 'admin_required', 'Admin required'); return { appUserId: 'admin-1' }; },
    browseDirectory: async input => { calls.push(input); return { ok: true }; },
  }));
  await withServer(app, async baseUrl => {
    assert.equal((await fetch(baseUrl + '/api/v1/system/fs/browse?cursor=unknown')).status, 403); assert.equal(calls.length, 0);
    allowed = true;
    const response = await fetch(baseUrl + '/api/v1/system/fs/browse?path=%2Ffixture&cursor=next.page');
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(calls[0].actorUserId, 'admin-1'); assert.equal(calls[0].path, '/fixture'); assert.equal(calls[0].cursor, 'next.page');
    assert.equal(calls[0].signal.aborted, false);
    allowed = false;
    assert.equal((await fetch(baseUrl + '/api/v1/system/fs/browse?cursor=next.page')).status, 403); assert.equal(calls.length, 1);
  });
});

test('HTTP disconnect aborts the owned scan; the service still controls settlement', async () => {
  let started, aborted, release;
  const starting = new Promise(resolve => { started = resolve; });
  const aborting = new Promise(resolve => { aborted = resolve; });
  const holding = new Promise(resolve => { release = resolve; });
  const app = createJsonTestApp(routerApp => registerFolderBrowseRoutes(routerApp, {
    requireAdminSession: async () => ({ appUserId: 'admin-1' }),
    browseDirectory: async ({ signal }) => { signal.addEventListener('abort', aborted, { once: true }); started(); await holding; return { ok: true }; },
  }));
  await withServer(app, async baseUrl => {
    const controller = new AbortController();
    const request = fetch(baseUrl + '/api/v1/system/fs/browse', { signal: controller.signal });
    const rejected = assert.rejects(request, error => error.name === 'AbortError');
    try { await starting; controller.abort(); await aborting; await rejected; }
    finally { release(); }
  });
});

test('disconnect while authentication is pending admits no filesystem scan', async () => {
  let start, close, release;
  const started = new Promise(done => { start = done; });
  const closed = new Promise(done => { close = done; });
  const held = new Promise(done => { release = done; });
  let scans = 0;
  const app = createJsonTestApp(routerApp => registerFolderBrowseRoutes(routerApp, {
    requireAdminSession: async request => { request.res.once('close', close); start(); await held; return { appUserId: 'admin-1' }; },
    browseDirectory: async () => { scans++; return { ok: true }; },
  }));
  await withServer(app, async baseUrl => {
    const controller = new AbortController();
    const request = fetch(baseUrl + '/api/v1/system/fs/browse', { signal: controller.signal });
    const rejected = assert.rejects(request, error => error.name === 'AbortError');
    try { await started; controller.abort(); await closed; release(); await rejected; await new Promise(done => { setImmediate(done); }); assert.equal(scans, 0); }
    finally { release(); }
  });
});
