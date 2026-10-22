import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { appendFile, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { readArtworkFile } from '../../src/server/artwork/artwork-file-reader.js';

test('Linux artwork reader rejects a real FIFO without waiting for a writer', { timeout: 5000 }, async () => {
  assert.equal(process.platform, 'linux');
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-artwork-fifo-'));
  try {
    const path = join(root, 'fifo'); await promisify(execFile)('mkfifo', [path]);
    await assert.rejects(readArtworkFile(path, { maxBytes: 4 }), { code: 'artwork_file_unavailable' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('native artwork handle rejects growth after stat at the first excess byte and closes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-artwork-growth-'));
  let closed = false; let readBytes = 0;
  try {
    const path = join(root, 'image'); await writeFile(path, 'four');
    await assert.rejects(readArtworkFile(path, { maxBytes: 4, openFn: async (value, flags) => {
      const handle = await open(value, flags);
      return { stat: async () => { const before = await handle.stat(); await appendFile(path, '!'); return before; },
        read: async (...args) => { const result = await handle.read(...args); readBytes += result.bytesRead; return result; },
        close: async () => { await handle.close(); closed = true; } };
    } }), { code: 'artwork_file_too_large' });
    assert.equal(closed, true); assert.equal(readBytes, 5); assert.equal((await readFile(path)).length, 5);
  } finally { await rm(root, { recursive: true, force: true }); }
});
