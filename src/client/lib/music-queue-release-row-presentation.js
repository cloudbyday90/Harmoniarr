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

const QUALITY_ATTENTION_CODES = new Set([
  'below_minimum',
  'needs_verification',
]);

function getCount(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatTrackProgress(release = {}) {
  const expected = getCount(release.expectedTrackCount);
  const matched = getCount(release.matchedTrackCount);
  const missing = getCount(release.missingTrackCount);

  if (missing > 0) {
    return `${missing} track${missing === 1 ? '' : 's'} still missing`;
  }

  if (expected > 0 && matched >= expected) {
    return `All ${expected} track${expected === 1 ? '' : 's'} matched`;
  }

  if (expected > 0 && matched > 0) {
    return `${matched} of ${expected} tracks matched`;
  }

  return release.matchSummary?.label ?? 'Waiting for match evidence';
}

/**
 * Builds the compact, outcome-first facts displayed in a Music Queue release
 * row. The release's full quality and match evidence remains in the details
 * panel, so normal queue scanning never exposes provider diagnostics.
 *
 * @param {object} release
 * @returns {{ facts: Array<{key: string, label: string, tone: string}>, qualityNeedsAttention: boolean, statusTone: string, updatedLabel: string }}
 */
export function buildMusicQueueReleaseRowPresentation(release = {}) {
  const quality = release.qualitySummary ?? {};
  const statusCode = release.statusCode ?? release.status?.code ?? null;
  const qualityNeedsAttention = statusCode === 'quality_choice_needed'
    || QUALITY_ATTENTION_CODES.has(quality.code);
  const qualityLabel = qualityNeedsAttention
    ? `Quality: ${release.qualityDecisionLabel ?? 'Quality choice needed'}`
    : `Quality profile: ${release.qualityProfileLabel ?? 'Not set'}`;

  return {
    facts: [
      { key: 'progress', label: formatTrackProgress(release), tone: 'neutral' },
      {
        key: 'quality',
        label: qualityLabel,
        tone: qualityNeedsAttention ? (quality.tone ?? 'warning') : 'neutral',
      },
    ],
    qualityNeedsAttention,
    statusTone: release.status?.tone ?? 'neutral',
    updatedLabel: release.lastActivityLabel === 'No activity yet'
      ? 'Not updated yet'
      : `Updated ${release.lastActivityLabel}`,
  };
}
