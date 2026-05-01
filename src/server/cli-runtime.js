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

export async function runCliTask({
  cleanup = async () => {},
  onError,
  onSuccess = async () => {},
  processEmitter = process,
  reporter,
  run,
} = {}) {
  if (typeof run !== 'function') {
    throw new Error('run is required');
  }

  if (!reporter || typeof reporter.writeError !== 'function') {
    throw new Error('reporter.writeError is required');
  }

  try {
    const result = await run();
    await onSuccess(result);
  } catch (error) {
    if (typeof onError === 'function') {
      await onError(error);
    } else {
      reporter.writeError(error);
    }

    processEmitter.exitCode = 1;
  } finally {
    await cleanup();
  }
}