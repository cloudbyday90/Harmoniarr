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

const remapReviewStatuses = new Set(['review_needed', 'orphaned']);

export function normalizeTrackOverrideRemapStatus(status) {
  return typeof status === 'string' && status.trim().length > 0
    ? status.trim().toLowerCase()
    : 'resolved';
}

export function isTrackOverrideRemapReviewStatus(status) {
  return remapReviewStatuses.has(normalizeTrackOverrideRemapStatus(status));
}

export function summarizeTrackOverrideRemapReview(trackOverrides = []) {
  const overrides = Array.isArray(trackOverrides) ? trackOverrides : [];
  const reviewNeededCount = overrides.filter(
    (override) => normalizeTrackOverrideRemapStatus(override?.remapStatus) === 'review_needed',
  ).length;
  const orphanedCount = overrides.filter(
    (override) => normalizeTrackOverrideRemapStatus(override?.remapStatus) === 'orphaned',
  ).length;

  return {
    hasReview: reviewNeededCount + orphanedCount > 0,
    orphanedCount,
    reviewNeededCount,
    totalReviewCount: reviewNeededCount + orphanedCount,
  };
}

export function getTrackOverrideRemapStatusTone(status) {
  const normalizedStatus = normalizeTrackOverrideRemapStatus(status);
  if (normalizedStatus === 'orphaned') return 'danger';
  if (normalizedStatus === 'review_needed') return 'warning';
  return 'info';
}

export function getTrackOverrideRemapReviewPresentation(status) {
  const normalizedStatus = normalizeTrackOverrideRemapStatus(status);

  if (normalizedStatus === 'review_needed') {
    return {
      description: 'Saved override may need remapping after metadata changed.',
      label: 'Needs review',
      tone: 'warning',
    };
  }

  if (normalizedStatus === 'orphaned') {
    return {
      description: 'Saved override no longer matches a current track.',
      label: 'No current track match',
      tone: 'danger',
    };
  }

  return null;
}

export function getTrackOverrideRemapReviewSummaryTone(summary = {}) {
  return Number(summary.orphanedCount ?? 0) > 0 ? 'danger' : 'warning';
}

export function buildTrackOverrideRemapReviewSummaryText(summary = {}) {
  const reviewNeededCount = Number(summary.reviewNeededCount ?? 0);
  const orphanedCount = Number(summary.orphanedCount ?? 0);
  const totalReviewCount = reviewNeededCount + orphanedCount;

  if (totalReviewCount <= 0) {
    return 'No track override review needed';
  }

  if (reviewNeededCount > 0 && orphanedCount > 0) {
    return `${totalReviewCount} track overrides need review`;
  }

  if (orphanedCount > 0) {
    return `${orphanedCount} track override${orphanedCount === 1 ? '' : 's'} need a current track match`;
  }

  return `${reviewNeededCount} track override${reviewNeededCount === 1 ? ' needs' : 's need'} review`;
}
