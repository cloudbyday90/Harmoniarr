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

// Orchestrates the spectral-cutoff DSP sidecar: the queue producer (run off the
// synchronous apply path) and the bounded consumer that performs the heavy FFT
// analysis and merges confirmed transcodes back into the reputation ledger.
//
// Producer: `enqueueForAppliedCandidate` is called best-effort right after a
// candidate is applied. It only enqueues files that *claim* lossless quality
// (the only files a spectral cutoff can incriminate) and silently honours queue
// back-pressure, so a saturated analyzer can never stall an apply run.
//
// Consumer (result-merge contract): `processPendingSpectralJobs` claims a
// bounded batch, measures each file's cutoff, classifies it, and when a
// lossless-claimed file is confirmed to be a low-bitrate transcode it records a
// `spectral_transcode_confirmed` failure outcome (with the classifier's low
// delivered-quality weight) against the originating source user. Every job
// reaches a terminal/retry state; the consumer never throws.

import {
  classifySpectralCutoff,
  isDeclaredLossless,
} from '../media/media-spectral-analysis.js';

const DEFAULT_PROCESS_LIMIT = 4;
const MIN_TRUSTWORTHY_SAMPLE_RATE = 44100;

function normalizePositiveInteger(value) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * @param {object} deps
 * @param {object} deps.spectralJobStore - Created by createSourceUserSpectralJobStore.
 * @param {(input: { filePath: string }) => Promise<{ cutoffHz: number | null, frameCount: number }>} deps.analyzeSpectralCutoffFn
 * @param {Function} [deps.recordSourceUserOutcomeEvidenceFn] - Merge sink for confirmed transcodes.
 * @param {Function} [deps.classifySpectralCutoffFn]
 * @param {() => Promise<object>} [deps.loadSpectralThresholdsFn] - Best-effort loader
 *   for the persisted operator-tuned cutoff thresholds. Resolved once per batch
 *   and passed to the classifier; failures fall back to the shipping defaults.
 * @param {number} [deps.maxAttempts]
 * @param {(message: string, error?: Error) => void} [deps.onWarning]
 */
export function createSourceUserSpectralSidecarService({
  spectralJobStore,
  analyzeSpectralCutoffFn,
  recordSourceUserOutcomeEvidenceFn = async () => null,
  classifySpectralCutoffFn = classifySpectralCutoff,
  spectralCacheStore = null,
  hashFileFn = null,
  loadSpectralThresholdsFn = null,
  maxAttempts = 3,
  onWarning = () => {},
} = {}) {
  if (!spectralJobStore || typeof spectralJobStore.enqueueSpectralJob !== 'function') {
    throw new Error('createSourceUserSpectralSidecarService requires a spectralJobStore');
  }
  if (typeof analyzeSpectralCutoffFn !== 'function') {
    throw new Error('createSourceUserSpectralSidecarService requires analyzeSpectralCutoffFn');
  }

  const attemptCap = normalizePositiveInteger(maxAttempts) ?? 3;

  function shouldAnalyze(file) {
    if (!file || typeof file.filePath !== 'string' || file.filePath.trim().length === 0) {
      return false;
    }
    if (!isDeclaredLossless({ codec: file.declaredCodec, extension: file.declaredExtension })) {
      return false;
    }
    // Skip only when the sample rate is known and below the reliable-cutoff
    // threshold; unknown sample rates are still worth analysing.
    const sampleRate = Number(file.sampleRate);
    if (Number.isFinite(sampleRate) && sampleRate > 0 && sampleRate < MIN_TRUSTWORTHY_SAMPLE_RATE) {
      return false;
    }
    return true;
  }

  /**
   * Best-effort producer. Enqueues lossless-claimed applied files for off-path
   * analysis. Never throws; queue back-pressure and per-file errors are absorbed.
   *
   * @returns {Promise<{ enqueued: number, skipped: number, rejected: number }>}
   */
  async function enqueueForAppliedCandidate({ files = [], username, importCandidateId = null } = {}) {
    const summary = { enqueued: 0, skipped: 0, rejected: 0 };

    if (typeof username !== 'string' || username.trim().length === 0 || !Array.isArray(files)) {
      return summary;
    }

    for (const file of files) {
      if (!shouldAnalyze(file)) {
        summary.skipped += 1;
        continue;
      }

      try {
        const result = await spectralJobStore.enqueueSpectralJob({
          username,
          importCandidateId,
          filePath: file.filePath,
          declaredCodec: file.declaredCodec ?? null,
          declaredExtension: file.declaredExtension ?? null,
          sampleRate: file.sampleRate ?? null,
          bitRate: file.bitRate ?? null,
        });
        if (result.enqueued) {
          summary.enqueued += 1;
        } else {
          summary.rejected += 1;
        }
      } catch (error) {
        summary.rejected += 1;
        onWarning('Failed to enqueue spectral analysis job', error);
      }
    }

    return summary;
  }

  async function mergeConfirmedTranscode({ job, classification }) {
    try {
      await recordSourceUserOutcomeEvidenceFn({
        eventType: 'spectral_analysis',
        outcome: 'failure',
        qualityLabel: 'spectral_transcode_confirmed',
        qualityWeight: classification.qualityWeight,
        reason: classification.reason,
        username: job.username,
      });
    } catch (error) {
      onWarning('Failed to merge confirmed transcode into reputation ledger', error);
    }
  }

  /**
   * Bounded consumer. Claims and processes up to `limit` pending jobs.
   *
   * @returns {Promise<{
   *   claimed: number, analyzed: number, transcodedConfirmed: number,
   *   suspicious: number, authentic: number, inconclusive: number, failed: number
   * }>}
   */
  async function processPendingSpectralJobs({ limit = DEFAULT_PROCESS_LIMIT } = {}) {
    const summary = {
      claimed: 0,
      analyzed: 0,
      cacheHits: 0,
      transcodedConfirmed: 0,
      suspicious: 0,
      authentic: 0,
      inconclusive: 0,
      failed: 0,
    };

    let jobs;
    try {
      jobs = await spectralJobStore.claimNextSpectralJobs({ limit });
    } catch (error) {
      onWarning('Failed to claim spectral analysis jobs', error);
      return summary;
    }

    summary.claimed = jobs.length;

    // Resolve the operator-tuned thresholds once for the whole batch so every
    // job is graded under a single consistent policy. Best-effort: a loader
    // failure falls through to the classifier's built-in defaults.
    let spectralThresholds;
    if (typeof loadSpectralThresholdsFn === 'function') {
      try {
        const loaded = await loadSpectralThresholdsFn();
        if (loaded && typeof loaded === 'object') {
          spectralThresholds = loaded;
        }
      } catch (error) {
        onWarning('Failed to load spectral thresholds; using defaults', error);
      }
    }

    for (const job of jobs) {
      // Derive the content fingerprint first so an identical file already
      // measured (by any peer or library copy) reuses the cached measurement and
      // skips the expensive ffmpeg decode. Fingerprinting is best-effort: an IO
      // error simply falls through to a normal decode.
      let contentHash = job.contentHash ?? null;
      if (!contentHash && typeof hashFileFn === 'function') {
        try {
          contentHash = await hashFileFn({ filePath: job.filePath });
        } catch (error) {
          contentHash = null;
          onWarning('Failed to fingerprint file for spectral cache', error);
        }
      }

      let measurement = null;
      let servedFromCache = false;
      if (contentHash && spectralCacheStore && typeof spectralCacheStore.getCachedMeasurement === 'function') {
        try {
          const cached = await spectralCacheStore.getCachedMeasurement({ contentHash });
          if (cached) {
            measurement = { cutoffHz: cached.cutoffHz, frameCount: cached.frameCount };
            servedFromCache = true;
            summary.cacheHits += 1;
          }
        } catch (error) {
          onWarning('Failed to read spectral cache', error);
        }
      }

      if (!servedFromCache) {
        try {
          measurement = await analyzeSpectralCutoffFn({ filePath: job.filePath });
        } catch (error) {
          summary.failed += 1;
          try {
            await spectralJobStore.failSpectralJob({
              id: job.id,
              error: error?.message ?? 'spectral analysis failed',
              maxAttempts: attemptCap,
            });
          } catch (failError) {
            onWarning('Failed to record spectral analysis failure', failError);
          }
          continue;
        }

        if (contentHash && spectralCacheStore && typeof spectralCacheStore.putCachedMeasurement === 'function') {
          try {
            await spectralCacheStore.putCachedMeasurement({
              contentHash,
              cutoffHz: measurement?.cutoffHz ?? null,
              frameCount: measurement?.frameCount ?? 0,
              durationMs: measurement?.durationMs ?? null,
            });
          } catch (error) {
            onWarning('Failed to write spectral cache', error);
          }
        }
      }

      const classification = classifySpectralCutoffFn({
        cutoffHz: measurement?.cutoffHz ?? null,
        sampleRate: job.sampleRate,
        declaredLossless: isDeclaredLossless({ codec: job.declaredCodec, extension: job.declaredExtension }),
        thresholds: spectralThresholds,
      });

      summary.analyzed += 1;
      if (classification.verdict === 'transcoded') {
        summary.transcodedConfirmed += 1;
      } else if (classification.verdict === 'suspicious') {
        summary.suspicious += 1;
      } else if (classification.verdict === 'authentic') {
        summary.authentic += 1;
      } else {
        summary.inconclusive += 1;
      }

      // Only apply-path jobs are tied to a real source user; retroactive library
      // re-grades use a sentinel identity and must never write reputation.
      // Jobs without an explicit origin predate the column and are apply-path.
      if (classification.penalize === true && job.origin !== 'retroactive') {
        await mergeConfirmedTranscode({ job, classification });
      }

      try {
        await spectralJobStore.completeSpectralJob({
          id: job.id,
          verdict: classification.verdict,
          cutoffHz: classification.cutoffHz,
          estimatedSourceBitrate: classification.estimatedSourceBitrate,
          contentHash,
          analysis: {
            confidence: classification.confidence,
            frameCount: measurement?.frameCount ?? 0,
            nyquistHz: classification.nyquistHz,
            reason: classification.reason,
            servedFromCache,
          },
        });
      } catch (error) {
        onWarning('Failed to finalize spectral analysis job', error);
      }
    }

    return summary;
  }

  return {
    enqueueForAppliedCandidate,
    processPendingSpectralJobs,
  };
}
