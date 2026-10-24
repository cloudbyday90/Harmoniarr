/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createDeploymentReviewObserver, runDeploymentReviewConcurrently } from '../../testing/server/deployment-review-observer.js';

function fixture(now = (() => { let clock = 0; return () => ++clock; })()) {
  const mediaObserver = { enterScan: async () => {}, finishScan: () => {}, spawnMedia: () => new EventEmitter() };
  const observation = createDeploymentReviewObserver({ mediaObserver, now });
  const start = kind => { const child = observation.observer.spawnMedia(kind); child.emit('spawn'); return child; };
  return { observation, start };
}
test('review latency requires real response completion within observed scan and encoder lifetimes', async () => {
  const { observation, start } = fixture();
  await observation.observer.enterScan(); const encoder = start('encode');
  await observation.measure('page', async () => 'read');
  encoder.emit('close');
  await observation.measure('queued', async () => 'read');
  const evidence = observation.getEvidence(); assert.equal(evidence.detailNativeOverlap, true);
  assert.deepEqual(evidence.operations.map(row => [row.phase, row.elapsedMs, row.overlapThroughCompletion]), [['page', 1, true], ['queued', 1, false]]);
  observation.close(); await assert.rejects(observation.measure('page', async () => {}), TypeError);
  assert.throws(() => observation.observer.spawnMedia('encode'), TypeError);
});
test('adjacent launch or early encoder close cannot certify an overlapping detail response', async () => {
  for (const earlyClose of [true, false]) {
    const { observation, start } = fixture(); await observation.observer.enterScan();
    const child = start(earlyClose ? 'encode' : 'probe');
    await observation.measure('page', async () => { if (earlyClose) child.emit('close'); });
    assert.throws(() => observation.getEvidence(), /actual detail response/u); observation.close();
  }
});
test('bounded observation refuses extra phases/operations and preserves Error/null through bad timing evidence', async () => {
  const { observation } = fixture();
  await assert.rejects(observation.measure('private unbounded phase', async () => {}), TypeError);
  for (let i = 0; i < 24; i++) await observation.measure('page', async () => {});
  await assert.rejects(observation.measure('page', async () => {}), TypeError); observation.close();
  for (const reason of [new Error('original'), null]) {
    let calls = 0; const f = fixture(() => ++calls === 1 ? 0 : NaN);
    await assert.rejects(f.observation.measure('page', async () => { throw reason; }), error => error === reason); f.observation.close();
  }
});
test('parallel review/media ownership drains the sibling before propagating the first Error/null', async () => {
  for (const reason of [new Error('original'), null]) {
    const entered = Promise.withResolvers(); const release = Promise.withResolvers(); let completed = false;
    const operation = runDeploymentReviewConcurrently(async () => { entered.resolve(); await release.promise; return { media: true }; }, async () => { throw reason; });
    void operation.finally(() => { completed = true; }).catch(() => {});
    await entered.promise; await Promise.resolve(); assert.equal(completed, false);
    release.resolve(); await assert.rejects(operation, error => error === reason);
  }
  assert.deepEqual(await runDeploymentReviewConcurrently(async () => ({ media: true }), async () => ({ detail: true })), { media: true, review: { detail: true } });
});
