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

import {
  classifySpectralCutoff,
  isDeclaredLossless,
} from './media-spectral-analysis.js';

function normalizeToken(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizePath(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildResult({
  accepted,
  code,
  contentHash = null,
  measuredFrom = null,
  message,
  required = true,
  spectral = null,
}) {
  return {
    accepted,
    code,
    contentHash,
    measuredFrom,
    message,
    required,
    spectral,
  };
}

export function createMediaSpectralProofService({
  analyzeSpectralCutoffFn = null,
  classifySpectralCutoffFn = classifySpectralCutoff,
  hashFileFn = null,
  loadSpectralThresholdsFn = null,
  onWarning = () => {},
  spectralCacheStore = null,
  strictAcceptsInconclusive = false,
} = {}) {
  async function loadThresholds() {
    if (typeof loadSpectralThresholdsFn !== 'function') {
      return undefined;
    }

    try {
      const thresholds = await loadSpectralThresholdsFn();
      return thresholds && typeof thresholds === 'object' ? thresholds : undefined;
    } catch (error) {
      onWarning('Failed to load spectral thresholds for pre-add proof', error);
      return undefined;
    }
  }

  async function readCachedMeasurement({ contentHash }) {
    if (!contentHash || !spectralCacheStore || typeof spectralCacheStore.getCachedMeasurement !== 'function') {
      return null;
    }

    try {
      return await spectralCacheStore.getCachedMeasurement({ contentHash });
    } catch (error) {
      onWarning('Failed to read cached spectral measurement for pre-add proof', error);
      return null;
    }
  }

  async function writeCachedMeasurement({ contentHash, measurement }) {
    if (!contentHash || !spectralCacheStore || typeof spectralCacheStore.putCachedMeasurement !== 'function') {
      return null;
    }

    try {
      return await spectralCacheStore.putCachedMeasurement({
        contentHash,
        cutoffHz: measurement?.cutoffHz ?? null,
        durationMs: measurement?.durationMs ?? null,
        frameCount: measurement?.frameCount ?? 0,
      });
    } catch (error) {
      onWarning('Failed to write cached spectral measurement for pre-add proof', error);
      return null;
    }
  }

  function classifyMeasurement({ measurement, sampleRate, declaredCodec, declaredExtension, thresholds }) {
    return classifySpectralCutoffFn({
      cutoffHz: measurement?.cutoffHz ?? null,
      declaredLossless: isDeclaredLossless({
        codec: declaredCodec,
        extension: declaredExtension,
      }),
      sampleRate,
      thresholds,
    });
  }

  function buildClassificationResult({ classification, contentHash, measuredFrom }) {
    if (classification.verdict === 'authentic') {
      return buildResult({
        accepted: true,
        code: 'spectral_authentic',
        contentHash,
        measuredFrom,
        message: classification.reason,
        spectral: classification,
      });
    }

    if (classification.verdict === 'inconclusive' && strictAcceptsInconclusive) {
      return buildResult({
        accepted: true,
        code: 'spectral_inconclusive_accepted',
        contentHash,
        measuredFrom,
        message: classification.reason,
        spectral: classification,
      });
    }

    return buildResult({
      accepted: false,
      code: `spectral_${classification.verdict}`,
      contentHash,
      measuredFrom,
      message: classification.reason,
      spectral: classification,
    });
  }

  async function verifySpectralProof({
    declaredCodec = null,
    declaredExtension = null,
    filePath = null,
    sampleRate = null,
    sizeBytes = null,
  } = {}) {
    if (!isDeclaredLossless({ codec: declaredCodec, extension: declaredExtension })) {
      return buildResult({
        accepted: true,
        code: 'spectral_not_required',
        message: 'Spectral proof is not required for files that do not claim lossless quality.',
        required: false,
      });
    }

    const normalizedPath = normalizePath(filePath);
    if (!normalizedPath) {
      return buildResult({
        accepted: false,
        code: 'spectral_file_path_missing',
        message: 'No file path is available for pre-add spectral verification.',
      });
    }

    if (typeof hashFileFn !== 'function') {
      return buildResult({
        accepted: false,
        code: 'spectral_fingerprint_unavailable',
        message: 'Content fingerprinting is unavailable for pre-add spectral verification.',
      });
    }

    let contentHash;
    try {
      contentHash = await hashFileFn({ filePath: normalizedPath, sizeBytes });
    } catch (error) {
      onWarning('Failed to fingerprint file for pre-add spectral proof', error);
      return buildResult({
        accepted: false,
        code: 'spectral_fingerprint_failed',
        message: 'Harmoniarr could not fingerprint this file before adding it to the library.',
      });
    }

    const normalizedHash = normalizeToken(contentHash);
    if (!normalizedHash) {
      return buildResult({
        accepted: false,
        code: 'spectral_fingerprint_failed',
        message: 'Harmoniarr could not derive a usable content fingerprint for this file.',
      });
    }

    const thresholds = await loadThresholds();
    const cached = await readCachedMeasurement({ contentHash: normalizedHash });
    if (cached) {
      const classification = classifyMeasurement({
        declaredCodec,
        declaredExtension,
        measurement: cached,
        sampleRate,
        thresholds,
      });
      return buildClassificationResult({
        classification,
        contentHash: normalizedHash,
        measuredFrom: 'cache',
      });
    }

    if (typeof analyzeSpectralCutoffFn !== 'function') {
      return buildResult({
        accepted: false,
        code: 'spectral_no_cached_proof',
        contentHash: normalizedHash,
        message: 'No cached spectral proof exists for this file yet.',
      });
    }

    let measurement;
    try {
      measurement = await analyzeSpectralCutoffFn({ filePath: normalizedPath });
    } catch (error) {
      onWarning('Failed to analyze file for pre-add spectral proof', error);
      return buildResult({
        accepted: false,
        code: 'spectral_analysis_failed',
        contentHash: normalizedHash,
        message: 'Harmoniarr could not complete spectral verification before adding this file.',
      });
    }

    await writeCachedMeasurement({ contentHash: normalizedHash, measurement });
    const classification = classifyMeasurement({
      declaredCodec,
      declaredExtension,
      measurement,
      sampleRate,
      thresholds,
    });
    return buildClassificationResult({
      classification,
      contentHash: normalizedHash,
      measuredFrom: 'analysis',
    });
  }

  return {
    verifySpectralProof,
  };
}

