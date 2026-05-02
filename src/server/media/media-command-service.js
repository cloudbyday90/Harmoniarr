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

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const defaultExecFileAsync = promisify(execFile);

function normalizeAllowedBinaries(value) {
  if (!Array.isArray(value)) {
    return new Set();
  }

  return new Set(value
    .filter((binary) => typeof binary === 'string' && binary.trim().length > 0)
    .map((binary) => binary.trim().toLowerCase()));
}

export function createMediaCommandService({
  allowedBinaries = [],
  defaultMaxBuffer = 1024 * 1024,
  defaultTimeoutMs = 5000,
  execFileAsync = defaultExecFileAsync,
} = {}) {
  const allowedBinarySet = normalizeAllowedBinaries(allowedBinaries);

  async function runCommand({
    args = [],
    binary,
    maxBuffer = defaultMaxBuffer,
    timeoutMs = defaultTimeoutMs,
  }) {
    if (typeof binary !== 'string' || binary.trim().length === 0) {
      throw new Error('runCommand requires binary');
    }

    const normalizedBinary = binary.trim();
    if (allowedBinarySet.size > 0 && !allowedBinarySet.has(normalizedBinary.toLowerCase())) {
      const error = new Error(`Binary is not allowlisted for media command execution: ${normalizedBinary}`);
      error.code = 'media_command_binary_not_allowed';
      throw error;
    }

    return execFileAsync(normalizedBinary, args, {
      maxBuffer,
      shell: false,
      timeout: timeoutMs,
      windowsHide: true,
    });
  }

  return {
    runCommand,
  };
}