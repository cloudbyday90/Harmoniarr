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

function normalizeNonNegativeInteger(value) {
  if (value === null || value === undefined || value === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function formatFileCount(value) {
  const fileCount = normalizeNonNegativeInteger(value);
  if (fileCount === null) return 'Not reported';
  return `${fileCount} ${fileCount === 1 ? 'file' : 'files'} found`;
}

function formatFormats(value) {
  const formats = Array.isArray(value)
    ? [...new Set(value
      .map((format) => (typeof format === 'string' ? format.trim().toUpperCase() : ''))
      .filter(Boolean))]
    : [];

  return formats.length > 0 ? formats.join(', ') : 'Not reported';
}

export function formatMissingMusicMatchSize(value) {
  const bytes = normalizeNonNegativeInteger(value);
  if (bytes === null) return 'Not reported';
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length);
  const amount = bytes / (1024 ** unitIndex);
  return `${amount >= 10 || unitIndex === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unitIndex - 1]}`;
}

export function buildMissingMusicMatchChoicePresentation(detail) {
  const choices = Array.isArray(detail?.matchChoices) ? detail.matchChoices : [];
  const isReadOnly = detail?.permissions?.isReadOnly === true;
  const title = typeof detail?.decision?.release?.title === 'string' && detail.decision.release.title.trim()
    ? detail.decision.release.title.trim()
    : 'this release';

  return {
    canSelect: detail?.permissions?.canSelectMatch === true && !isReadOnly,
    choices: choices
      .filter((choice) => typeof choice?.id === 'string' && choice.id.trim())
      .map((choice, index) => ({
        accessibleActionLabel: `Use this match for ${title} — match ${index + 1}`,
        facts: [
          { label: 'Files', value: formatFileCount(choice.fileCount) },
          { label: 'Formats', value: formatFormats(choice.formats) },
          { label: 'Total size', value: formatMissingMusicMatchSize(choice.totalSizeBytes) },
        ],
        id: choice.id,
        label: `Match ${index + 1}`,
      })),
    heading: isReadOnly ? 'Recorded match choices' : 'Choose a match',
    instructions: isReadOnly
      ? 'This disabled account is read-only. These recorded choices cannot be changed.'
      : 'Choose the match that best fits this release. Selecting it records the next download step.',
  };
}
