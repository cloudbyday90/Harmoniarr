/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { captureMediaInspectionPolicy, mediaExecutorError } from './owned-media-inspection-policy.js';
import { createOwnedMediaDockerTransport } from './owned-media-docker-transport.js';
import { disabledMediaTransportObserver } from './media-transport-phase-observer.js';

/** A lazy serial scenario owner; close seals admission synchronously and drains returned work. */
export function createOwnedMediaInspectionExecutor({ workspaceDir, image = process.env.HARMONIARR_INTEGRATION_MEDIA_IMAGE,
  signal, createTransport = createOwnedMediaDockerTransport, transportObserver = disabledMediaTransportObserver,
  inspectionReadMode = 'cli' } = {}) {
  if (typeof createTransport !== 'function' || !['cli', 'api'].includes(inspectionReadMode)) throw new TypeError('Invalid media executor transport');
  let sealed = false; let pending = 0; let tail = Promise.resolve(); let failed = false; let failure;
  let capture; let start; let transport; let retirement; let closing; let cleanupSafe = true;
  const retire = () => retirement ??= Promise.resolve().then(() => transport.retire());
  function run(binary, args, options) {
    // The reviewed canonical preview inspects its two independent files concurrently.
    // Bound admission to those two, but execute only one native command at a time.
    if (sealed || pending >= 2) return Promise.reject(mediaExecutorError('fixture_media_admission_closed'));
    pending++; cleanupSafe = false;
    const admitted = tail.then(async () => {
      if (failed) throw failure;
      signal?.throwIfAborted();
      const policy = await (capture ??= captureMediaInspectionPolicy(workspaceDir));
      await policy.map(binary, args, options);
      await (start ??= (async () => {
        transport = createTransport({ image, root: policy.root, transportObserver, inspectionReadMode }); cleanupSafe = false;
        await transport.start();
      })());
      signal?.throwIfAborted();
      const mapped = await policy.map(binary, args, options);
      return transport.run(mapped, signal);
    }).catch(async error => {
      sealed = true;
      if (!failed) {
        failed = true; failure = signal?.aborted ? signal.reason : error;
        if (transport) { try { await retire(); } catch { /* Original command/start failure owns the outcome. */ } }
      }
      throw failure;
    }).finally(() => { pending--; });
    tail = admitted.then(() => {}, () => {});
    return admitted;
  }
  function close() {
    sealed = true;
    return closing ??= (async () => {
      await tail;
      let cleanupFailed = false; let cleanupError;
      try { if (transport) { await retire(); await transport.remove(); } }
      catch (error) { cleanupFailed = true; cleanupError = error; }
      try { await transport?.closeReader?.(); }
      catch (error) { if (!cleanupFailed) { cleanupFailed = true; cleanupError = error; } }
      if (cleanupFailed) throw cleanupError;
      if (capture) await (await capture).assertRoot();
      cleanupSafe = true;
    })();
  }
  return Object.freeze({ run, close, inspectionReadMode, canRemoveWorkspace: () => cleanupSafe });
}
