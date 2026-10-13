/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { createOperatorTrackSourceLifecycleStore } from './operator-track-source-lifecycle-store.js';
import { tryLockedOperatorTrackSourceNoop } from './operator-track-source-noop-store.js';

/** Mutations belong to the publication/reconciliation transaction, never a reader. */
export function createOperatorTrackSourceLifecycleService({ store } = {}) {
  const nativeStore = store === undefined;
  store ??= createOperatorTrackSourceLifecycleStore();
  async function reconcileSources({ sources = [], queryable, assertCurrent = async () => {}, rootReadAuthority, verificationObserver }) {
    const selected = new Map();
    for (const source of structuredClone(sources)) {
      const key = JSON.stringify([source.ownerId, source.mediaRequestId, source.scope]);
      // Another verified delivery of the same requirement prevents reopening an older missing copy.
      if (!selected.has(key) || source.available) selected.set(key, source);
    }
    if (selected.size === 0) return;
    for (const source of [...selected.values()].sort((a, b) => a.mediaRequestId.localeCompare(b.mediaRequestId))) {
      if (nativeStore && await tryLockedOperatorTrackSourceNoop({ source, queryable, rootReadAuthority })) {
        verificationObserver?.increment('sourceNoops');
        continue;
      }
      await assertCurrent();
      verificationObserver?.increment('sourceTransitionAttempts');
      if (await store.transitionSource({ source, queryable })) await store.insertEvent({ source, queryable });
    }
    await assertCurrent();
  }
  return { reconcileSources };
}
