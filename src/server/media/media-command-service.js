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

import { spawn } from 'node:child_process';
import { createMediaCommandAdmission } from './media-command-admission.js';
import { executeMediaCommand } from './media-command-process.js';

function snapshotArgs(args) {
  if (!Array.isArray(args) || args.length > 256) throw new TypeError('Invalid media command arguments');
  const snapshot = []; let bytes = 0;
  for (const arg of args) {
    if (typeof arg !== 'string' || arg.includes('\0')) throw new TypeError('Invalid media command arguments');
    bytes += Buffer.byteLength(arg);
    if (bytes > 64 * 1024) throw new TypeError('Media command arguments exceed their byte limit');
    snapshot.push(arg);
  }
  return Object.freeze(snapshot);
}

export function createMediaCommandService({
  allowedBinaries = [],
  admission = createMediaCommandAdmission(),
  defaultKillGraceMs = 5000,
  defaultMaxBuffer = 1024 * 1024,
  defaultTimeoutMs = 5000,
  onCommandExit = () => {},
  onCommandStart = () => {},
  onCommandWarning = () => {},
  spawnFn = spawn,
} = {}) {
  const allowedBinarySet = new Set(allowedBinaries.filter(binary => typeof binary === 'string' && binary.trim()).map(binary => binary.trim().toLowerCase()));
  async function runCommand({ args = [], binary, killGraceMs = defaultKillGraceMs, killSignal = 'SIGTERM', label = null,
    maxBuffer = defaultMaxBuffer, signal = null, timeoutMs = defaultTimeoutMs }) {
    if (typeof binary !== 'string' || !binary.trim() || binary.length > 4096 || binary.includes('\0')) throw new TypeError('runCommand requires binary');
    const normalizedBinary = binary.trim();
    if (allowedBinarySet.size > 0 && !allowedBinarySet.has(normalizedBinary.toLowerCase())) {
      throw Object.assign(new Error('Binary is not allowlisted for media command execution'), { code: 'media_command_binary_not_allowed' });
    }
    if (!Number.isInteger(maxBuffer) || maxBuffer < 1 || maxBuffer > 64 * 1024 * 1024
      || !Number.isInteger(timeoutMs) || timeoutMs < 0 || timeoutMs > 30 * 60 * 1000
      || !Number.isInteger(killGraceMs) || killGraceMs < 1 || killGraceMs > 60_000
      || !['SIGTERM', 'SIGKILL'].includes(killSignal)
      || (label !== null && (typeof label !== 'string' || label.length > 4096))) throw new TypeError('Invalid media command bounds');
    const command = { binary: normalizedBinary, args: snapshotArgs(args), killGraceMs, killSignal, label, maxBuffer, signal, timeoutMs };
    return admission.run(() => executeMediaCommand(command, { spawnFn, onCommandExit, onCommandStart, onCommandWarning }),
      { signal: signal ?? undefined });
  }
  return { runCommand, getAdmissionState: admission.getState };
}
