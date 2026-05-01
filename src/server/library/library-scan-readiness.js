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

function buildBlockedReadiness(message) {
  return {
    status: 'blocked',
    message,
  };
}

export function buildLibraryScanContext(settingsPayload) {
  const libraryRoot = settingsPayload.settings?.paths?.music ?? null;
  const pathValidationStatus = settingsPayload.pathValidation?.summary?.status ?? 'blocked';

  if (!libraryRoot) {
    return {
      libraryRoot: null,
      readiness: buildBlockedReadiness('Configure a music library root before running a library scan.'),
    };
  }

  if (pathValidationStatus !== 'healthy') {
    return {
      libraryRoot,
      readiness: buildBlockedReadiness('Resolve shared path validation issues before running a library scan.'),
    };
  }

  return {
    libraryRoot,
    readiness: {
      status: 'ready',
      message: 'Shared library and staging paths are ready for the first library scan.',
    },
  };
}