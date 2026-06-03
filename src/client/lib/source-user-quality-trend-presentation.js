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

// Pure presentation helpers for the per-peer delivered-quality trend sparkline.
// Kept free of Vue and DOM so the geometry and label logic are unit-testable in
// isolation. All quality weights are expected on the [0, 1] unit interval.

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 40;
const DEFAULT_PADDING = 3;

function clampUnit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed > 1 ? 1 : parsed;
}

function roundTo(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Builds an SVG polyline `d` attribute mapping a series of quality weights to a
 * sparkline. The series reads left (oldest) to right (newest); higher quality is
 * drawn higher (y is inverted). Returns an empty string when there is nothing to
 * draw.
 *
 * @param {object} input
 * @param {Array<{ qualityWeight?: number }>} input.series
 * @param {number} [input.width]
 * @param {number} [input.height]
 * @param {number} [input.padding]
 * @returns {string}
 */
export function buildSparklinePath({
  series,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  padding = DEFAULT_PADDING,
} = {}) {
  if (!Array.isArray(series) || series.length === 0) {
    return '';
  }

  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);

  if (series.length === 1) {
    const y = padding + (1 - clampUnit(series[0]?.qualityWeight)) * innerHeight;
    return `M ${roundTo(padding)},${roundTo(y)} L ${roundTo(padding + innerWidth)},${roundTo(y)}`;
  }

  const step = innerWidth / (series.length - 1);
  return series
    .map((point, index) => {
      const x = padding + step * index;
      const y = padding + (1 - clampUnit(point?.qualityWeight)) * innerHeight;
      return `${index === 0 ? 'M' : 'L'} ${roundTo(x)},${roundTo(y)}`;
    })
    .join(' ');
}

/**
 * Builds the coordinates for the most-recent point marker, or null when the
 * series is empty.
 */
export function buildSparklineEndpoint({
  series,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  padding = DEFAULT_PADDING,
} = {}) {
  if (!Array.isArray(series) || series.length === 0) {
    return null;
  }

  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);
  const last = series[series.length - 1];
  const x = series.length === 1 ? padding + innerWidth / 2 : padding + innerWidth;
  const y = padding + (1 - clampUnit(last?.qualityWeight)) * innerHeight;
  return { x: roundTo(x), y: roundTo(y) };
}

const TREND_LABELS = Object.freeze({
  degrading: 'Degrading',
  improving: 'Improving',
  insufficient: 'Not enough data',
  stable: 'Stable',
});

const TREND_TONES = Object.freeze({
  degrading: 'danger',
  improving: 'success',
  insufficient: 'neutral',
  stable: 'info',
});

export function formatTrendLabel(trendDirection) {
  return TREND_LABELS[trendDirection] ?? 'Unknown';
}

export function formatTrendTone(trendDirection) {
  return TREND_TONES[trendDirection] ?? 'neutral';
}

/**
 * Produces a short operator-facing characterisation of the peer's quality
 * pattern, distinguishing "degraded recently" from "always poor".
 */
export function formatTrendCharacterization(trend) {
  if (!trend || typeof trend !== 'object') {
    return null;
  }
  if (trend.sampleCount === 0) {
    return 'No delivered-quality evidence recorded yet.';
  }
  if (trend.degradedRecently) {
    return 'Recently degraded — this peer used to deliver clean files but recent deliveries are poor.';
  }
  if (trend.alwaysPoor) {
    return 'Consistently poor — this peer has delivered low-quality files across its history.';
  }
  if (trend.trendDirection === 'improving') {
    return 'Improving — recent deliveries are better than this peer\u2019s earlier history.';
  }
  if (trend.trendDirection === 'stable') {
    return 'Stable — delivered quality has held steady.';
  }
  return 'Not enough recent evidence to characterise a trend.';
}

export function formatQualityAverage(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return '—';
  }
  return `${Math.round(clampUnit(value) * 100)}%`;
}

const SIGNAL_LABELS = Object.freeze({
  codec_extension_mismatch: 'Codec/extension mismatch',
  incomplete_tags: 'Incomplete tags',
  lossless_low_bitrate: 'Lossless under-bitrate',
  low_bitrate: 'Low bitrate',
  spectral_transcode_confirmed: 'Spectral transcode confirmed',
});

export function formatSignalLabel(label) {
  if (typeof label !== 'string' || label.length === 0) {
    return 'Unknown signal';
  }
  return SIGNAL_LABELS[label]
    ?? label.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}
