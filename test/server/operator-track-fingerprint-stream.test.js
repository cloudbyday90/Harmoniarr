/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createReadStream, appendFileSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { createFixtureGate } from '../../testing/integration/fixture-lifecycle.js';
import { fingerprintOperatorTrackFile } from '../../src/server/metadata/operator-track-file-evidence-service.js';
import { createOperatorTrackFingerprintStreamService } from '../../src/server/metadata/operator-track-fingerprint-stream-service.js';
import { OPERATOR_TRACK_READ_BUFFER_OPTIONS } from '../../src/server/metadata/operator-track-fingerprint-policy.js';

test('bounded stream options reject malformed sizes before admission without echoing input', async () => {
  const service = createOperatorTrackFingerprintStreamService({ createReadStreamFn: () => assert.fail('Invalid configuration cannot open a stream') });
  for (const readBufferBytes of [null, 0, -1, 1.5, NaN, Infinity, 2 ** 30, 'private-token', {}]) {
    await assert.rejects(service.hashFile({ filePath: '/private', readBufferBytes }), error => error instanceof TypeError && !error.message.includes('private'));
  }
});

test('all bounded buffers hash exact current bytes, ignore diagnostic failure and close the actual file stream', async () => {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-fingerprint-stream-'));
  try {
    const path = join(root, 'current.flac'); const bytes = Buffer.alloc(2_000_003, 97); await writeFile(path, bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    for (const readBufferBytes of OPERATOR_TRACK_READ_BUFFER_OPTIONS) {
      let stream; let observed = 0;
      const service = createOperatorTrackFingerprintStreamService({ createReadStreamFn: (file, options) => {
        assert.equal(options.highWaterMark, readBufferBytes); assert.equal(options.autoClose, true); assert.equal(options.emitClose, true);
        stream = createReadStream(file, options); return stream;
      } });
      assert.equal(await service.hashFile({ filePath: path, readBufferBytes, onBytesRead: amount => { observed += amount; throw null; } }), sha256);
      assert.equal(observed, bytes.length); assert.equal(stream.closed, true);
      assert.deepEqual(await fingerprintOperatorTrackFile(path, { libraryRoot: root, readBufferBytes, onBytesRead: async () => { throw new Error('Optional sink'); } }),
        { sizeBytes: bytes.length, sha256 });
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('every bounded buffer refuses changed bytes, out-of-root evidence and missing files', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'harmoniarr-fingerprint-change-'));
  try {
    const root = join(workspace, 'private'); await mkdir(root); const path = join(root, 'current.flac');
    const outside = join(workspace, 'outside.flac'); await writeFile(outside, 'Outside owner root');
    for (const readBufferBytes of OPERATOR_TRACK_READ_BUFFER_OPTIONS) {
      await writeFile(path, Buffer.alloc(2_000_003, 97)); let changed = false;
      await assert.rejects(fingerprintOperatorTrackFile(path, { libraryRoot: root, readBufferBytes, onBytesRead: () => {
        if (!changed) { changed = true; appendFileSync(path, 'Changed while hashing'); }
      } }), /Track changed while collecting evidence/u);
      let read = false;
      await assert.rejects(fingerprintOperatorTrackFile(outside, { libraryRoot: root, readBufferBytes, onBytesRead: () => { read = true; } }),
        { code: 'operator_track_scope_verification_required' });
      assert.equal(read, false);
      await assert.rejects(fingerprintOperatorTrackFile(join(root, 'missing'), { libraryRoot: root, readBufferBytes }), { code: 'ENOENT' });
    }
  } finally { await rm(workspace, { recursive: true, force: true }); }
});

for (const primary of [new Error('Original iterator failure'), null]) {
  test(`stream cleanup owns delayed close and retains original ${primary === null ? 'null' : 'Error'}`, async () => {
    const entered = createFixtureGate(); const release = createFixtureGate(); let stream; let settled = false;
    const service = createOperatorTrackFingerprintStreamService({ createReadStreamFn: () => {
      stream = new Readable({ read() {}, destroy(_error, callback) { entered.release(); release.promise.then(() => callback(new Error('Secondary close failure'))); } });
      stream[Symbol.asyncIterator] = async function* () { yield Buffer.from('partial'); throw primary; }; return stream;
    } });
    const operation = service.hashFile({ filePath: 'controlled' });
    const observed = operation.then(() => assert.fail('Primary failure must escape'), actual => { settled = true; assert.equal(actual, primary); });
    try { await entered.promise; await Promise.resolve(); assert.equal(settled, false); }
    finally { release.release(); await observed; }
    assert.equal(stream.closed, true); assert.equal(stream.listenerCount('close'), 0);
    assert.equal(stream.listenerCount('error'), 0);
  });
}

test('successful stream hashing also waits for its actual close', async () => {
  const entered = createFixtureGate(); const release = createFixtureGate(); let settled = false;
  const service = createOperatorTrackFingerprintStreamService({ createReadStreamFn: () => new Readable({
    read() { this.push(Buffer.from('current bytes')); this.push(null); },
    destroy(error, callback) { entered.release(); release.promise.then(() => callback(error)); },
  }) });
  const operation = service.hashFile({ filePath: 'controlled' }).then(result => { settled = true; return result; });
  try { await entered.promise; await Promise.resolve(); assert.equal(settled, false); }
  finally { release.release(); }
  assert.equal(await operation, createHash('sha256').update('current bytes').digest('hex'));
});
