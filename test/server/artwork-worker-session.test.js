import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { createArtworkWorkerSession } from '../../src/server/artwork/artwork-worker-session.js';
import { createArtworkSessionCollector } from '../../src/server/artwork/artwork-worker-session-protocol.js';
import { isArtworkWorkerError } from '../../src/server/artwork/artwork-worker-protocol.js';

const metadata = { stage: 'metadata', format: 'png', width: 8, height: 8, channels: 3, depth: 'uchar' };
const frame = value => Buffer.from(`${JSON.stringify(value)}\n`);
const output = Buffer.from('{"format":"png","width":8,"height":8,"size":3,"dominant":null}\nabc');

test('child reads the declared binary input and waits for exact grant plus EOF before rewrite', async () => {
  const input = new PassThrough(); const stdout = new PassThrough(); const chunks = []; stdout.on('data', chunk => chunks.push(chunk));
  const session = createArtworkWorkerSession({ input, output: stdout, inputBytes: 5, maxBytes: 5 });
  input.write('in'); input.write('put'); assert.equal((await session.readInput()).toString(), 'input');
  let granted = false; const pending = session.requestGrant(metadata).then(() => { granted = true; });
  assert.deepEqual(Buffer.concat(chunks), frame(metadata)); input.write('grant\n');
  await new Promise(resolve => { setImmediate(resolve); }); assert.equal(granted, false);
  input.end(); await pending; assert.equal(granted, true);
  await assert.rejects(session.requestGrant(metadata), isArtworkWorkerError); stdout.destroy();
});

test('child refuses early input EOF, pre-sent control bytes, non-ASCII and malformed grants', async () => {
  for (const bytes of [Buffer.from('grant'), Buffer.from('grant\nx'), Buffer.from([0xe7, 114, 97, 110, 116, 10])]) {
    const input = new PassThrough(); const stdout = new PassThrough(); const session = createArtworkWorkerSession({ input, output: stdout, inputBytes: 1, maxBytes: 1 });
    input.write('x'); await session.readInput(); const check = assert.rejects(session.requestGrant(metadata), isArtworkWorkerError);
    input.end(bytes); await check; input.destroy(); stdout.destroy();
  }
  for (const bytes of ['x', 'inputgrant\n']) {
    const input = new PassThrough(); const stdout = new PassThrough(); const session = createArtworkWorkerSession({ input, output: stdout, inputBytes: 5, maxBytes: 5 });
    input.end(bytes); await assert.rejects(session.readInput(), isArtworkWorkerError); input.destroy(); stdout.destroy();
  }
});

test('parent validates bounded metadata before granting and still requires exact successful result', () => {
  let grants = 0; const collector = createArtworkSessionCollector(8, value => { grants++; assert.deepEqual(value, metadata); });
  for (const byte of frame(metadata)) collector.push(Buffer.from([byte])); assert.equal(grants, 1);
  collector.push(output); assert.equal(collector.result(0).data.toString(), 'abc');
  for (const header of [{ ...metadata, width: 9 }, { ...metadata, channels: 5 }, { ...metadata, depth: 'private' },
    { ...metadata, extra: 'private' }, { ...metadata, stage: 'result' }]) {
    assert.throws(() => createArtworkSessionCollector(8, () => assert.fail('no grant')).push(frame(header)), isArtworkWorkerError);
  }
  for (const bytes of [output, Buffer.concat([frame(metadata), output]), Buffer.alloc(1025)]) {
    assert.throws(() => createArtworkSessionCollector(8, () => assert.fail('no grant')).push(bytes), isArtworkWorkerError);
  }
  const changed = createArtworkSessionCollector(8, () => {}); changed.push(frame(metadata)); changed.push(Buffer.from('{"format":"png","width":7,"height":8,"size":3,"dominant":null}\nabc'));
  assert.throws(() => changed.result(0), isArtworkWorkerError);
});

test('approved refusals before metadata preserve content versus capacity ownership', () => {
  for (const [header, code, status] of [[{ error: 'artwork_image_invalid' }, 'artwork_image_invalid', 400], [{ failure: 'memory' }, 'artwork_worker_memory', 503]]) {
    const collector = createArtworkSessionCollector(8, () => assert.fail('no grant')); collector.push(frame(header));
    assert.throws(() => collector.result(1), { code, status });
  }
});
