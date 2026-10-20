/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { sendNativePartial } from './native-partial-sender.js';
import { inspectNativePartial } from './native-partial-inspection.js';
import { writeNativeFileRange } from './native-file-sender.js';
import { nativeResumePlans } from './native-resume-policy.js';

export async function sendNativeResume(socket, record, offset, { signal, beforeReset, inspect = inspectNativePartial } = {}) {
  if (!nativeResumePlans.includes(record?.plan) || ![1, 2].includes(record.attempt)) throw new TypeError('An owned resume record is required');
  signal?.throwIfAborted();
  if (record.attempt === 1) {
    assert.equal(offset, 0);
    return sendNativePartial(socket, record.plan, { signal, beforeReset });
  }
  assert.ok(Number.isSafeInteger(offset) && offset >= 16384 && offset <= record.plan.bytes);
  // The provider is waiting for bytes, so its append handle cannot race this read.
  const prefix = await inspect('/incomplete', record.plan);
  signal?.throwIfAborted();
  assert.equal(prefix.size, offset, 'Resume offset must match the actual verified incomplete file');
  await writeNativeFileRange(socket, record.plan.file, offset);
  signal?.throwIfAborted();
  return { filename: record.plan.file.filename, attempt: 2, offset, emittedBytes: record.plan.file.size - offset,
    prefixSha256: prefix.sha256, prefixIdentityStable: prefix.identityStable };
}
