/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { performance } from 'node:perf_hooks';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import { createLibraryAddMediaFixture } from './library-add-media-tools.js';
import { createOwnedMediaInspectionExecutor } from './owned-media-inspection-executor.js';
import { createMediaTransportObserver, disabledMediaTransportObserver } from './media-transport-phase-observer.js';
import { resolveLibraryAddMediaOptions } from './library-add-media-options.js';

export { resolveLibraryAddMediaOptions };

/** Stable app adapters, with an independent inspection owner for each returned scenario. */
export function createLibraryAddMediaScenario({ mode = 'per-command', mediaImage,
  createExecutor = createOwnedMediaInspectionExecutor, createMediaFixture = createLibraryAddMediaFixture,
  onRecord = null, phaseObserver = null } = {}) {
  resolveLibraryAddMediaOptions({ HARMONIARR_LIBRARY_ADD_MEDIA_EXECUTION: mode, HARMONIARR_INTEGRATION_MEDIA_IMAGE: mediaImage });
  if (typeof createExecutor !== 'function' || typeof createMediaFixture !== 'function'
    || (onRecord !== null && typeof onRecord !== 'function')) throw new TypeError('Invalid library-add media adapters');
  let active = null;
  const prerequisite = createMediaFixture({ mediaImage, phaseObserver });
  function current() {
    if (!active?.fixture) throw new Error('Library-add media requires an active scenario');
    return active;
  }
  const mediaFixture = Object.freeze({
    verifyTooling: prerequisite.verifyTooling,
    getTooling: prerequisite.getTooling,
    generateAudio: (...args) => { const scope = current(); scope.generations++; return scope.fixture.generateAudio(...args); },
    mediaCommand: (...args) => { const scope = current(); if (args[0] === 'ffprobe') scope.inspections++; return scope.fixture.mediaCommand(...args); },
  });
  async function runScenario(runtime, work, options = {}) {
    if (active) throw new Error('Library-add media scenarios must run serially');
    if (typeof work !== 'function' || (options.workspaceCleanupGuard !== undefined
      && typeof options.workspaceCleanupGuard !== 'function')) throw new TypeError('Invalid library-add media scenario');
    const scope = { fixture: null, executor: null, generations: 0, inspections: 0 };
    const transport = onRecord && mode === 'owned-api' ? createMediaTransportObserver() : disabledMediaTransportObserver;
    const started = performance.now(); let closing; let closeMs = null;
    const close = () => closing ??= (async () => {
      const start = performance.now();
      try { await scope.executor?.close(); }
      finally { closeMs = performance.now() - start; }
    })();
    active = scope;
    try {
      return await withWorkerTaskCleanup(() => runtime.runScenario(context => {
        scope.executor = mode === 'owned-api' ? createExecutor({ workspaceDir: context.workspaceDir,
          image: mediaImage, inspectionReadMode: 'api', transportObserver: transport }) : null;
        scope.fixture = createMediaFixture({ getFixtureRoot: () => context.workspaceDir, mediaImage, inspectionExecutor: scope.executor });
        return work(context);
      }, { ...options, workspaceCleanupGuard: async () => {
        // The runtime invokes this after HTTP, worker and pool drainage, before child removal.
        await close();
        return (!scope.executor || scope.executor.canRemoveWorkspace() === true)
          && (options.workspaceCleanupGuard ? await options.workspaceCleanupGuard() === true : true);
      } }), close);
    } finally {
      // A returned database tail (and canonical close) has settled before adapters can be reused.
      active = null;
      if (onRecord) {
        try { await onRecord({ mode, generations: scope.generations, inspections: scope.inspections,
          elapsedMs: performance.now() - started, closeMs,
          ownerCleanupSafe: scope.executor ? scope.executor.canRemoveWorkspace() : null, transport: transport.snapshot() }); }
        catch { /* Optional aggregate evidence cannot replace the scenario/close outcome. */ }
      }
    }
  }
  return Object.freeze({ mediaFixture, runScenario });
}
