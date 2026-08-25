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

import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

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
  renameFn = rename,
  unlinkFn = unlink,
} = {}) {
  async function writePrivateTemporaryFile({ content, temporaryPath }) {
    await mkdirFn(dirname(temporaryPath), { recursive: true });

    const handle = await openFn(temporaryPath, 'wx', privateFileMode);
    try {
      await handle.writeFile(content);
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async function promoteTemporaryFile({ storagePath, temporaryPath }) {
    if (storagePath === temporaryPath) {
      throw new Error('Temporary and final backup artifact paths must differ');
    }

    await renameFn(temporaryPath, storagePath);
  }

  async function removeFileIfPresent({ storagePath }) {
    try {
      await unlinkFn(storagePath);
      return { removed: true };
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return { removed: false };
      }

      throw error;
    }
  }

  return {
    promoteTemporaryFile,
    removeFileIfPresent,
    writePrivateTemporaryFile,
  };
}
