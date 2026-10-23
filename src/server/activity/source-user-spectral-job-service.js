/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { throwIfMediaCancelled } from '../media/media-cancellation.js';
import { isDeclaredLossless } from '../media/media-spectral-analysis.js';
import { createSpectralClaimLostError } from './source-user-spectral-claim-store.js';

/** Prepare outside the transaction; publish a measurement and job result under its claim lock. */
export function createSourceUserSpectralJobService({ spectralJobStore, spectralCacheStore, hashFileFn,
  analyzeSpectralCutoffFn, classifySpectralCutoffFn, recordSpectralOutcomeEvidenceFn, onWarning }) {
  async function prepareJob({ job, signal, thresholds }) {
    throwIfMediaCancelled(signal);
    let contentHash = job.contentHash ?? null;
    if (!contentHash && typeof hashFileFn === 'function') {
      try { contentHash = await hashFileFn({ filePath: job.filePath, signal }); }
      catch (error) { throwIfMediaCancelled(signal); onWarning('Failed to fingerprint file for spectral cache', error); }
      throwIfMediaCancelled(signal);
    }
    let measurement; let servedFromCache = false;
    if (contentHash && typeof spectralCacheStore?.getCachedMeasurement === 'function') {
      try { measurement = await spectralCacheStore.getCachedMeasurement({ contentHash }); servedFromCache = Boolean(measurement); }
      catch (error) { throwIfMediaCancelled(signal); onWarning('Failed to read spectral cache', error); }
      throwIfMediaCancelled(signal);
    }
    if (!servedFromCache) {
      measurement = await analyzeSpectralCutoffFn({ filePath: job.filePath, signal });
      throwIfMediaCancelled(signal);
    }

    const classification = classifySpectralCutoffFn({ cutoffHz: measurement?.cutoffHz ?? null, sampleRate: job.sampleRate,
      declaredLossless: isDeclaredLossless({ codec: job.declaredCodec, extension: job.declaredExtension }), thresholds });
    return { contentHash, measurement, classification, servedFromCache };
  }

  async function publishJob({ job, expectedClaim, signal, prepared }) {
    throwIfMediaCancelled(signal);
    const { contentHash, measurement, classification, servedFromCache } = prepared;
    let afterCommit = null;
    const published = await spectralJobStore.withSpectralJobClaim({ expectedClaim, signal }, async queryable => {
      if (!servedFromCache && contentHash && typeof spectralCacheStore?.putCachedMeasurement === 'function') {
        await spectralCacheStore.putCachedMeasurement({ contentHash, cutoffHz: measurement?.cutoffHz ?? null,
          frameCount: measurement?.frameCount ?? 0, durationMs: measurement?.durationMs ?? null, queryable, signal });
      }
      throwIfMediaCancelled(signal);
      const result = await spectralJobStore.completeSpectralJob({ id: job.id, expectedClaim, queryable,
        verdict: classification.verdict, cutoffHz: classification.cutoffHz, estimatedSourceBitrate: classification.estimatedSourceBitrate,
        contentHash, analysis: { confidence: classification.confidence, frameCount: measurement?.frameCount ?? 0,
          nyquistHz: classification.nyquistHz, reason: classification.reason, servedFromCache } });
      if (!result) throw createSpectralClaimLostError();
      if (classification.penalize === true && job.origin !== 'retroactive') {
        if (typeof recordSpectralOutcomeEvidenceFn !== 'function') throw new TypeError('Transactional spectral evidence recording is required');
        const evidence = await recordSpectralOutcomeEvidenceFn({ job, queryable, signal,
          qualityWeight: classification.qualityWeight, reason: classification.reason });
        if (evidence?.recorded !== true) throw new Error('Spectral reputation was not recorded');
        afterCommit = evidence.afterCommit;
      }
      return result;
    });
    if (!published) throw createSpectralClaimLostError();
    throwIfMediaCancelled(signal);
    if (typeof afterCommit === 'function') {
      try { await afterCommit(); }
      catch (error) { throwIfMediaCancelled(signal); onWarning('Failed to deliver spectral reputation advisories', error); }
      throwIfMediaCancelled(signal);
    }
    return { classification, servedFromCache };
  }
  return { prepareJob, publishJob };
}
