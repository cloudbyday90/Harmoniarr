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

import { stat } from 'node:fs/promises';

function normalizeExpectedSize(value) {
  const size = Number(value);
  return Number.isFinite(size) && size >= 0 ? size : null;
}

async function inspectFile(pathValue, statFn) {
  if (typeof pathValue !== 'string' || pathValue.trim().length === 0) {
    return null;
  }

  try {
    const result = await statFn(pathValue);
    return result?.isFile?.() === false ? null : result;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

function buildObservation(fileStats) {
  return {
    exists: Boolean(fileStats),
    sizeBytes: fileStats ? Number(fileStats.size) : null,
  };
}

function buildResult({
  expectedSizeBytes,
  message,
  sourceStats,
  status,
  destinationStats,
}) {
  return {
    destination: buildObservation(destinationStats),
    expectedSizeBytes,
    message,
    source: buildObservation(sourceStats),
    status,
  };
}

/**
 * Confirms a persisted file-mutation intent after a process interruption.
 * Filesystem calls and PostgreSQL cannot share one transaction, so this
 * deliberately returns an ambiguous result rather than guessing whenever the
 * observed paths do not prove either complete success or no mutation.
 */
export function createMediaFileMutationConfirmationService({
  statFn = stat,
} = {}) {
  async function confirmMutation({
    destinationPath,
    expectedSizeBytes,
    removeSourceAfterSuccess = false,
    sourcePath,
  } = {}) {
    const expectedSize = normalizeExpectedSize(expectedSizeBytes);
    if (expectedSize == null) {
      return buildResult({
        destinationStats: null,
        expectedSizeBytes: null,
        message: 'The earlier filesystem change cannot be confirmed because its expected file size was not recorded.',
        sourceStats: null,
        status: 'ambiguous',
      });
    }

    const [sourceStats, destinationStats] = await Promise.all([
      inspectFile(sourcePath, statFn),
      inspectFile(destinationPath, statFn),
    ]);
    const sourceMatchesExpectedSize = sourceStats?.size === expectedSize;
    const destinationMatchesExpectedSize = destinationStats?.size === expectedSize;

    if (destinationMatchesExpectedSize
      && (removeSourceAfterSuccess ? !sourceStats : sourceMatchesExpectedSize)) {
      return buildResult({
        destinationStats,
        expectedSizeBytes: expectedSize,
        message: 'The earlier filesystem change is confirmed by the expected destination file state.',
        sourceStats,
        status: 'confirmed',
      });
    }

    if (!destinationStats && sourceMatchesExpectedSize) {
      return buildResult({
        destinationStats,
        expectedSizeBytes: expectedSize,
        message: 'The earlier filesystem change did not begin; the original source is still intact.',
        sourceStats,
        status: 'safe_to_retry',
      });
    }

    return buildResult({
      destinationStats,
      expectedSizeBytes: expectedSize,
      message: 'The filesystem does not prove whether the earlier change completed. No further file changes will be made automatically.',
      sourceStats,
      status: 'ambiguous',
    });
  }

  return {
    confirmMutation,
  };
}
