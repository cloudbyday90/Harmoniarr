/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { withWorkerTaskCleanup } from '../worker-task-cleanup.js';
import { createBackupArtifactFileVerificationService } from './backup-artifact-file-verification-service.js';
import { readBackupRecoveryHandle } from './backup-recovery-file-reader.js';

const existingFileFlags = constants.O_RDWR | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
const unverified = code => ({ status: 'unverified', code });
const changed = () => unverified('artifact_file_identity_changed');
const sameFile = (left, right) => left.isFile() && right.isFile()
  && ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].every(key => left[key] === right[key]);

/** Owns fresh file readiness before recovered publication; it never writes bytes. */
export function createBackupArtifactFileReadinessService({
  assertOwnership = async () => {},
  openFn = open,
  lstatFn = lstat,
  createVerificationService = createBackupArtifactFileVerificationService,
} = {}) {
  async function prepareBackupArtifactFile(input) {
    const storagePath = input?.storagePath ?? input?.artifact?.storagePath;
    if (typeof storagePath !== 'string' || storagePath.trim().length === 0) return unverified('artifact_storage_path_invalid');
    await assertOwnership();
    let initial, handle;
    try {
      initial = await lstatFn(storagePath, { bigint: true });
      if (!initial.isFile()) return unverified('artifact_path_not_file');
      await assertOwnership();
      handle = await openFn(storagePath, existingFileFlags);
    } catch (error) {
      if (error?.code === 'ENOENT') return { status: 'missing', code: 'artifact_file_missing' };
      throw error;
    }
    let settledStats;
    const result = await withWorkerTaskCleanup(async () => {
      const opened = await handle.stat({ bigint: true });
      if (!sameFile(initial, opened)) return changed();
      const boundedContent = input.maxFileSizeBytes == null ? null : await readBackupRecoveryHandle(handle,input.maxFileSizeBytes);
      const verifier = createVerificationService({
        statFn: async () => opened,
        readFileFn: () => boundedContent ?? handle.readFile(),
      });
      const verification = await verifier.verifyBackupArtifactFile({ ...input, storagePath });
      if (verification.status !== 'verified') return verification;
      await assertOwnership();
      await handle.sync();
      settledStats = await handle.stat({ bigint: true });
      return sameFile(opened, settledStats) ? verification : changed();
    }, () => handle.close());
    if (result.status !== 'verified') return result;
    await assertOwnership();
    try {
      return sameFile(settledStats, await lstatFn(storagePath, { bigint: true })) ? result : changed();
    } catch (error) {
      if (error?.code === 'ENOENT') return changed();
      throw error;
    }
  }
  return { prepareBackupArtifactFile };
}
