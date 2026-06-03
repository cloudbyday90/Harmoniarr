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

// Cutoff (Hz) -> verdict bands. Ordered high to low. `weight` is the delivered
// quality weight merged back into the reputation ledger when the band confirms
// a transcode (lower = worse). Bands at/above AUTHENTIC are not penalised.
const CUTOFF_BANDS = [
  { maxCutoffHz: Infinity, minCutoffHz: 20000, verdict: 'authentic', weight: 1, estimatedSourceBitrate: null },
  { maxCutoffHz: 20000, minCutoffHz: 19000, verdict: 'suspicious', weight: 0.35, estimatedSourceBitrate: 256 },
  { maxCutoffHz: 19000, minCutoffHz: 16000, verdict: 'transcoded', weight: 0.15, estimatedSourceBitrate: 192 },
  { maxCutoffHz: 16000, minCutoffHz: 0, verdict: 'transcoded', weight: 0.05, estimatedSourceBitrate: 128 },
];

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function selectBand(cutoffHz) {
  return CUTOFF_BANDS.find((band) => cutoffHz >= band.minCutoffHz && cutoffHz < band.maxCutoffHz)
    ?? CUTOFF_BANDS[CUTOFF_BANDS.length - 1];
}

/**
 * Classifies a measured spectral cutoff into a transcode verdict.
 *
 * @param {object} input
 * @param {number} input.cutoffHz - Highest frequency (Hz) carrying real energy
 *   (the max spectral rolloff across analysed frames).
 * @param {number} [input.sampleRate] - Declared sample rate (Hz).
 * @param {boolean} [input.declaredLossless] - Whether the file claims a lossless codec.
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
export function classifySpectralCutoff({ cutoffHz, sampleRate = null, declaredLossless = true } = {}) {
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

  // Below 44.1 kHz the Nyquist limit itself constrains the cutoff, so a low
  // measurement is expected and not evidence of transcoding.
  if (normalizedSampleRate !== null && normalizedSampleRate < MIN_TRUSTWORTHY_SAMPLE_RATE) {
    return {
      verdict: 'inconclusive',
      confidence: 0,
      qualityWeight: 1,
      estimatedSourceBitrate: null,
      cutoffHz: Math.round(normalizedCutoff),
      nyquistHz,
      reason: `Sample rate ${normalizedSampleRate} Hz is below the ${MIN_TRUSTWORTHY_SAMPLE_RATE} Hz threshold required for a reliable cutoff verdict.`,
      penalize: false,
    };
  }

  const band = selectBand(normalizedCutoff);
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
  const confidence = band.verdict === 'transcoded'
    ? Math.min(0.99, 0.6 + (20000 - normalizedCutoff) / 20000)
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
