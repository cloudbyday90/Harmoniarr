/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createArtworkWorkerService } from '../../src/server/artwork/artwork-worker-service.js';
import { ARTWORK_WORKER_OUTPUT_LIMIT, isArtworkWorkerError } from '../../src/server/artwork/artwork-worker-protocol.js';
import { selectWebpRewriteCase } from './webp-lossless-cases.js';

const fixture = fileURLToPath(new URL('./webp-effort-worker.js', import.meta.url));
/** Reuse production framing/deadline/close ownership; replace only the test child. */
export async function compareWebpEffort({ buffer, effort, scope, mode = 'lossy', signal }, { spawnFn = spawn } = {}) {
  const spec = selectWebpRewriteCase(effort, scope, mode); const controller = new AbortController();
  const records = []; const diagnostics = []; let diagnosticBytes = 0; let overflow = false;
  const worker = createArtworkWorkerService({ spawnFn: (file, args, options) => {
    const index = args.findIndex(value => value.endsWith('artwork-image-worker.js')); assert.ok(index >= 0);
    const child = spawnFn(file, [...args.slice(0, index), fixture, ...args.slice(index + 1), String(effort), scope, mode],
      { ...options, stdio: ['pipe', 'pipe', 'pipe'] });
    const record = { pid: child.pid, closed: false }; records.push(record);
    child.stderr.on('data', chunk => {
      const kept = chunk.subarray(0, Math.max(0, 4096 - diagnosticBytes)); diagnostics.push(kept); diagnosticBytes += kept.length;
      if (kept.length !== chunk.length) { overflow = true; controller.abort(); }
    });
    child.once('close', (code, exitSignal) => Object.assign(record, { closed: true, code, signal: exitSignal })); return child;
  } });
  const started = performance.now(); let result; let failure;
  try { result = await worker.processArtworkBuffer({ buffer, maxBytes: ARTWORK_WORKER_OUTPUT_LIMIT, maxDimensionPixels: 8192,
    signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal }); }
  catch (error) {
    if (!isArtworkWorkerError(error) || !['artwork_worker_failed', 'artwork_worker_timeout'].includes(error.code)) throw error;
    failure = { code: error.code, status: error.status };
  }
  const wholeWorkerMs = performance.now() - started;
  assert.equal(overflow, false); assert.equal(records.length, 1); const child = records[0];
  assert.equal(child.closed, true); assert.ok(Number.isInteger(child.pid) && child.pid > 0);
  assert.throws(() => process.kill(child.pid, 0), { code: 'ESRCH' });
  const reports = Buffer.concat(diagnostics).toString('utf8').split('\n').filter(line => line.startsWith('{"comparison":')).map(line => JSON.parse(line));
  const deadline = failure?.code === 'artwork_worker_timeout'; let report = null;
  if (!deadline) {
    assert.equal(child.signal, null); assert.equal(child.code, failure ? 1 : 0); assert.equal(reports.length, 1); [report] = reports;
    assert.equal(report.started, true); assert.equal(report.outcome, failure ? 'failed' : 'success');
    assert.ok(Number.isFinite(report.encodeMs) && report.encodeMs >= 0); assert.ok(Number.isSafeInteger(report.maxRssKiB) && report.maxRssKiB > 0);
    assert.equal(report.outputBytes, result?.data.length ?? 0);
  } else assert.equal(child.signal, 'SIGKILL');
  return { spec, data: result?.data ?? null, observation: { id: spec.id, effort, quality: spec.quality, scope, mode,
    outcome: deadline ? 'deadline' : failure ? 'encoder-failed' : 'encoded', failure: failure ?? null,
    wholeWorkerMs, encodeMs: report?.encodeMs ?? null, childMaxRssKiB: report?.maxRssKiB ?? null,
    outputBytes: result?.data.length ?? 0, worker: child, diagnosticBytes, retirementVerified: true,
    qualification: 'test-only encoder comparison; no production admission/publication or statistics' } };
}
