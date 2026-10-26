/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { withWorkerTaskCleanup } from '../worker-task-cleanup.js';

const directoryFlags = constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
const sameDirectory = (left, right) => left.isDirectory() && right.isDirectory() && left.dev === right.dev && left.ino === right.ino;
function identityFailure() {
  return Object.assign(new Error('Backup directory identity requires inspection'), { code: 'backup_artifact_directory_identity_mismatch' });
}

/** Requests a namespace checkpoint; unsupported or failed sync never becomes success. */
export function createBackupArtifactDirectorySyncService({ assertOwnership = async () => {}, openFn = open, lstatFn = lstat } = {}) {
  async function syncParentDirectory({ storagePath } = {}) {
    if (typeof storagePath !== 'string' || storagePath.trim().length === 0) throw new TypeError('storagePath is required');
    const directory = dirname(storagePath);
    await assertOwnership();
    const initial = await lstatFn(directory, { bigint: true });
    if (!initial.isDirectory()) throw identityFailure();
    await assertOwnership();
    const handle = await openFn(directory, directoryFlags);
    await withWorkerTaskCleanup(async () => {
      if (!sameDirectory(initial, await handle.stat({ bigint: true }))) throw identityFailure();
      await assertOwnership();
      await handle.sync();
    }, () => handle.close());
    await assertOwnership();
    if (!sameDirectory(initial, await lstatFn(directory, { bigint: true }))) throw identityFailure();
  }
  return { syncParentDirectory };
}
