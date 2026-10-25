import assert from 'node:assert/strict';
import test from 'node:test';
import { ARTWORK_WORKER_DATA_LIMIT, artworkWorkerLaunch, assertArtworkWorkerMemoryLimit, assertArtworkMemoryAdmission, artworkWorkerMemoryEstimate } from '../../src/server/artwork/artwork-worker-memory.js';
import { createArtworkWorkerCollector, isArtworkWorkerError } from '../../src/server/artwork/artwork-worker-protocol.js';
import { transformArtworkBuffer } from '../../src/server/artwork/artwork-image-transform.js';
import { sanitizeArtworkBuffer } from '../../src/server/artwork/artwork-image-processing.js';

test('Linux child allocation limits are lowered before Node exec without a shell or inherited flags', () => {
  assert.deepEqual(artworkWorkerLaunch('/worker.js', ['20', '8'], { platform: 'linux', execPath: '/node' }), {
    command: '/usr/bin/prlimit', args: ['--data=1073741824:1073741824', '--core=0:0', '--', '/node', '--jitless', '--max-old-space-size=128', '/worker.js', '20', '8'],
  });
  assert.deepEqual(artworkWorkerLaunch('worker.js', ['20', '8'], { platform: 'win32', execPath: 'node.exe' }), {
    command: 'node.exe', args: ['--jitless', '--max-old-space-size=128', 'worker.js', '20', '8'],
  });
});

test('Linux worker startup refuses absent, unreadable, unbounded or excessive DATA limits', async () => {
  for (const limits of ['', 'Max data size unlimited unlimited bytes', 'Max data size 0 0 bytes',
    `Max data size ${ARTWORK_WORKER_DATA_LIMIT} unlimited bytes`, `Max data size ${ARTWORK_WORKER_DATA_LIMIT + 1} ${ARTWORK_WORKER_DATA_LIMIT + 1} bytes`]) {
    await assert.rejects(assertArtworkWorkerMemoryLimit({ platform: 'linux', readFileFn: async () => limits }), { code: 'artwork_worker_memory', status: 503 });
  }
  await assert.rejects(assertArtworkWorkerMemoryLimit({ platform: 'linux', readFileFn: async () => { throw new Error('private'); } }),
    error => isArtworkWorkerError(error) && error.code === 'artwork_worker_memory' && !error.cause && !error.message.includes('private'));
  await assertArtworkWorkerMemoryLimit({ platform: 'linux', readFileFn: async path => {
    assert.equal(path, '/proc/self/limits'); return `Max data size             ${ARTWORK_WORKER_DATA_LIMIT} ${ARTWORK_WORKER_DATA_LIMIT} bytes\n`;
  } });
  await assertArtworkWorkerMemoryLimit({ platform: 'win32', readFileFn: async () => assert.fail('Linux-only kernel contract') });
});

test('memory admission refuses expensive images before native rewrite and stats; small and maximum RGB images still run', async () => {
  let rewrites = 0; let stats = 0;
  const input = { buffer: Buffer.from('image'), maxBytes: 100 * 1024 * 1024, maxDimensionPixels: 8192 };
  for (const metadata of [{ format: 'png', width: 8192, height: 8192, channels: 4, depth: 'ushort' },
    { format: 'png', width: 8192, height: 8192, channels: 4, depth: 'unknown' }]) {
    await assert.rejects(transformArtworkBuffer(input, { inspectArtworkBufferFn: async () => metadata,
      sanitizeArtworkBufferFn: async () => { rewrites++; }, sharpStatsFn: async () => { stats++; } }),
    { code: 'artwork_worker_memory', status: 503 });
  }
  assert.equal(rewrites, 0); assert.equal(stats, 0);
  for (const dimensions of [16, 8192]) {
    const result = await transformArtworkBuffer(input, {
      inspectArtworkBufferFn: async () => ({ format: 'jpeg', width: dimensions, height: dimensions, channels: 3, depth: 'uchar' }),
      sanitizeArtworkBufferFn: async () => ({ data: Buffer.from('rewritten'), info: { width: dimensions, height: dimensions } }),
      sharpStatsFn: async () => ({ dominant: null }),
    });
    assert.equal(result.width, dimensions);
  }
});

test('memory admission accounts for input retention together with decoded pixels', async () => {
  await assert.rejects(transformArtworkBuffer({ buffer: Buffer.alloc(100 * 1024 * 1024), maxBytes: 100 * 1024 * 1024, maxDimensionPixels: 8192 }, {
    inspectArtworkBufferFn: async () => ({ format: 'jpeg', width: 8192, height: 8192, channels: 3, depth: 'uchar' }),
    sanitizeArtworkBufferFn: async () => assert.fail('refuse combined budget before rewrite'),
  }), { code: 'artwork_worker_memory', status: 503 });
});

test('combined maximum RGB admission includes runtime and rewrite output with an exact byte boundary', () => {
  const metadata = { width: 8192, height: 8192, channels: 3, depth: 'uchar' };
  const inputBytes = 14 * 1024 ** 2;
  assert.equal(artworkWorkerMemoryEstimate(metadata, inputBytes), ARTWORK_WORKER_DATA_LIMIT);
  assert.doesNotThrow(() => assertArtworkMemoryAdmission({ metadata, inputBytes }));
  for (const bytes of [inputBytes + 1, 55_298_216, 54_289_930]) {
    assert.throws(() => assertArtworkMemoryAdmission({ metadata, inputBytes: bytes }),
      error => isArtworkWorkerError(error) && error.code === 'artwork_worker_memory' && error.status === 503);
  }
});

test('combined memory refusal precedes the parent grant, rewrite and statistics', async () => {
  const seen = [];
  await assert.rejects(transformArtworkBuffer({ buffer: Buffer.alloc(14 * 1024 ** 2 + 1), maxBytes: 100 * 1024 ** 2,
    maxDimensionPixels: 8192, onMetadata: () => seen.push('grant') }, {
    inspectArtworkBufferFn: async () => { seen.push('inspect'); return { format: 'jpeg', width: 8192, height: 8192, channels: 3, depth: 'uchar' }; },
    sanitizeArtworkBufferFn: async () => { seen.push('rewrite'); }, sharpStatsFn: async () => { seen.push('stats'); },
  }), error => isArtworkWorkerError(error) && error.code === 'artwork_worker_memory');
  assert.deepEqual(seen, ['inspect']);
});

test('memory failure framing permits only the fixed capacity result with failed exit and no body', () => {
  const collector = createArtworkWorkerCollector(8); collector.push(Buffer.from('{"failure":"memory"}\n'));
  assert.throws(() => collector.result(1), error => isArtworkWorkerError(error) && error.code === 'artwork_worker_memory' && error.status === 503);
  assert.throws(() => collector.result(0), { code: 'artwork_worker_failed' });
  for (const frame of ['{"failure":"private"}\n', '{"failure":"memory","message":"private"}\n', '{"failure":"memory"}\nx']) {
    assert.throws(() => createArtworkWorkerCollector(8).push(Buffer.from(frame)), isArtworkWorkerError);
  }
});

test('opaque native rewrite failures remain temporary and never expose native diagnostics', async () => {
  await assert.rejects(sanitizeArtworkBuffer({ buffer: Buffer.from('private native input'), format: 'png', maxDimensionPixels: 8 }),
    error => isArtworkWorkerError(error) && error.status === 503 && error.code === 'artwork_worker_failed'
      && !error.cause && !error.message.includes('private'));
});
