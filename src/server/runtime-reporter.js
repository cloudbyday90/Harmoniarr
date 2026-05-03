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

export function formatRuntimeErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function createRuntimeReporter({
  prefix,
  stderr = process.stderr,
  stdout = process.stdout,
} = {}) {
  if (!prefix) {
    throw new Error('prefix is required');
  }

  function writeInfo(message) {
    stdout.write(`[${prefix}] ${message}\n`);
  }

  function writeError(error, { label } = {}) {
    const renderedMessage = formatRuntimeErrorMessage(error);
    const message = label ? `${label}: ${renderedMessage}` : renderedMessage;
    stderr.write(`[${prefix}] ${message}\n`);
  }

  function writeWarning(message) {
    stderr.write(`[${prefix}] warning: ${message}\n`);
  }

  return {
    writeError,
    writeInfo,
    writeWarning,
  };
}
