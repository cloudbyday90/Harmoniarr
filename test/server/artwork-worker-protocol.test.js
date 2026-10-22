import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkWorkerCollector, isArtworkWorkerError, artworkWorkerError } from '../../src/server/artwork/artwork-worker-protocol.js';
import { transformArtworkBuffer } from '../../src/server/artwork/artwork-image-transform.js';

const header = { size: 3, width: 8, height: 8, format: 'png', dominant: { r: 255, g: 10, b: 0 } };
const frame = (value = header, data = 'abc') => Buffer.from(`${JSON.stringify(value)}\n${data}`);

test('worker framing accepts split headers and projects only approved output fields', () => {
  const collector = createArtworkWorkerCollector(8);
  const bytes = frame({ ...header, sourceUrl: 'private', dominant: { ...header.dominant, extra: 'private' } });
  for (const byte of bytes) collector.push(Buffer.from([byte]));
  assert.deepEqual(collector.result(0), { data: Buffer.from('abc'), format: 'png', width: 8, height: 8, dominant: header.dominant });
});

test('worker framing refuses malformed, oversized or policy-escaping headers before body allocation', () => {
  for (const bytes of [Buffer.alloc(1025, 97), Buffer.from('!\n'), Buffer.from('null\n'), Buffer.from('[]\n'),
    ...[{ size: 100 * 1024 * 1024 + 1 }, { size: 0 }, { size: 1.5 }, { width: 9 }, { height: -1 },
      { format: 'svg' }, { dominant: { r: 256, g: 0, b: 0 } }, { dominant: {} }].map(value => frame({ ...header, ...value })),
    frame({ error: 'private_native_error' }, ''), frame({ error: 'artwork_image_invalid', message: 'secret' }, '')]) {
    assert.throws(() => createArtworkWorkerCollector(8).push(bytes), isArtworkWorkerError);
  }
});

test('worker framing requires exact body and successful exit, and preserves only approved refusals', () => {
  for (const code of [1, null, 2]) {
    const collector = createArtworkWorkerCollector(8); collector.push(frame());
    assert.throws(() => collector.result(code), isArtworkWorkerError);
  }
  const truncated = createArtworkWorkerCollector(8); truncated.push(frame(header, 'ab'));
  assert.throws(() => truncated.result(0), isArtworkWorkerError);
  assert.throws(() => createArtworkWorkerCollector(8).push(frame(header, 'abcd')), isArtworkWorkerError);
  assert.throws(() => createArtworkWorkerCollector(8).result(0), isArtworkWorkerError);
  const refusal = createArtworkWorkerCollector(8); refusal.push(frame({ error: 'artwork_image_invalid' }, ''));
  assert.throws(() => refusal.result(1), { code: 'artwork_image_invalid', status: 400 });
  assert.throws(() => refusal.result(0), isArtworkWorkerError);
  const owned = artworkWorkerError();
  assert.equal(isArtworkWorkerError(owned), true);
  assert.equal(isArtworkWorkerError(Object.assign(new Error(owned.message), { code: owned.code })), false);
  assert.equal(isArtworkWorkerError(null), false);
});

test('native transformation refuses excessive rewritten output before statistics', async () => {
  let stats = 0;
  await assert.rejects(transformArtworkBuffer({ buffer: Buffer.from('input'), maxBytes: 20, maxDimensionPixels: 8 }, {
    inspectArtworkBufferFn: async () => ({ format: 'png', width: 8, height: 8 }),
    sanitizeArtworkBufferFn: async () => ({ data: { length: 100 * 1024 * 1024 + 1 }, info: { width: 8, height: 8 } }),
    sharpStatsFn: async () => { stats++; },
  }), { code: 'artwork_output_too_large', status: 400 });
  assert.equal(stats, 0);
});
