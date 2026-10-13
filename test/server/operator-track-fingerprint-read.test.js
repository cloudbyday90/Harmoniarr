/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { appendFileSync, renameSync, writeFileSync, utimesSync } from 'node:fs';
import { mkdtemp, mkdir, open, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFixtureGate } from '../../testing/integration/fixture-lifecycle.js';
import { createOperatorTrackFingerprintReadService } from '../../src/server/metadata/operator-track-fingerprint-read-service.js';
import { createOperatorTrackFileEvidenceService, fingerprintOperatorTrackFile } from '../../src/server/metadata/operator-track-file-evidence-service.js';
import { OPERATOR_TRACK_READ_BUFFER_OPTIONS } from '../../src/server/metadata/operator-track-fingerprint-policy.js';

const snapshot = size => ({ size, mtimeMs: 42, ino: 7, dev: 3 });
const info = value => ({ ...value, isFile: () => true });
const digest = value => createHash('sha256').update(value).digest('hex');

test('one bounded buffer handles short reads and never hashes its unused tail', async () => {
  const bytes = Buffer.from('Only actual bytes'); const expected = snapshot(bytes.length); const buffers = new Set(); let closes = 0; let observed = 0;
  const service = createOperatorTrackFingerprintReadService({ openFn: async (_path, flags) => {
    assert.equal(flags, 'r'); return { stat: async () => info(expected), close: async () => { closes++; },
      read: async (buffer, offset, length, position) => {
        assert.equal(offset, 0); assert.equal(buffer.length, bytes.length); buffers.add(buffer); buffer.fill(255);
        const count = Math.min(3, length); bytes.copy(buffer, 0, position, position + count); return { bytesRead: count };
      } };
  } });
  assert.equal(await service.hashFile({ filePath: 'controlled', expectedStat: expected, onBytesRead: count => { observed += count; throw null; } }), digest(bytes));
  assert.equal(buffers.size, 1); assert.equal(observed, bytes.length); assert.equal(closes, 1);
});

test('invalid sizes or missing captured evidence refuse handle admission without private input', async () => {
  const service = createOperatorTrackFingerprintReadService({ openFn: () => assert.fail('No handle admitted') });
  for (const readBufferBytes of [null, 0, -1, 'private-token', Infinity, {}]) await assert.rejects(service.hashFile({ filePath: 'private', expectedStat: snapshot(1), readBufferBytes }), TypeError);
  await assert.rejects(service.hashFile({ filePath: 'private' }), TypeError);
  const outer = createOperatorTrackFileEvidenceService({ statFn: () => assert.fail('Invalid method cannot access a file') });
  await assert.rejects(outer.fingerprintOperatorTrackFile('private', { readMethod: 'private-token' }), error => error instanceof TypeError && !error.message.includes('private-token'));
});

test('descriptor mismatch, early EOF, invalid read count and growth refuse evidence and close once', async () => {
  for (const mode of ['opened_identity', 'early_eof', 'invalid_count', 'growth', 'nonregular', 'nonregular_after']) {
    let stats = 0; let reads = 0; let closes = 0; const expected = snapshot(5);
    const service = createOperatorTrackFingerprintReadService({ openFn: async () => ({
      stat: async () => { stats++; return { ...info(expected),
        ...(mode === 'opened_identity' ? { ino: 8 } : {}), ...(mode === 'growth' && stats > 1 ? { size: 6 } : {}),
        ...(mode === 'nonregular' || (mode === 'nonregular_after' && stats > 1) ? { isFile: () => false } : {}) }; },
      read: async buffer => { reads++; buffer.fill(97); return { bytesRead: mode === 'early_eof' ? 0 : mode === 'invalid_count' ? 9 : 5 }; },
      close: async () => { closes++; },
    }) });
    await assert.rejects(service.hashFile({ filePath: 'controlled', expectedStat: expected }));
    assert.equal(closes, 1); if (mode === 'opened_identity' || mode === 'nonregular') assert.equal(reads, 0);
  }
});

test('default composition chooses reusable 256 KiB while explicit stream retains 64 KiB', async () => {
  const expected = info(snapshot(1)); const calls = [];
  const service = createOperatorTrackFileEvidenceService({ statFn: async () => expected,
    readService: { hashFile: async input => { calls.push(['reusable', input.readBufferBytes]); return digest('a'); } },
    streamService: { hashFile: async input => { calls.push(['stream', input.readBufferBytes]); return digest('a'); } } });
  assert.deepEqual(await service.fingerprintOperatorTrackFile('controlled'), { sizeBytes: 1, sha256: digest('a') });
  await service.fingerprintOperatorTrackFile('controlled', { readMethod: 'stream' });
  assert.deepEqual(calls, [['reusable', 256 * 1024], ['stream', 64 * 1024]]);
});

for (const primary of [new Error('Original read failure'), null]) {
  test(`read ownership awaits held close and retains original ${primary === null ? 'null' : 'Error'}`, async () => {
    const entered = createFixtureGate(); const release = createFixtureGate(); let settled = false;
    const service = createOperatorTrackFingerprintReadService({ openFn: async () => ({ stat: async () => info(snapshot(1)),
      read: async () => { throw primary; }, close: async () => { entered.release(); await release.promise; throw new Error('Secondary close failure'); } }) });
    const operation = service.hashFile({ filePath: 'controlled', expectedStat: snapshot(1) });
    const observed = operation.then(() => assert.fail('Primary failure'), error => { settled = true; assert.equal(error, primary); });
    try { await entered.promise; await Promise.resolve(); assert.equal(settled, false); }
    finally { release.release(); await observed; }
  });
}

test('successful empty-file hashing owns close and cannot return evidence after close failure', async () => {
  const entered = createFixtureGate(); const release = createFixtureGate(); let settled = false;
  const service = createOperatorTrackFingerprintReadService({ openFn: async () => ({ stat: async () => info(snapshot(0)),
    read: () => assert.fail('Empty file has no admitted read'), close: async () => { entered.release(); await release.promise; } }) });
  const operation = service.hashFile({ filePath: 'controlled', expectedStat: snapshot(0) }).then(result => { settled = true; return result; });
  try { await entered.promise; await Promise.resolve(); assert.equal(settled, false); } finally { release.release(); }
  assert.equal(await operation, digest(''));
  const error = new Error('Close failed'); const failing = createOperatorTrackFingerprintReadService({ openFn: async () => ({
    stat: async () => info(snapshot(0)), close: async () => { throw error; },
  }) });
  await assert.rejects(failing.hashFile({ filePath: 'controlled', expectedStat: snapshot(0) }), actual => actual === error);
});

test('actual reusable reads preserve evidence for every size and reject changed/private/missing files', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'harmoniarr-fingerprint-reuse-'));
  try {
    const root = join(workspace, 'private'); await mkdir(root); const path = join(root, 'current.flac'); const outside = join(workspace, 'outside');
    const bytes = Buffer.alloc(2_000_003, 97); await writeFile(outside, 'outside');
    for (const readBufferBytes of OPERATOR_TRACK_READ_BUFFER_OPTIONS) {
      await writeFile(path, bytes); let observed = 0;
      const result = await fingerprintOperatorTrackFile(path, { libraryRoot: root, readMethod: 'reusable', readBufferBytes,
        onBytesRead: async count => { observed += count; throw null; } });
      assert.deepEqual(result, { sizeBytes: bytes.length, sha256: digest(bytes) }); assert.equal(observed, bytes.length);
      let changed = false;
      await assert.rejects(fingerprintOperatorTrackFile(path, { libraryRoot: root, readMethod: 'reusable', readBufferBytes, onBytesRead: () => {
        if (!changed) { changed = true; appendFileSync(path, 'changed'); }
      } }), /Track changed/u);
      await assert.rejects(fingerprintOperatorTrackFile(outside, { libraryRoot: root, readMethod: 'reusable', readBufferBytes }), { code: 'operator_track_scope_verification_required' });
      await assert.rejects(fingerprintOperatorTrackFile(join(root, 'missing'), { libraryRoot: root, readMethod: 'reusable', readBufferBytes }), { code: 'ENOENT' });
    }
  } finally { await rm(workspace, { recursive: true, force: true }); }
});

test('same-size/same-time path substitution before open refuses descriptor bytes before any read', async () => {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-fingerprint-binding-'));
  try {
    const path = join(root, 'current'); const old = join(root, 'original'); const bytes = Buffer.from('current bytes'); await writeFile(path, bytes);
    utimesSync(path, 1_700_000_000, 1_700_000_000);
    const original = await stat(path); let observed = 0; let openedHandle;
    const readService = createOperatorTrackFingerprintReadService({ openFn: async (file, flags) => {
      renameSync(path, old); writeFileSync(path, bytes); utimesSync(path, original.atime, original.mtime);
      const replaced = await stat(path); assert.equal(replaced.size, original.size); assert.equal(replaced.mtimeMs, original.mtimeMs);
      assert.notEqual(replaced.ino, original.ino);
      openedHandle = await open(file, flags); return openedHandle;
    } });
    const service = createOperatorTrackFileEvidenceService({ readService });
    await assert.rejects(service.fingerprintOperatorTrackFile(path, { libraryRoot: root, readMethod: 'reusable', onBytesRead: count => { observed += count; } }), /Track changed/u);
    assert.equal(observed, 0); assert.equal(openedHandle.fd, -1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
