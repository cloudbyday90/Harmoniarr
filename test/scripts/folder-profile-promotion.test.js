/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, realpath, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createFolderBrowseService } from '../../src/server/filesystem/folder-browse-service.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import { longFolderProfileName, expectedFolderProfilePage } from '../../testing/performance/folder-profile-names.js';
import { folderProfileCases, parseFolderProfileCommand, createFolderProfilePlan } from '../../testing/performance/folder-profile-policy.js';
import { prepareFolderProfileFixture, resolveFolderProfileCase, removeFolderProfileFixture, seedFolderProfileOverflow } from '../../testing/performance/folder-profile-fixture.js';
import { createFolderPromotionWorkload } from '../../testing/performance/folder-profile-promotion-workload.js';

test('long fixture names preserve distinct canonical forms and bound actual UTF-8 bytes', () => {
  const names = Array.from({ length: 50_000 }, (_, index) => longFolderProfileName(index));
  assert.equal(new Set(names).size, 50_000);
  for (const name of names) { assert.ok(Buffer.byteLength(name, 'utf8') <= 255); assert.ok(name.length <= 255); assert.doesNotMatch(name, /[/\\\0]/u); }
  assert.equal(Buffer.byteLength(names[0], 'utf8'), 255); assert.equal(Buffer.byteLength(names[1], 'utf8'), 254);
  assert.equal(Buffer.byteLength(names[2], 'utf8'), 255); assert.equal(Buffer.byteLength(names[3], 'utf8'), 255);
  assert.notEqual(names[1], names[2]); assert.equal(names[1].normalize('NFD'), names[2]);
  assert.ok(names[3].includes('\u{1f3b5}')); assert.ok(names[49_999].endsWith('12499'));
  const sorted = names.toSorted();
  for (const page of [0, 1, 124, 125, 249, 250, 374, 375, 499, 500]) assert.deepEqual(expectedFolderProfilePage(folderProfileCases['long-ceiling'], page), sorted.slice(page * 100, (page + 1) * 100));
  for (const index of [-1, 50_000, 0.5, NaN]) assert.throws(() => longFolderProfileName(index));
  assert.throws(() => expectedFolderProfilePage(folderProfileCases.names, -1));
});

test('bounded expected pages match independent ordinal sorting for partial fixture groups', () => {
  const sorted = Array.from({ length: 203 }, (_, index) => longFolderProfileName(index)).sort();
  for (let page = 0; page < 4; page++) assert.deepEqual(expectedFolderProfilePage(folderProfileCases.names, page), sorted.slice(page * 100, (page + 1) * 100));
  assert.ok(sorted[99].includes('\u0301')); assert.ok(sorted[199].includes('\u{1f3b5}'));
});

test('long ceiling selection preserves fixed concurrent variants and rejects non-ceiling cases', () => {
  const args = ['--image', 'sha256:' + 'a'.repeat(64), '--output', 'profile.json', '--storage', 'volume', '--experiment', 'concurrent-ceiling', '--cases', 'long-ceiling'];
  const selection = parseFolderProfileCommand(args), plan = createFolderProfilePlan(selection);
  assert.equal(plan.length, 16); assert.ok(plan.every(row => row.caseName === 'long-ceiling' && row.concurrency === 4));
  assert.deepEqual([...new Set(plan.map(row => row.bufferSize))].sort((a, b) => a - b), [32, 128]);
  assert.throws(() => parseFolderProfileCommand(args.map(value => value === 'long-ceiling' ? 'names' : value)));
});

test('real filesystem promotion verifies Unicode cursor boundaries, full reverse paging and guarded refusals', async () => {
  const parent = await realpath(await mkdtemp(join(tmpdir(), 'harmoniarr-promotion-'))), owner = randomUUID();
  assert.equal(dirname(parent), await realpath(tmpdir()));
  await withWorkerTaskCleanup(async () => {
    await prepareFolderProfileFixture({ parent, owner, cases: ['names'] });
    const path = await resolveFolderProfileCase({ parent, owner, caseName: 'names' });
    const row = await createFolderPromotionWorkload({ createService: createFolderBrowseService, path })();
    assert.equal(row.productionBufferSize, 128); assert.equal(row.exactNames, 203); assert.equal(row.uniqueNames, 203);
    assert.equal(row.forwardPages, 3); assert.equal(row.reversePages, 2); assert.equal(row.normalizationPreserved, true);
    assert.deepEqual(row.refusals, ['folder_page_changed', 'folder_browse_timeout', 'folder_not_directory', 'folder_not_found']);
    assert.equal(row.counts.opens, 7); assert.equal(row.counts.closes, 7); assert.equal(row.counts.liveHandles, 0);
  }, async () => { await removeFolderProfileFixture({ parent, owner }); await rmdir(parent); });
});

test('overflow seeding requires the owned ceiling marker and cannot overwrite an existing entry', async () => {
  const parent = await realpath(await mkdtemp(join(tmpdir(), 'harmoniarr-overflow-'))), owner = randomUUID(), root = join(parent, owner);
  assert.equal(dirname(parent), await realpath(tmpdir()));
  await withWorkerTaskCleanup(async () => {
    await mkdir(root); await mkdir(join(root, 'ceiling'));
    await writeFile(join(root, '.fixture.json'), JSON.stringify({ owner, version: 1, cases: ['ceiling'] }));
    await writeFile(join(root, '.ready.json'), JSON.stringify({ owner }));
    await assert.rejects(seedFolderProfileOverflow({ parent, owner, caseName: 'names' }));
    await assert.rejects(seedFolderProfileOverflow({ parent, owner: randomUUID(), caseName: 'ceiling' }));
    const row = await seedFolderProfileOverflow({ parent, owner, caseName: 'ceiling' }); assert.equal(row.overflowSeeded, true);
    await assert.rejects(seedFolderProfileOverflow({ parent, owner, caseName: 'ceiling' }), error => error.code === 'EEXIST');
    assert.equal(await readFile(join(root, 'ceiling', 'profile-overflow-file'), 'utf8'), '');
  }, async () => { await removeFolderProfileFixture({ parent, owner }); await rmdir(parent); });
});

test('overflow verifier requires the production option, exact raw ceiling refusal and awaited close', async () => {
  let reads = 0, closes = 0;
  const filesystem = { stat: async () => ({ dev: 1n, ino: 2n, mtimeNs: 3n, ctimeNs: 4n, isDirectory: () => true }),
    opendir: async (_path, options) => {
      assert.deepEqual(options, { bufferSize: 128 });
      return { read: () => Promise.resolve({ name: String(reads++), isDirectory: () => false }), close: async () => { closes++; } };
    } };
  const row = await createFolderPromotionWorkload({ createService: createFolderBrowseService, path: '/fixture', overflow: true, filesystem })();
  assert.equal(row.actualNativeOverflow, true); assert.equal(reads, 50_001); assert.equal(closes, 1);
  assert.equal(row.counts.liveHandles, 0); assert.equal(row.refusal, 'folder_scan_limit');
});
