/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';

const phases = new Set(['page', 'reverse', 'restart', 'checking', 'worker', 'queued']);
/** Fixed numeric evidence; real child spawn/close owns the overlap claim. */
export function createDeploymentReviewObserver({ mediaObserver, now = () => performance.now() }) {
  const children = []; const requests = []; let scanActive = false; let open = true; let pending = 0;
  const state = () => ({ scan: scanActive, encoder: children.some(row => row.kind === 'encode' && row.started && !row.closed) });
  const observer = { ...mediaObserver,
    enterScan: async () => { scanActive = true; return mediaObserver.enterScan(); },
    finishScan: () => { scanActive = false; mediaObserver.finishScan(); },
    spawnMedia(kind, ...args) {
      if (!open) throw new TypeError('Review observation closed');
      const child = mediaObserver.spawnMedia(kind, ...args); const record = { kind, started: false, closed: false }; children.push(record);
      child.once('spawn', () => { record.started = true; }); child.once('close', () => { record.closed = true; }); return child;
    },
  };
  async function measure(phase, work) {
    if (!open || !phases.has(phase) || requests.length + pending >= 24) throw new TypeError('Review measurement admission refused');
    const start = now(); assert.ok(Number.isFinite(start));
    pending++; const before = state(); let failed = false; let failure; let result;
    try { result = await work(); } catch (error) { failed = true; failure = error; }
    pending--;
    try {
      const elapsedMs = now() - start; const after = state(); assert.ok(Number.isFinite(elapsedMs) && elapsedMs >= 0);
      requests.push({ phase, elapsedMs, failed, overlapAtStart: before.scan && before.encoder, overlapThroughCompletion: before.scan && before.encoder && after.scan && after.encoder });
    } catch (error) { if (!failed) { failed = true; failure = error; } }
    if (failed) throw failure;
    return result;
  }
  return { observer, measure,
    getEvidence() {
      assert.equal(pending, 0); assert.ok(requests.length > 0);
      assert.ok(requests.some(row => row.phase === 'page' && row.overlapThroughCompletion), 'Require an actual detail response during scan/encoder lifetime overlap');
      return { operations: requests.map(row => ({ ...row })), maximumOperations: 24,
        detailNativeOverlap: true, sampledLatencyOnly: true };
    },
    close() { open = false; assert.equal(pending, 0); },
  };
}

/** Drain both owners after first failure, retaining the original Error or null. */
export async function runDeploymentReviewConcurrently(media, review) {
  let failed = false; let failure;
  const run = work => Promise.resolve().then(work).catch(error => { if (!failed) { failed = true; failure = error; } });
  const values = await Promise.all([run(media), run(review)]);
  if (failed) throw failure;
  return { ...values[0], review: values[1] };
}
