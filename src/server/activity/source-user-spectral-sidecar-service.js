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
// reaches a terminal/retry state; interruption drains and releases captured claims.

import { captureSpectralJobClaim, createSpectralClaimLostError } from './source-user-spectral-claim-store.js';
import { createSourceUserSpectralJobService } from './source-user-spectral-job-service.js';
import { withOperationRunInterruption } from '../worker-interruption-scope.js';
import { withWorkerTaskCleanup } from '../worker-task-cleanup.js';
import { settleMediaTasks, throwIfMediaCancelled } from '../media/media-cancellation.js';
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
  withInterruption = withOperationRunInterruption,
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

  const jobService = createSourceUserSpectralJobService({ spectralJobStore, spectralCacheStore, hashFileFn,
    analyzeSpectralCutoffFn, classifySpectralCutoffFn, recordSourceUserOutcomeEvidenceFn, onWarning });

  async function processPendingSpectralJobs({ limit = DEFAULT_PROCESS_LIMIT, signal } = {}) {
    throwIfMediaCancelled(signal);
    const summary = { claimed: 0, analyzed: 0, cacheHits: 0, transcodedConfirmed: 0,
      suspicious: 0, authentic: 0, inconclusive: 0, failed: 0, interrupted: 0 };
    let jobs;
    try { jobs = await spectralJobStore.claimNextSpectralJobs({ limit }); }
    catch (error) { throwIfMediaCancelled(signal); onWarning('Failed to claim spectral analysis jobs', error); return summary; }
    const claims = jobs.map(job => ({ job, expectedClaim: captureSpectralJobClaim(job) }));
    summary.claimed = claims.length;
    return withWorkerTaskCleanup(async () => {
      throwIfMediaCancelled(signal);
      let thresholds;
      if (typeof loadSpectralThresholdsFn === 'function') {
        try { const loaded = await loadSpectralThresholdsFn(); thresholds = loaded && typeof loaded === 'object' ? loaded : undefined; }
        catch (error) { throwIfMediaCancelled(signal); onWarning('Failed to load spectral thresholds; using defaults', error); }
        throwIfMediaCancelled(signal);
      }
      for (const { job, expectedClaim } of claims) {
        throwIfMediaCancelled(signal);
        const check = async () => {
          if (!await spectralJobStore.isSpectralJobClaimCurrent({ expectedClaim })) throw createSpectralClaimLostError();
          return false;
        };
        try {
          await check(); throwIfMediaCancelled(signal);
          const prepared = await withInterruption({ signal, runId: job.id, isCancellationRequested: check },
            ownedSignal => jobService.prepareJob({ job, signal: ownedSignal, thresholds }));
          const result = await jobService.publishJob({ job, expectedClaim, signal, prepared });
          summary.analyzed++; if (result.servedFromCache) summary.cacheHits++;
          const verdict = result.classification.verdict;
          if (verdict === 'transcoded') summary.transcodedConfirmed++;
          else if (verdict === 'suspicious') summary.suspicious++;
          else if (verdict === 'authentic') summary.authentic++;
          else summary.inconclusive++;
        } catch (error) {
          throwIfMediaCancelled(signal);
          if (error?.code === 'spectral_job_claim_lost') { summary.interrupted++; continue; }
          summary.failed++; onWarning('Spectral job processing failed', error);
          try { await spectralJobStore.failSpectralJob({ id: job.id, expectedClaim, error: 'Spectral processing failed', maxAttempts: attemptCap }); }
          catch (failure) { onWarning('Failed to record spectral analysis failure', failure); }
        }
      }
      return summary;
    }, () => settleMediaTasks(claims.map(({ expectedClaim }) => spectralJobStore.releaseSpectralJobClaim({ expectedClaim }))));
  }

  return {
    enqueueForAppliedCandidate,
    processPendingSpectralJobs,
  };
}
