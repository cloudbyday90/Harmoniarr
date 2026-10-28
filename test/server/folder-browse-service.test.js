/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath, parse } from 'node:path';
import { createFolderBrowseService } from '../../src/server/filesystem/folder-browse-service.js';
import { createFolderCursorPolicy } from '../../src/server/filesystem/folder-cursor-policy.js';
import { FOLDER_SCAN_LIMIT, isFolderPage } from '../../src/shared/folder-browse-policy.js';

const actorUserId = 'fixture-admin';
const facts = () => ({ dev: 1n, ino: 2n, mtimeNs: 3n, ctimeNs: 4n, isDirectory: () => true });
const dirent = (name, folder = true) => ({ name, isDirectory: () => folder });
function controlled({ count = 250, read, close = async () => {}, readStat = async () => facts(), now } = {}) {
  let opens = 0, closes = 0, reads = 0;
  const service = createFolderBrowseService({ now, readStat, openDirectory: async (_path, options) => {
    assert.deepEqual(options, { bufferSize: 32 }); opens++; let index = 0;
    return { read: async () => { reads++; if (read) return read(); return index < count ? dirent(String(count - index++).padStart(6, '0')) : null; },
      close: async () => { closes++; await close(); } };
  } });
  return { service, counts: () => ({ opens, closes, reads }) };
}
const browse = (service, options = {}) => service.browse({ actorUserId, path: '/fixture', ...options });

test('real filesystem pages exhaust every directory once in lexical order and navigate back', async () => {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-folder-page-'));
  assert.equal(resolvePath(root).startsWith(resolvePath(tmpdir()) + (process.platform === 'win32' ? '\\' : '/')), true);
  try {
    const names = Array.from({ length: 207 }, (_, index) => `album-${String(index).padStart(3, '0')}`);
    for (const name of names) await mkdir(join(root, name));
    await writeFile(join(root, 'ordinary-file'), 'not a directory');
    const service = createFolderBrowseService(); let cursor, all = [], second;
    do {
      const result = await browse(service, { path: root, cursor });
      assert.equal(isFolderPage(result.page, result.entries), true);
      assert.ok(result.entries.length <= 100); all.push(...result.entries.map(entry => entry.name));
      if (result.page.from === 101) second = result;
      cursor = result.page.nextCursor;
    } while (cursor);
    assert.deepEqual(all, names);
    const previous = await browse(service, { path: root, cursor: second.page.previousCursor });
    assert.deepEqual(previous.entries.map(entry => entry.name), names.slice(0, 100));
    await mkdir(join(root, 'new-folder'));
    await assert.rejects(browse(service, { path: root, cursor: second.page.nextCursor }), error => error.code === 'folder_page_changed');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('exact scan ceiling succeeds; overflow refuses without partial page and closes', async () => {
  for (const count of [FOLDER_SCAN_LIMIT, FOLDER_SCAN_LIMIT + 1]) {
    const { service, counts } = controlled({ count });
    if (count === FOLDER_SCAN_LIMIT) { const result = await browse(service); assert.equal(result.entries.length, 100); assert.equal(result.page.total, count); }
    else await assert.rejects(browse(service), error => error.code === 'folder_scan_limit' && error.status === 422);
    assert.deepEqual(counts(), { opens: 1, closes: 1, reads: FOLDER_SCAN_LIMIT + 1 });
  }
});

test('four scan slots remain held through delayed close; fifth never opens or queues', async () => {
  let release; const closing = new Promise(resolve => { release = resolve; });
  const { service, counts } = controlled({ count: 0, close: () => closing });
  const active = Array.from({ length: 4 }, () => browse(service));
  while (counts().closes < 4) await new Promise(resolve => { setImmediate(resolve); });
  await assert.rejects(browse(service), error => error.code === 'folder_browse_busy'); assert.equal(counts().opens, 4);
  release(); await Promise.all(active); await browse(service); assert.equal(counts().closes, 5);
});

test('abort during a held native read waits for its settlement and close before capacity retires', async () => {
  let release; const reading = new Promise(resolve => { release = resolve; });
  const controller = new AbortController(); const { service, counts } = controlled({ read: () => reading });
  const operation = browse(service, { signal: controller.signal });
  while (!counts().reads) await new Promise(resolve => { setImmediate(resolve); });
  controller.abort(); assert.equal(counts().closes, 0); release(null);
  await assert.rejects(operation, error => error.name === 'AbortError'); assert.equal(counts().closes, 1);
});

test('metadata change during traversal refuses and closes', async () => {
  let calls = 0;
  const { service, counts } = controlled({ readStat: async () => ({ ...facts(), ino: ++calls === 1 ? 2n : 9n }) });
  await assert.rejects(browse(service), error => error.code === 'folder_page_changed'); assert.equal(counts().closes, 1);
});

test('abort while native close is held refuses publication after close settles', async () => {
  let release; const closing = new Promise(resolve => { release = resolve; });
  const controller = new AbortController(), { service, counts } = controlled({ count: 0, close: () => closing });
  const operation = browse(service, { signal: controller.signal });
  while (!counts().closes) await new Promise(resolve => { setImmediate(resolve); });
  controller.abort(); release(); await assert.rejects(operation, error => error.name === 'AbortError');
  assert.equal(counts().closes, 1);
});

test('non-directory entries count toward the raw scan ceiling', async () => {
  const { service, counts } = controlled({ read: async () => dirent('file', false) });
  await assert.rejects(browse(service), error => error.code === 'folder_scan_limit');
  assert.equal(counts().reads, FOLDER_SCAN_LIMIT + 1); assert.equal(counts().closes, 1);
});

test('cooperative deadline after native read refuses and closes', async () => {
  let clock = 0;
  const { service, counts } = controlled({ now: () => clock, read: async () => { clock = 5001; return null; } });
  await assert.rejects(browse(service), error => error.code === 'folder_browse_timeout'); assert.equal(counts().closes, 1);
});

test('close failure prevents success; primary read failure wins over close failure', async () => {
  const close = async () => { throw new Error('private close details'); };
  const first = controlled({ count: 0, close });
  for (let index = 0; index < 5; index++) await assert.rejects(browse(first.service), error => error.code === 'folder_read_failed' && !error.message.includes('private'));
  const second = controlled({ close, read: async () => { throw Object.assign(new Error('private read'), { code: 'EACCES' }); } });
  await assert.rejects(browse(second.service), error => error.code === 'folder_access_denied'); assert.equal(second.counts().closes, 1);
  const nullFailure = controlled({ read: async () => { throw null; }, close: async () => { throw Object.assign(new Error('close'), { code: 'EACCES' }); } });
  await assert.rejects(browse(nullFailure.service), error => error.code === 'folder_read_failed');
});

test('cursor tampering, actor/path mismatch, process restart and expiry refuse', async () => {
  let clock = 0;
  const policy = createFolderCursorPolicy({ now: () => clock });
  const service = createFolderBrowseService({ cursorPolicy: policy, readStat: async () => facts(), openDirectory: async () => {
    let index = 0; return { read: async () => index < 101 ? dirent(String(index++).padStart(3, '0')) : null, close: async () => {} };
  } });
  const first = await browse(service), cursor = first.page.nextCursor;
  for (const options of [{ actorUserId: 'another' }, { path: '/different' }, { cursor: cursor.slice(0, -2) + 'xx' }]) {
    await assert.rejects(browse(service, { cursor, ...options }), error => error.code === 'folder_page_changed');
  }
  assert.throws(() => createFolderCursorPolicy().decode(cursor), error => error.code === 'folder_page_changed');
  clock = 600_000; await assert.rejects(browse(service, { cursor }), error => error.code === 'folder_page_changed');
});

test('invalid query sizes/types are refused before opening; filesystem root has no parent', async () => {
  const { service, counts } = controlled({ count: 0 });
  for (const options of [{ path: ['x'] }, { path: 'x'.repeat(8193) }, { path: '\0' }, { cursor: 'x'.repeat(8193) }]) await assert.rejects(browse(service, options));
  assert.equal(counts().opens, 0);
  assert.equal((await browse(service, { path: parse(resolvePath('/')).root })).parent, null);
});
