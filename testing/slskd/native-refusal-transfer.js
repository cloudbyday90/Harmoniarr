/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { nativeRefusalPlans } from './native-refusal-policy.js';
import { sendNativePartial } from './native-partial-sender.js';
import { inspectNativePartial } from './native-partial-inspection.js';

export async function sendNativeRefusal(socket, record, offset, { signal, beforeReset, inspect = inspectNativePartial } = {}) {
  if (!nativeRefusalPlans.includes(record?.plan) || !record.acceptsFile
    || !Number.isInteger(record.attempt) || record.attempt < 1 || record.attempt > record.plan.maxAttempts) {
    throw new TypeError('An owned refusal transfer is required');
  }
  signal?.throwIfAborted();
  if (record.attempt === 1) {
    assert.equal(offset, 0);
    const result = await sendNativePartial(socket, record.plan.partial, { signal, beforeReset });
    return { ...result, kind: record.plan.kind, attempt: 1, offset };
  }
  assert.equal(record.plan.kind, 'exhaustion'); assert.equal(offset, record.plan.partial.bytes);
  const prefix = await inspect('/incomplete', record.plan.partial);
  signal?.throwIfAborted();
  assert.equal(prefix.size, offset, 'Refusal offset must match the actual incomplete prefix');
  try { await new Promise((resolve, reject) => { socket.end(error => error ? reject(error) : resolve()); }); }
  catch (error) { if (signal?.aborted) throw signal.reason; throw error; }
  signal?.throwIfAborted();
  return { filename: record.plan.partial.file.filename, kind: record.plan.kind, attempt: record.attempt, offset,
    emittedBytes: 0, prefixSha256: prefix.sha256, prefixIdentityStable: prefix.identityStable };
}
