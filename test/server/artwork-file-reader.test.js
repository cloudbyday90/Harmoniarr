import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readArtworkFile } from '../../src/server/artwork/artwork-file-reader.js';

test('native artwork reader admits an exact file and refuses an oversized file and directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-artwork-reader-'));
  const path = join(root, 'file');
  try {
    await writeFile(path, Buffer.from('four'));
    assert.deepEqual(await readArtworkFile(path, { maxBytes: 4 }), await readFile(path));
    await assert.rejects(readArtworkFile(path, { maxBytes: 3 }), { code: 'artwork_file_too_large', status: 400 });
    await assert.rejects(readArtworkFile(root, { maxBytes: 4 }), { code: 'artwork_file_unavailable' });
    await assert.rejects(readArtworkFile(join(root, 'PRIVATE-missing'), { maxBytes: 4 }), error => {
      assert.equal(error.message.includes('PRIVATE'), false); assert.equal(Object.hasOwn(error, 'cause'), false); return true;
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('growing artwork is refused at the first excess byte and its original handle is closed', async () => {
  let reads = 0; let bytes = 0; let closed = 0;
  await assert.rejects(readArtworkFile('PRIVATE-path', { maxBytes: 4, openFn: async () => ({
    stat: async () => ({ size: 1, isFile: () => true }),
    read: async (buffer, offset, length) => { reads++; bytes += length; buffer.fill(1, offset, offset + length); return { bytesRead: length }; },
    close: async () => { closed++; },
  }) }), { code: 'artwork_file_too_large' });
  assert.equal(reads, 1); assert.equal(bytes, 5); assert.equal(closed, 1);
});

test('declared oversize and non-regular handles refuse before read while close errors preserve the first refusal', async () => {
  for (const info of [{ size: 5, isFile: () => true }, { size: 0, isFile: () => false }]) {
    let closed = false;
    await assert.rejects(readArtworkFile('path', { maxBytes: 4, openFn: async () => ({
      stat: async () => info, read: () => assert.fail('must not read'),
      close: async () => { closed = true; throw new Error('PRIVATE-close'); },
    }) }), error => {
      assert.equal(error.code, info.size > 4 ? 'artwork_file_too_large' : 'artwork_file_unavailable');
      assert.equal(error.message.includes('PRIVATE'), false); return true;
    });
    assert.equal(closed, true);
  }
});

test('short reads are copied without retaining unused scratch bytes and close is awaited', async () => {
  let count = 0; const entered = Promise.withResolvers(); const held = Promise.withResolvers(); let settled = false;
  const pending = readArtworkFile('path', { maxBytes: 4, openFn: async () => ({
    stat: async () => ({ size: 2, isFile: () => true }),
    read: async buffer => { count++; buffer[0] = count; return { bytesRead: count <= 2 ? 1 : 0 }; },
    close: async () => { entered.resolve(); await held.promise; },
  }) }).then(result => { settled = true; return result; });
  try { await Promise.race([entered.promise, pending.then(() => assert.fail())]); assert.equal(settled, false); }
  finally { held.resolve(); }
  assert.deepEqual(await pending, Buffer.from([1, 2]));
});

test('native read/stat/close failures and invalid policy have approved diagnostics', async () => {
  for (const phase of ['stat', 'read', 'close']) {
    let closed = false;
    await assert.rejects(readArtworkFile('PRIVATE-path', { maxBytes: 4, openFn: async () => ({
      stat: async () => { if (phase === 'stat') throw null; return { size: 0, isFile: () => true }; },
      read: async () => { if (phase === 'read') throw new Error('PRIVATE'); return { bytesRead: 0 }; },
      close: async () => { closed = true; if (phase === 'close') throw new Error('PRIVATE'); },
    }) }), { code: 'artwork_file_unavailable' });
    assert.equal(closed, true);
  }
  await assert.rejects(readArtworkFile('path', { maxBytes: 101 * 1024 * 1024, openFn: () => assert.fail() }), { code: 'artwork_policy_invalid' });
});
