/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { initialArtworkMemoryReservation } from '../../src/server/artwork/artwork-memory-reservation.js';
import { createDeploymentWebpSelectionObserver } from '../../testing/server/deployment-webp-selection-observer.js';
import { createDeploymentWebpSelectionFixture } from '../../testing/server/deployment-webp-selection-fixture.js';
import { runDeploymentMemoryWorkload } from '../../testing/server/deployment-memory-workload.js';

function fixture({ scenario = 'publish', state = { scan: true, encoder: true } } = {}) {
  const expected = initialArtworkMemoryReservation(800); let reserved = expected; let released = 0; const children = []; const calls = [];
  const gate = { getMemoryState: () => ({ reservedBytes: reserved }), getState: () => ({ queued: 1 }) };
  const observation = createDeploymentWebpSelectionObserver({ inputBytes: 800, scenario,
    mediaObserver: { getActiveState: () => state, releaseScan: () => { released++; } },
    createWorkerFn: ({ spawnFn }) => ({ processArtworkBuffer: options => {
      if (options.signal.aborted) return { aborted: true };
      options.onMetadata({ webpSelection: true });
      const child = spawnFn('node', ['--jitless', '/app/src/server/artwork/artwork-image-worker.js', '100', '8192', '800'], { shell: false, stdio: ['pipe', 'pipe', 'ignore'] });
      children.push({ child, signal: options.signal }); return child;
    } }),
  });
  const worker = observation.createWorker({ gate, spawnFn: (...args) => { calls.push(args); const child = new EventEmitter(); child.stderr = new EventEmitter(); return child; } });
  return { observation, worker, children, calls, expected, gate, getReleased: () => released, setReserved: value => { reserved = value; } };
}
function mark(child) { child.stderr.emit('data', Buffer.from('HX_WEBP_NATIVE_ACTIVE\n')); }

test('selected native observation preserves production worker arguments and recognizes split bounded markers', () => {
  const f = fixture();
  for (let index = 0; index < 2; index++) {
    const child = f.worker.processArtworkBuffer({});
    child.stderr.emit('data', Buffer.from('x'.repeat(10_000) + 'HX_WEBP_'));
    child.stderr.emit('data', Buffer.from('NATIVE_ACTIVE\n')); mark(child);
    child.emit('close', 0, null);
    if (index === 0) f.observation.verifyPublication({ gate: f.gate, children: [{ closed: true }] });
  }
  const evidence = f.observation.getEvidence(); assert.equal(evidence.native.length, 2); assert.equal(evidence.firstSelectedNativeScanEncoderOverlap, true);
  assert.equal(f.getReleased(), 2); assert.equal(f.calls[0][1][0], '--jitless'); assert.equal(f.calls[0][1][1], '--import');
  assert.match(f.calls[0][1][2], /artwork-native-observation\.js$/u);
  assert.deepEqual(f.calls[0][2].stdio, ['pipe', 'pipe', 'pipe']);
  assert.deepEqual(f.calls[0][1].slice(3), ['/app/src/server/artwork/artwork-image-worker.js', '100', '8192', '800']);
});

test('active cancellation holds the full lease through actual close and prevents sibling launch', () => {
  const f = fixture({ scenario: 'cancel' }); const child = f.worker.processArtworkBuffer({});
  mark(child); assert.equal(f.children[0].signal.aborted, true);
  assert.deepEqual(f.worker.processArtworkBuffer({}), { aborted: true }); assert.equal(f.calls.length, 1);
  child.emit('close', null, 'SIGKILL'); const evidence = f.observation.getEvidence();
  assert.equal(evidence.native[0].beforeAbort, f.expected); assert.equal(evidence.native[0].afterAbort, f.expected); assert.equal(evidence.native[0].reservedAtClose, f.expected);
  f.setReserved(0); assert.equal(f.observation.getEvidence().native[0].reservedAtClose, f.expected);
});

test('missing native evidence, adjacent lifetimes and prematurely released publication leases cannot certify selection', () => {
  for (const mode of ['missing', 'encoder-closed', 'lease-shrunk']) {
    const f = fixture({ state: { scan: true, encoder: mode !== 'encoder-closed' } }); const child = f.worker.processArtworkBuffer({});
    if (mode === 'lease-shrunk') f.setReserved(f.expected - 1);
    if (mode !== 'missing') mark(child);
    child.emit('close', 0, null);
    assert.throws(() => f.observation.getEvidence());
    assert.throws(() => f.observation.verifyPublication({ gate: f.gate, children: [{ closed: true }] }));
  }
});

test('selected fixture rejects missing or foreign cases and unsupported scenarios before input IO', () => {
  for (const caseId of [undefined, '', {}, 'unbounded-image']) assert.throws(() => createDeploymentWebpSelectionFixture({ caseId }), TypeError);
  assert.throws(() => createDeploymentWebpSelectionFixture({ caseId: 'cover-type', scenario: 'retry', mediaObserver: {} }), TypeError);
});

test('mixed workload refuses incomplete fixtures and conflicting input owners before preparation', async () => {
  for (const artworkFixture of [{}, { prepare() {} }]) await assert.rejects(runDeploymentMemoryWorkload({ artworkFixture }), TypeError);
  for (const mode of [{ maximumBytes: true }, { artworkCaseId: 'rgb8-jpeg-noise' }]) {
    await assert.rejects(runDeploymentMemoryWorkload({ ...mode, artworkFixture: { prepare: () => assert.fail('Preparation must not start'), createWorker() {}, settle() {} } }), TypeError);
  }
});
