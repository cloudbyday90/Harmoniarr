/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createArtworkWorkerService } from '../../src/server/artwork/artwork-worker-service.js';
import { initialArtworkMemoryReservation } from '../../src/server/artwork/artwork-memory-reservation.js';

const marker = 'HX_WEBP_NATIVE_ACTIVE\n';
/** Bounded fixture observation; no production grant, deadline or framing changes. */
export function createDeploymentWebpSelectionObserver({ mediaObserver, inputBytes, scenario, signal, createWorkerFn = createArtworkWorkerService }) {
  if (!['publish', 'cancel'].includes(scenario) || typeof createWorkerFn !== 'function'
    || typeof mediaObserver?.getActiveState !== 'function' || typeof mediaObserver.releaseScan !== 'function') throw new TypeError('Invalid selected artwork observation');
  const expectedBytes = initialArtworkMemoryReservation(inputBytes);
  const controller = new AbortController(); const headers = []; const records = []; let failure;
  return {
    createWorker({ spawnFn, gate }) {
      const worker = createWorkerFn({ spawnFn: (file, args, options) => {
        const index = args.findIndex(value => value.endsWith('artwork-image-worker.js')); assert.ok(index >= 0);
        assert.deepEqual(options.stdio, ['pipe', 'pipe', 'ignore']);
        const child = spawnFn(file, [...args.slice(0, index), '--import', fileURLToPath(new URL('./artwork-native-observation.js', import.meta.url)), ...args.slice(index)], { ...options, stdio: ['pipe', 'pipe', 'pipe'] });
        const row = { active: false, closed: false }; records.push(row); let tail = '';
        child.stderr.on('error', error => { failure ??= error; controller.abort(); mediaObserver.releaseScan(); });
        child.stderr.on('data', chunk => {
          if (row.active || failure) return;
          // Keep only a fixed marker-sized suffix, including across split chunks.
          const text = tail + chunk.toString('utf8'); tail = text.slice(-(marker.length - 1));
          if (!text.includes(marker)) return;
          try {
            row.active = true; const state = mediaObserver.getActiveState(); row.scan = state.scan; row.encoder = state.encoder;
            assert.equal(headers.length, records.length); assert.equal(row.closed, false);
            if (records.length === 1) assert.deepEqual(state, { scan: true, encoder: true });
            row.beforeAbort = gate.getMemoryState().reservedBytes; assert.equal(row.beforeAbort, expectedBytes);
            if (scenario === 'cancel') { controller.abort(); row.afterAbort = gate.getMemoryState().reservedBytes; assert.equal(row.afterAbort, expectedBytes); }
          } catch (error) { failure = error; controller.abort(); }
          finally { mediaObserver.releaseScan(); }
        });
        child.once('close', (code, exitSignal) => Object.assign(row, { closed: true, code, signal: exitSignal, reservedAtClose: gate.getMemoryState().reservedBytes }));
        return child;
      } });
      return { processArtworkBuffer: options => worker.processArtworkBuffer({ ...options,
        signal: AbortSignal.any([signal, controller.signal, options.signal].filter(Boolean)),
        onMetadata: metadata => { assert.equal(metadata.webpSelection, true); headers.push({ ...metadata }); return options.onMetadata?.(metadata); },
      }) };
    },
    verifyPublication({ gate, children }) {
      if (failure) throw failure;
      assert.equal(scenario, 'publish'); assert.equal(records.length, 1); assert.equal(records[0].active, true);
      assert.equal(children.length, 1); assert.equal(children[0].closed, true);
      assert.equal(gate.getMemoryState().reservedBytes, expectedBytes); assert.equal(gate.getState().queued, 1);
    },
    getEvidence() {
      if (failure) throw failure;
      assert.equal(records.length, scenario === 'publish' ? 2 : 1); assert.equal(headers.length, records.length);
      assert.ok(records.every(row => row.active && row.closed));
      if (scenario === 'cancel') { assert.equal(records[0].signal, 'SIGKILL'); assert.equal(records[0].reservedAtClose, expectedBytes); }
      else assert.ok(records.every(row => row.code === 0 && row.signal === null));
      return { mode: scenario, headers: headers.map(row => ({ ...row })), native: records.map(row => ({ ...row })), expectedReservedBytes: expectedBytes,
        firstSelectedNativeScanEncoderOverlap: records[0].scan && records[0].encoder, instrumentation: 'one 1ms sampled Sharp active-task stderr marker per production worker' };
    },
  };
}
