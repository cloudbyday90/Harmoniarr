/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createFixtureGate } from '../../testing/integration/fixture-lifecycle.js';
import { runFingerprintBufferProbe } from '../../testing/integration/fingerprint-buffer-process.js';

test('an actual isolated probe reports exact bytes and bounded numeric memory fields', async () => {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-fingerprint-probe-'));
  try {
    const path = join(root, 'current.flac'); const bytes = Buffer.alloc(2_000_003, 97); await writeFile(path, bytes);
    const result = await runFingerprintBufferProbe({ filePath: path, libraryRoot: root, readBufferBytes: 256 * 1024 });
    assert.deepEqual(result.evidence, { sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    assert.equal(result.hashedBytes, bytes.length * 4); assert.equal(result.passes, 4); assert.ok(result.memorySamples > 0);
    for (const group of ['baseline', 'peak', 'peakDelta']) for (const field of ['rss', 'heapUsed', 'external', 'arrayBuffers']) {
      assert.ok(Number.isSafeInteger(result[group][field]) && result[group][field] >= 0);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

for (const reason of [new Error('Original cancellation'), null]) {
  test(`probe cancellation owns runner close and retains ${reason === null ? 'null' : 'Error'}`, async () => {
    const controller = new AbortController(); const terminated = createFixtureGate(); const release = createFixtureGate(); let settled = false; let reports = 0; let report;
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    const operation = runFingerprintBufferProbe({ filePath: 'owned', libraryRoot: 'owned', readBufferBytes: 64 * 1024,
      signal: controller.signal, spawnFn: (_binary, _args, options) => {
        assert.equal(options.shell, false); assert.equal(options.windowsHide, true); assert.equal(options.env.NODE_OPTIONS, undefined); return child;
      }, terminateFn: async () => { terminated.release(); await release.promise; child.emit('close', 1, 'SIGTERM'); return { quiescent: true }; },
      onTermination: value => { reports++; report = value; } });
    const observed = operation.then(() => assert.fail('Cancelled result'), error => { settled = true; assert.equal(error, reason); });
    try { controller.abort(reason); await terminated.promise; await Promise.resolve(); assert.equal(settled, false); }
    finally { release.release(); await observed; child.stdout.destroy(); child.stderr.destroy(); }
    assert.equal(child.listenerCount('error'), 0); assert.equal(child.listenerCount('close'), 0); assert.equal(reports, 1); assert.equal(report.quiescent, true);
  });
}

test('incomplete termination retains primary null and separately refuses workspace disposal', async () => {
  const controller = new AbortController(); const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  let safeCleanup = true;
  const operation = runFingerprintBufferProbe({ filePath: 'owned', libraryRoot: 'owned', readBufferBytes: 64 * 1024,
    signal: controller.signal, spawnFn: () => child, terminateFn: async () => { throw new Error('Cleanup failure'); },
    onTermination: ({ quiescent }) => { safeCleanup = quiescent; } });
  const observed = operation.then(() => assert.fail('Incomplete result'), actual => { assert.equal(actual, null); });
  controller.abort(null); await observed; assert.equal(safeCleanup, false);
  child.emit('error', new Error('Later owned process error')); child.emit('close', 1, null);
  assert.equal(child.listenerCount('error'), 0); child.stdout.destroy(); child.stderr.destroy();
});
