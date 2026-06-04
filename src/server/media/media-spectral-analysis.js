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

// Pure decision layer for fake/transcoded lossless detection. This module
// interprets a measured spectral *cutoff* frequency (the highest frequency that
// still carries real energy, i.e. the brick-wall edge of a lossy encode) and
// decides whether a file that *claims* to be lossless was actually sourced from
// a lossy encode. It performs no IO and no decoding; the heavy FFT measurement
// happens in the ffmpeg analyzer adapter, keeping this logic deterministic and
// unit-testable.
//
// The cutoff thresholds follow the well-established lossy-encoder low-pass map
// used by community fake-FLAC detectors: MP3/AAC encoders apply a brick-wall
// low-pass whose corner frequency tracks bitrate (~16 kHz at 128 kbps, ~19 kHz
// at 192 kbps, ~20 kHz at 256 kbps, ~20.5 kHz at 320 kbps). A genuine 44.1 kHz
// lossless master keeps energy up to ~20-22 kHz, so a lossless-claimed file
// whose energy stops well below Nyquist was almost certainly transcoded.

const MIN_TRUSTWORTHY_SAMPLE_RATE = 44100;

// Default cutoff-band boundary thresholds (Hz). These are the operator-tunable
// knobs promoted to persisted admin settings (`fidelity` namespace): an operator
// can shift the authentic/suspicious/transcoded edges and preview the impact via
// the spectral-threshold simulator before applying. Keeping them in one frozen
// object — rather than inline magic numbers — lets the live classifier, the
// what-if simulator, and the settings layer all agree on a single source of truth.
//
//   authenticMinCutoffHz : at/above => authentic (genuine lossless edge)
//   suspiciousMinCutoffHz: at/above (but below authentic) => suspicious (~256 kbps)
//   transcodeMidCutoffHz : boundary between the two transcoded tiers (~192 vs ~128 kbps)
//   minTrustworthySampleRate: below this the Nyquist limit constrains the cutoff,
//     so a low measurement is expected and never penalised.
export const DEFAULT_SPECTRAL_THRESHOLDS = Object.freeze({
  authenticMinCutoffHz: 20000,
  suspiciousMinCutoffHz: 19000,
  transcodeMidCutoffHz: 16000,
  minTrustworthySampleRate: MIN_TRUSTWORTHY_SAMPLE_RATE,
});

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampCutoffHz(value, fallback) {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed <= 0 || parsed > 96000) {
    return fallback;
  }
  return parsed;
}

/**
 * Normalises a (possibly partial / operator-supplied) threshold object into a
 * complete, monotonically ordered set. Invalid or inverted inputs fall back to
 * the defaults so the live classifier can never be wedged into an impossible
 * configuration (e.g. suspicious edge above the authentic edge).
 *
 * @param {object} [input]
 * @returns {{ authenticMinCutoffHz: number, suspiciousMinCutoffHz: number, transcodeMidCutoffHz: number, minTrustworthySampleRate: number }}
 */
export function resolveSpectralThresholds(input) {
  const provided = input && typeof input === 'object' ? input : {};

  const authenticMinCutoffHz = clampCutoffHz(
    provided.authenticMinCutoffHz,
    DEFAULT_SPECTRAL_THRESHOLDS.authenticMinCutoffHz,
  );
  let suspiciousMinCutoffHz = clampCutoffHz(
    provided.suspiciousMinCutoffHz,
    DEFAULT_SPECTRAL_THRESHOLDS.suspiciousMinCutoffHz,
  );
  let transcodeMidCutoffHz = clampCutoffHz(
    provided.transcodeMidCutoffHz,
    DEFAULT_SPECTRAL_THRESHOLDS.transcodeMidCutoffHz,
  );

  // Enforce authentic >= suspicious >= transcodeMid. An inverted edge collapses
  // a tier rather than producing nonsense, but never crosses over.
  if (suspiciousMinCutoffHz > authenticMinCutoffHz) {
    suspiciousMinCutoffHz = authenticMinCutoffHz;
  }
  if (transcodeMidCutoffHz > suspiciousMinCutoffHz) {
    transcodeMidCutoffHz = suspiciousMinCutoffHz;
  }

  const minSampleRate = toFiniteNumber(provided.minTrustworthySampleRate);

  return {
    authenticMinCutoffHz,
    suspiciousMinCutoffHz,
    transcodeMidCutoffHz,
    minTrustworthySampleRate: minSampleRate !== null && minSampleRate > 0
      ? minSampleRate
      : DEFAULT_SPECTRAL_THRESHOLDS.minTrustworthySampleRate,
  };
}

/**
 * Builds the ordered cutoff -> verdict bands from a resolved threshold set. The
 * delivered quality `weight` and `estimatedSourceBitrate` are tied to the verdict
 * tier (not the boundary), so only the band edges move when thresholds change.
 *
 * @param {object} [thresholds]
 * @returns {Array<{ maxCutoffHz: number, minCutoffHz: number, verdict: string, weight: number, estimatedSourceBitrate: number | null }>}
 */
export function buildCutoffBands(thresholds = DEFAULT_SPECTRAL_THRESHOLDS) {
  const resolved = resolveSpectralThresholds(thresholds);
  return [
    { maxCutoffHz: Infinity, minCutoffHz: resolved.authenticMinCutoffHz, verdict: 'authentic', weight: 1, estimatedSourceBitrate: null },
    { maxCutoffHz: resolved.authenticMinCutoffHz, minCutoffHz: resolved.suspiciousMinCutoffHz, verdict: 'suspicious', weight: 0.35, estimatedSourceBitrate: 256 },
    { maxCutoffHz: resolved.suspiciousMinCutoffHz, minCutoffHz: resolved.transcodeMidCutoffHz, verdict: 'transcoded', weight: 0.15, estimatedSourceBitrate: 192 },
    { maxCutoffHz: resolved.transcodeMidCutoffHz, minCutoffHz: 0, verdict: 'transcoded', weight: 0.05, estimatedSourceBitrate: 128 },
  ];
}

function selectBand(cutoffHz, bands) {
  return bands.find((band) => cutoffHz >= band.minCutoffHz && cutoffHz < band.maxCutoffHz)
    ?? bands[bands.length - 1];
}

/**
 * Classifies a measured spectral cutoff into a transcode verdict.
 *
 * @param {object} input
 * @param {number} input.cutoffHz - Highest frequency (Hz) carrying real energy
 *   (the max spectral rolloff across analysed frames).
 * @param {number} [input.sampleRate] - Declared sample rate (Hz).
 * @param {boolean} [input.declaredLossless] - Whether the file claims a lossless codec.
 * @param {object} [input.thresholds] - Operator-tuned cutoff thresholds (partial;
 *   missing/invalid keys fall back to DEFAULT_SPECTRAL_THRESHOLDS).
 * @returns {{
 *   verdict: 'authentic' | 'suspicious' | 'transcoded' | 'inconclusive',
 *   confidence: number,
 *   qualityWeight: number,
 *   estimatedSourceBitrate: number | null,
 *   cutoffHz: number | null,
 *   nyquistHz: number | null,
 *   reason: string,
 *   penalize: boolean
 * }}
 */
export function classifySpectralCutoff({ cutoffHz, sampleRate = null, declaredLossless = true, thresholds } = {}) {
  const resolvedThresholds = resolveSpectralThresholds(thresholds);
  const normalizedCutoff = toFiniteNumber(cutoffHz);
  const normalizedSampleRate = toFiniteNumber(sampleRate);
  const nyquistHz = normalizedSampleRate && normalizedSampleRate > 0 ? normalizedSampleRate / 2 : null;

  if (normalizedCutoff === null || normalizedCutoff <= 0) {
    return {
      verdict: 'inconclusive',
      confidence: 0,
      qualityWeight: 1,
      estimatedSourceBitrate: null,
      cutoffHz: null,
      nyquistHz,
      reason: 'No usable spectral cutoff measurement was available.',
      penalize: false,
    };
  }

  // Only lossless-claimed files are policed: a lossy file legitimately has a low
  // cutoff and must not be penalised for being what it says it is.
  if (declaredLossless !== true) {
    return {
      verdict: 'inconclusive',
      confidence: 0,
      qualityWeight: 1,
      estimatedSourceBitrate: null,
      cutoffHz: Math.round(normalizedCutoff),
      nyquistHz,
      reason: 'File does not claim a lossless codec; spectral cutoff is not a fidelity signal.',
      penalize: false,
    };
  }

  // Below the trustworthy sample-rate floor the Nyquist limit itself constrains
  // the cutoff, so a low measurement is expected and not evidence of transcoding.
  if (normalizedSampleRate !== null && normalizedSampleRate < resolvedThresholds.minTrustworthySampleRate) {
    return {
      verdict: 'inconclusive',
      confidence: 0,
      qualityWeight: 1,
      estimatedSourceBitrate: null,
      cutoffHz: Math.round(normalizedCutoff),
      nyquistHz,
      reason: `Sample rate ${normalizedSampleRate} Hz is below the ${resolvedThresholds.minTrustworthySampleRate} Hz threshold required for a reliable cutoff verdict.`,
      penalize: false,
    };
  }

  const band = selectBand(normalizedCutoff, buildCutoffBands(resolvedThresholds));
  const roundedCutoff = Math.round(normalizedCutoff);

  if (band.verdict === 'authentic') {
    return {
      verdict: 'authentic',
      confidence: 0.9,
      qualityWeight: 1,
      estimatedSourceBitrate: null,
      cutoffHz: roundedCutoff,
      nyquistHz,
      reason: `Energy extends to ${roundedCutoff} Hz, consistent with a genuine lossless source.`,
      penalize: false,
    };
  }

  // Confidence grows the further the cutoff sits below the genuine-lossless edge.
  const authenticEdge = resolvedThresholds.authenticMinCutoffHz;
  const confidence = band.verdict === 'transcoded'
    ? Math.min(0.99, 0.6 + Math.max(0, authenticEdge - normalizedCutoff) / authenticEdge)
    : 0.5;

  return {
    verdict: band.verdict,
    confidence: Number(confidence.toFixed(2)),
    qualityWeight: band.weight,
    estimatedSourceBitrate: band.estimatedSourceBitrate,
    cutoffHz: roundedCutoff,
    nyquistHz,
    reason: `Lossless-claimed file cuts off at ${roundedCutoff} Hz`
      + (band.estimatedSourceBitrate ? `, consistent with an ~${band.estimatedSourceBitrate} kbps lossy source.` : '.'),
    penalize: band.verdict === 'transcoded',
  };
}

/**
 * Reduces a list of per-frame rolloff measurements (Hz) to a single brick-wall
 * cutoff estimate. The 85% spectral rolloff is energy-concentration biased and
 * dips low on bass-heavy passages, so the *maximum* across frames (the
 * brightest moment, e.g. a cymbal hit) is the robust ceiling: a true lossy
 * source can never exceed its low-pass corner in any frame.
 *
 * @param {number[]} rolloffSamples
 * @returns {number | null}
 */
export function estimateCutoffFromRolloffSamples(rolloffSamples) {
  if (!Array.isArray(rolloffSamples)) {
    return null;
  }

  let max = null;
  for (const sample of rolloffSamples) {
    const value = toFiniteNumber(sample);
    if (value !== null && value > 0 && (max === null || value > max)) {
      max = value;
    }
  }

  return max;
}

export const LOSSLESS_CODECS = Object.freeze(['flac', 'alac', 'wav', 'ape', 'wavpack', 'tak', 'tta', 'aiff', 'pcm_s16le', 'pcm_s24le']);

/**
 * Determines whether a declared codec/extension pair claims lossless quality.
 *
 * @param {object} input
 * @param {string} [input.codec]
 * @param {string} [input.extension]
 * @returns {boolean}
 */
export function isDeclaredLossless({ codec = null, extension = null } = {}) {
  const normalizedCodec = typeof codec === 'string' ? codec.trim().toLowerCase() : '';
  const normalizedExtension = typeof extension === 'string'
    ? extension.trim().toLowerCase().replace(/^\./, '')
    : '';

  if (normalizedCodec && LOSSLESS_CODECS.some((entry) => normalizedCodec.includes(entry))) {
    return true;
  }

  return LOSSLESS_CODECS.includes(normalizedExtension);
}
