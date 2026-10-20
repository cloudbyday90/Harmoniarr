/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { lstat } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { nativePeer } from './fixture-data.js';
import { nativePartialPlans } from './native-partial-plan.js';

/** Require actual incomplete-file progress before RST, not just local write completion. */
export async function waitForNativePartial(file, { signal, root = '/incomplete', statFn = lstat } = {}) {
  const plan = nativePartialPlans.find(row => row.file === file && row.kind === 'reset');
  if (!plan) throw new TypeError('An owned reset plan is required');
  const path = root + '/' + nativePeer + '/' + file.filename.replaceAll('\\', '/');
  const deadline = performance.now() + 15_000;
  do {
    signal?.throwIfAborted();
    try {
      const stat = await statFn(path);
      signal?.throwIfAborted();
      assert.equal(stat.isFile(), true); assert.ok(stat.size <= plan.bytes);
      if (stat.size >= 16_384) return stat.size;
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      if (error?.code !== 'ENOENT') throw error;
    }
    try { await delay(100, undefined, { signal }); }
    catch (error) { if (signal?.aborted) throw signal.reason; throw error; }
  } while (performance.now() < deadline);
  throw new Error('Native incomplete prefix was not observed before reset');
}
