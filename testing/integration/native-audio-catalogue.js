/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { realpath } from 'node:fs/promises';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';

export async function qualifyNativeAudioCatalogue({ pool, library, canonicalPath, size }) {
  const claimed = await createOperationQueueStore({ getPoolFn: () => pool }).claimNextRunnableRun({ operationTypes: ['library_scan'] });
  assert.ok(claimed, 'Actual apply must schedule its canonical scan');
  const { completion } = await library.libraryScanWorker.startWorkerRun({ ...claimed.summary, runId: claimed.id });
  assert.ok(completion && typeof completion.then === 'function');
  await completion;
  const run = await library.libraryScanRunStore.getRunById(claimed.id);
  assert.equal(run.status, 'completed', JSON.stringify(run));
  const rows = (await pool.query('SELECT canonical_path,size_bytes,file_state,deleted_at FROM library_files')).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].canonical_path, await realpath(canonicalPath));
  assert.equal(Number(rows[0].size_bytes), size);
  assert.equal(rows[0].file_state, 'observed');
  assert.equal(rows[0].deleted_at, null);
  return { scanCompleted: true, canonicalFiles: 1 };
}
