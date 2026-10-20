/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { writeNativeFilePrefix } from './native-file-sender.js';
import { nativePartialPlans } from './native-partial-plan.js';

export async function sendNativePartial(socket, plan, { signal, beforeReset } = {}) {
  if (!nativePartialPlans.includes(plan) || !['eof', 'reset'].includes(plan.kind)
    || (plan.kind === 'reset' && typeof beforeReset !== 'function')) throw new TypeError('An owned fault plan and checkpoint are required');
  signal?.throwIfAborted();
  await writeNativeFilePrefix(socket, plan.file, plan.bytes);
  signal?.throwIfAborted();
  let checkpointBytes = null;
  if (plan.kind === 'reset') {
    checkpointBytes = await beforeReset(plan.file, { signal });
    signal?.throwIfAborted();
    socket.resetAndDestroy();
  } else await new Promise((resolve, reject) => { socket.end(error => error ? reject(error) : resolve()); });
  return { filename: plan.file.filename, kind: plan.kind, emittedBytes: plan.bytes, checkpointBytes };
}
