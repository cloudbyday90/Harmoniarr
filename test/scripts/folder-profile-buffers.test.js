/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createFolderBrowseService } from '../../src/server/filesystem/folder-browse-service.js';
import { parseFolderProfileCommand, createFolderProfilePlan } from '../../testing/performance/folder-profile-policy.js';
import { createFolderProfileWorkload } from '../../testing/performance/folder-profile-workload.js';

const args = ['--image', 'sha256:' + 'a'.repeat(64), '--output', 'profile.json', '--storage', 'volume'];
const facts = () => ({ dev: 1n, ino: 2n, mtimeNs: 3n, ctimeNs: 4n, isDirectory: () => true });
const name = index => 'folder-' + String(index).padStart(5, '0');

test('buffer comparison is explicit, fixed and cannot silently replace the algorithm default', () => {
  assert.equal(parseFolderProfileCommand(args).comparison, 'algorithms');
  assert.equal(parseFolderProfileCommand([...args, '--comparison', 'buffers']).comparison, 'buffers');
  for (const value of ['32,128', 'adaptive', '__proto__']) assert.throws(() => parseFolderProfileCommand([...args, '--comparison', value]));
  for (const bufferSize of [0, 64, 129, '128', null]) assert.throws(() => createFolderProfileWorkload({
    caseName: 'small', algorithm: 'stream', bufferSize, pages: 1,
  }));
  assert.throws(() => createFolderProfileWorkload({ caseName: 'small', algorithm: 'readdir', bufferSize: 128, pages: 1 }));
});

test('buffer plan pairs equal work, alternates order and separates sampling-off controls', () => {
  const plan = createFolderProfilePlan({ cases: ['small', 'large', 'mixed', 'ceiling'], repeats: 4, comparison: 'buffers' });
  assert.equal(plan.length, 72); assert.ok(plan.every(row => row.algorithm === 'stream'));
  for (let index = 0; index < plan.length; index += 2) {
    const [first, second] = plan.slice(index, index + 2);
    assert.deepEqual({ ...first, bufferSize: null }, { ...second, bufferSize: null });
    assert.deepEqual([first.bufferSize, second.bufferSize], first.repeat % 2 ? [128, 32] : [32, 128]);
  }
  const controls = plan.filter(row => !row.observed);
  assert.equal(controls.length, 8); assert.ok(controls.every(row => row.caseName === 'large' && row.pages === 3));
});

test('both native buffer options traverse the real guarded service with identical independent page data', async () => {
  const results = [];
  for (const bufferSize of [32, 128]) {
    const options = [];
    const filesystem = { stat: async () => facts(), opendir: async (_path, received) => {
      options.push(received); let index = 1000;
      return { read: () => Promise.resolve(index ? { name: name(--index), isDirectory: () => true } : null), close: async () => {} };
    } };
    const result = await createFolderProfileWorkload({ createService: createFolderBrowseService, filesystem,
      path: '/fixture', caseName: 'small', algorithm: 'stream', bufferSize, pages: 3 })();
    assert.equal(result.status, 'success'); assert.equal(result.bufferSize, bufferSize);
    assert.equal(result.counts.directoryReads, 3003); assert.equal(result.counts.stats, 6); assert.equal(result.counts.bufferChecks, 3);
    assert.equal(result.counts.liveHandles, 0); assert.equal(result.counts.directoryCloses, 3);
    assert.deepEqual(options, Array.from({ length: 3 }, () => ({ bufferSize }))); results.push(result);
  }
  assert.equal(results[0].digest, results[1].digest);
});

test('buffer substitution refuses unexpected production options before opening native work', async () => {
  let service, opens = 0;
  createFolderProfileWorkload({ createService: dependencies => { service = dependencies; return {}; },
    filesystem: { opendir: async () => { opens++; } }, path: '/fixture', caseName: 'small', algorithm: 'stream', bufferSize: 128, pages: 1 });
  for (const options of [undefined, { bufferSize: 128 }, { bufferSize: 32, recursive: true }]) {
    await assert.rejects(service.openDirectory('/fixture', options), error => error.code === 'ERR_ASSERTION');
  }
  assert.equal(opens, 0);
});

test('both buffers retain raw-entry, cooperative deadline and metadata refusals with actual close', async () => {
  for (const bufferSize of [32, 128]) for (const refusal of ['folder_scan_limit', 'folder_browse_timeout', 'folder_page_changed']) {
    let clock = 0, stats = 0, reads = 0, closed = false;
    const filesystem = { stat: async () => ({ ...facts(), ino: refusal === 'folder_page_changed' && ++stats === 2 ? 9n : 2n }),
      opendir: async (_path, options) => {
        assert.deepEqual(options, { bufferSize });
        return { read: () => { reads++; if (refusal === 'folder_browse_timeout') clock = 5001;
          return Promise.resolve(refusal === 'folder_scan_limit' ? { name: 'ordinary-file', isDirectory: () => false } : null); },
        close: async () => { closed = true; } };
      } };
    const result = await createFolderProfileWorkload({ createService: dependencies => createFolderBrowseService({ ...dependencies, now: () => clock }),
      filesystem, path: '/fixture', caseName: 'small', algorithm: 'stream', bufferSize, pages: 1 })();
    assert.equal(result.status, 'refused'); assert.equal(result.refusal, refusal); assert.equal(result.completedPages, 0);
    assert.equal(closed, true); assert.equal(result.counts.liveHandles, 0); assert.equal(result.counts.directoryCloses, 1);
    assert.equal(reads, refusal === 'folder_scan_limit' ? 50_001 : 1);
  }
});

test('both buffer adapters retain all four admission slots until delayed native close settles', { timeout: 5000 }, async () => {
  for (const bufferSize of [32, 128]) {
    const closing = Promise.withResolvers(), entered = Promise.withResolvers(); let service, closes = 0, opens = 0;
    createFolderProfileWorkload({ createService: dependencies => { service = createFolderBrowseService(dependencies); return service; },
      path: '/fixture', caseName: 'small', algorithm: 'stream', bufferSize, pages: 1,
      filesystem: { stat: async () => facts(), opendir: async (_path, options) => {
        assert.deepEqual(options, { bufferSize }); opens++;
        return { read: () => Promise.resolve(null), close: () => { if (++closes === 4) entered.resolve(); return closing.promise; } };
      } } });
    const browse = () => service.browse({ path: '/fixture', actorUserId: 'fixture-admin' });
    const active = Array.from({ length: 4 }, browse), completed = Promise.all(active);
    try {
      await Promise.race([entered.promise, completed.then(() => { throw new Error('Close barrier was not held'); })]);
      await assert.rejects(browse(), error => error.code === 'folder_browse_busy'); assert.equal(opens, 4);
    } finally { closing.resolve(); await Promise.allSettled(active); }
    await completed; await browse(); assert.equal(opens, 5); assert.equal(closes, 5);
  }
});
