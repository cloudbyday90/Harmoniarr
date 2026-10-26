/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { link, lstat, mkdir, open, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { withWorkerTaskCleanup } from '../worker-task-cleanup.js';

const privateFileMode = 0o600;

export function createTemporaryBackupArtifactPath({ storagePath, token }) {
  if (typeof storagePath !== 'string' || storagePath.trim().length === 0) {
    throw new Error('storagePath is required');
  }

  if (typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('token is required');
  }

  return join(dirname(storagePath), `.${basename(storagePath)}.${token}.partial`);
}

/**
 * Owns the small, side-effect-only portion of a local backup artifact lifecycle.
 * The caller persists intent and verifies content before and after promotion.
 */
export function createBackupArtifactFileService({
  mkdirFn = mkdir,
  openFn = open,
  linkFn = link,
  lstatFn = lstat,
  assertOwnership = async () => {},
  unlinkFn = unlink,
} = {}) {
  async function writePrivateTemporaryFile({ content, temporaryPath }) {
    await assertOwnership();
    await mkdirFn(dirname(temporaryPath), { recursive: true });

    await assertOwnership();
    const handle = await openFn(temporaryPath, 'wx', privateFileMode);
    await withWorkerTaskCleanup(async () => {
      await handle.writeFile(content);
      await handle.sync();
    }, () => handle.close());
  }

  async function promoteTemporaryFile({ storagePath, temporaryPath }) {
    if (storagePath === temporaryPath) {
      throw new Error('Temporary and final backup artifact paths must differ');
    }

    await assertOwnership();
    await linkFn(temporaryPath, storagePath);
  }

  async function removeFileIfPresent({ storagePath }) {
    try {
      await assertOwnership();
      await unlinkFn(storagePath);
      return { removed: true };
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return { removed: false };
      }

      throw error;
    }
  }

  async function removeLinkedTemporaryFile({ storagePath, temporaryPath }) {
    if (!temporaryPath) return { removed: false };
    let temporary;
    try {
      temporary = await lstatFn(temporaryPath, { bigint: true });
    } catch (error) {
      if (error?.code === 'ENOENT') return { removed: false };
      throw error;
    }
    const final = await lstatFn(storagePath, { bigint: true });
    if (!temporary.isFile() || !final.isFile() || temporary.dev !== final.dev || temporary.ino !== final.ino) {
      throw Object.assign(new Error('Backup temporary file identity requires inspection'), { code: 'backup_artifact_temporary_identity_mismatch' });
    }
    await assertOwnership();
    await unlinkFn(temporaryPath);
    return { removed: true };
  }

  return {
    removeLinkedTemporaryFile,
    promoteTemporaryFile,
    removeFileIfPresent,
    writePrivateTemporaryFile,
  };
}
