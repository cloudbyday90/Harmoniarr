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

// Pure presentation helpers for the cross-peer collusion report. Free of Vue and
// DOM so the formatting can be unit-tested in isolation.

const FINGERPRINT_PREVIEW_LENGTH = 12;

/**
 * Returns a short, copy-safe preview of a content fingerprint for dense table
 * cells. Non-string or empty inputs collapse to an em dash.
 *
 * @param {string} contentHash
 * @returns {string}
 */
export function formatFingerprintPreview(contentHash) {
  if (typeof contentHash !== 'string' || contentHash.trim().length === 0) {
    return '—';
  }
  const normalized = contentHash.trim();
  if (normalized.length <= FINGERPRINT_PREVIEW_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, FINGERPRINT_PREVIEW_LENGTH)}…`;
}

/**
 * Formats an estimated source bitrate (kbps) for display, or an em dash when
 * unknown.
 *
 * @param {number|null|undefined} estimatedSourceBitrate
 * @returns {string}
 */
export function formatEstimatedBitrate(estimatedSourceBitrate) {
  const parsed = Number(estimatedSourceBitrate);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return '—';
  }
  return `~${Math.round(parsed)} kbps`;
}

/**
 * Builds a human summary line for a collusion ring.
 *
 * @param {{ memberCount?: number, sharedFingerprintCount?: number }} ring
 * @returns {string}
 */
export function formatRingSummary(ring) {
  const members = Number(ring?.memberCount) || 0;
  const shared = Number(ring?.sharedFingerprintCount) || 0;
  const memberLabel = members === 1 ? '1 peer' : `${members} peers`;
  const fpLabel = shared === 1 ? '1 shared fingerprint' : `${shared} shared fingerprints`;
  return `${memberLabel} · ${fpLabel}`;
}

/**
 * Returns a single-line headline for the whole report.
 *
 * @param {{ ringCount?: number, implicatedUserCount?: number, analyzedFingerprintCount?: number }} report
 * @returns {string}
 */
export function formatCollusionHeadline(report) {
  const rings = Number(report?.ringCount) || 0;
  const users = Number(report?.implicatedUserCount) || 0;
  if (rings === 0) {
    return 'No shared fake fingerprints detected across peers.';
  }
  const ringLabel = rings === 1 ? '1 ring' : `${rings} rings`;
  const userLabel = users === 1 ? '1 peer' : `${users} peers`;
  return `${ringLabel} implicating ${userLabel}.`;
}

/**
 * Normalizes the raw report payload into a stable view model. Always returns an
 * array of rings so the template can render without guarding for null.
 *
 * @param {object|null|undefined} report
 * @returns {{ rings: object[], ringCount: number, implicatedUserCount: number, analyzedFingerprintCount: number, headline: string }}
 */
export function buildCollusionViewModel(report) {
  const rings = Array.isArray(report?.rings) ? report.rings : [];
  return {
    rings,
    ringCount: Number(report?.ringCount) || rings.length,
    implicatedUserCount: Number(report?.implicatedUserCount) || 0,
    analyzedFingerprintCount: Number(report?.analyzedFingerprintCount) || 0,
    headline: formatCollusionHeadline(report),
  };
}
