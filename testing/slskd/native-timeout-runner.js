/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

/** Observe the released three-minute guard without a long-running Docker exec. */
export async function runNativeTimeoutScenario({ docker, fixtureId, signal }) {
  const step = async phase => JSON.parse(await docker([
    'exec', fixtureId, 'node', '/app/testing/slskd/native-timeout-step.js', phase,
  ]));
  await step('start');
  const started = performance.now();
  let observation;
  do {
    signal?.throwIfAborted();
    observation = await step('observe');
    if (observation.terminal) break;
    await delay(1000, undefined, { signal });
  } while (performance.now() - started < 210_000);
  assert.equal(observation.terminal, true, 'Released enqueue guard must terminate the original receipt');
  const elapsedMs = performance.now() - started;
  assert.ok(elapsedMs >= 175_000, 'Earlier peer failure must not substitute for the three-minute enqueue guard');
  const result = await step('retry');
  return { complete: true, elapsedMs, ...result };
}
