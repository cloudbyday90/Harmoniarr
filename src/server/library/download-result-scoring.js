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
  DEFAULT_MINIMUM_MATCH_RATIO,
  matchExpectedTracklist,
  scoreTracklistMatch,
} from './candidate-track-matcher.js';

const LOSSLESS_EXTENSIONS = new Set(['flac', 'wav', 'aiff', 'alac', 'ape', 'wv']);
const LOSSY_EXTENSIONS = new Set(['mp3', 'aac', 'ogg', 'opus', 'wma', 'm4a']);

export function scoreFormatTier({ preferredFormat, minimumQuality, extensions = [], files = [] }) {
  if (!Array.isArray(extensions) || extensions.length === 0) {
    return { name: 'formatTier', score: 0 };
  }

  const normalizedExtensions = extensions.map((ext) =>
    typeof ext === 'string' ? ext.toLowerCase() : '',
  );

  const losslessCount = normalizedExtensions.filter((ext) => LOSSLESS_EXTENSIONS.has(ext)).length;
  const lossyCount = normalizedExtensions.filter((ext) => LOSSY_EXTENSIONS.has(ext)).length;

  if (preferredFormat === 'flac') {
    if (losslessCount > 0 && lossyCount === 0) return { name: 'formatTier', score: 100 };
    if (losslessCount > 0 && lossyCount > 0) return { name: 'formatTier', score: 80 };
    if (lossyCount > 0) return { name: 'formatTier', score: 40 };
    return { name: 'formatTier', score: 20 };
  }

  if (preferredFormat === 'mp3_320' || preferredFormat === 'mp3_v0') {
    if (losslessCount > 0 && lossyCount === 0) return { name: 'formatTier', score: 90 };
    if (lossyCount > 0 && losslessCount === 0) return { name: 'formatTier', score: 80 };
    if (losslessCount > 0 && lossyCount > 0) return { name: 'formatTier', score: 70 };
    return { name: 'formatTier', score: 20 };
  }

  if (minimumQuality === 'lossless') {
    if (losslessCount > 0) return { name: 'formatTier', score: 100 };
    return { name: 'formatTier', score: 20 };
  }

  if (minimumQuality === 'high') {
    if (losslessCount > 0) return { name: 'formatTier', score: 100 };
    const hasHighBitrate = files.some(
      (f) => LOSSY_EXTENSIONS.has(typeof f.extension === 'string' ? f.extension.toLowerCase() : '') && (f.bitRateKbps ?? 0) >= 320,
    );
    if (hasHighBitrate) return { name: 'formatTier', score: 80 };
    if (lossyCount > 0) return { name: 'formatTier', score: 50 };
    return { name: 'formatTier', score: 20 };
  }

  if (losslessCount > 0) return { name: 'formatTier', score: 100 };
  if (lossyCount > 0) return { name: 'formatTier', score: 70 };
  return { name: 'formatTier', score: 30 };
}

export function scoreAudioDepth({ files = [] }) {
  if (!Array.isArray(files) || files.length === 0) {
    return { name: 'audioDepth', score: 50 };
  }

  const audioFiles = files.filter((f) => {
    const ext = typeof f.extension === 'string' ? f.extension.toLowerCase() : '';
    return LOSSLESS_EXTENSIONS.has(ext) || LOSSY_EXTENSIONS.has(ext);
  });

  if (audioFiles.length === 0) {
    return { name: 'audioDepth', score: 50 };
  }

  const losslessFiles = audioFiles.filter((f) => {
    const ext = typeof f.extension === 'string' ? f.extension.toLowerCase() : '';
    return LOSSLESS_EXTENSIONS.has(ext);
  });

  const losslessRatio = losslessFiles.length / audioFiles.length;

  if (losslessRatio === 0) {
    const avgBitrate = audioFiles.reduce((sum, f) => sum + (f.bitRateKbps ?? 0), 0) / audioFiles.length;
    if (avgBitrate >= 320) return { name: 'audioDepth', score: 60 };
    if (avgBitrate >= 256) return { name: 'audioDepth', score: 50 };
    if (avgBitrate >= 192) return { name: 'audioDepth', score: 40 };
    return { name: 'audioDepth', score: 20 };
  }

  const highRes = losslessFiles.filter((f) => (f.bitDepth ?? 0) > 16 || (f.sampleRateHz ?? 0) > 44100);
  const highResRatio = highRes.length / losslessFiles.length;

  if (highResRatio > 0.5) return { name: 'audioDepth', score: 100 };
  if (losslessRatio > 0.5) return { name: 'audioDepth', score: 90 };
  return { name: 'audioDepth', score: 70 };
}

export function scoreCandidateTrackMatch({
  expectedTrackTitles = null,
  albumTitle = null,
  files = [],
  minimumRatio = DEFAULT_MINIMUM_MATCH_RATIO,
}) {
  const candidateFilenames = (Array.isArray(files) ? files : [])
    .map((file) => (typeof file?.filename === 'string' ? file.filename : file?.name))
    .filter((name) => typeof name === 'string' && name.length > 0);

  const summary = matchExpectedTracklist({
    expectedTrackTitles,
    candidateFilenames,
    albumTitle,
    minimumRatio,
  });

  return { name: 'candidateTrackMatch', score: scoreTracklistMatch(summary), summary };
}

export function scoreTrackCount({ candidateFileCount = 0, expectedTrackCount = null }) {
  if (expectedTrackCount === null || expectedTrackCount <= 0) {
    return { name: 'trackCount', score: 50 };
  }

  if (candidateFileCount === 0) {
    return { name: 'trackCount', score: 0 };
  }

  const ratio = candidateFileCount / expectedTrackCount;

  if (ratio >= 1.0) return { name: 'trackCount', score: 100 };
  if (ratio >= 0.9) return { name: 'trackCount', score: 80 };
  if (ratio >= 0.75) return { name: 'trackCount', score: 60 };
  if (ratio >= 0.5) return { name: 'trackCount', score: 40 };
  return { name: 'trackCount', score: 20 };
}

export function scoreDuration({ candidateDurationSeconds = 0, expectedDurationSeconds = null }) {
  if (expectedDurationSeconds === null || expectedDurationSeconds <= 0) {
    return { name: 'duration', score: 50 };
  }

  if (candidateDurationSeconds <= 0) {
    return { name: 'duration', score: 30 };
  }

  const ratio = candidateDurationSeconds / expectedDurationSeconds;

  if (ratio >= 0.95 && ratio <= 1.05) return { name: 'duration', score: 100 };
  if (ratio >= 0.85 && ratio <= 1.15) return { name: 'duration', score: 80 };
  if (ratio >= 0.7 && ratio <= 1.3) return { name: 'duration', score: 60 };
  if (ratio >= 0.5) return { name: 'duration', score: 40 };
  return { name: 'duration', score: 20 };
}

export function scoreFormatConsistency({ extensions = [] }) {
  if (!Array.isArray(extensions) || extensions.length === 0) {
    return { name: 'formatConsistency', score: 50 };
  }

  const normalized = extensions.map((ext) =>
    typeof ext === 'string' ? ext.toLowerCase() : '',
  ).filter(Boolean);

  if (normalized.length === 0) {
    return { name: 'formatConsistency', score: 50 };
  }

  const audioExts = normalized.filter((ext) =>
    LOSSLESS_EXTENSIONS.has(ext) || LOSSY_EXTENSIONS.has(ext),
  );

  if (audioExts.length === 0) {
    return { name: 'formatConsistency', score: 30 };
  }

  const uniqueAudioFormats = new Set(audioExts);

  if (uniqueAudioFormats.size === 1) return { name: 'formatConsistency', score: 100 };
  if (uniqueAudioFormats.size === 2) return { name: 'formatConsistency', score: 70 };
  return { name: 'formatConsistency', score: 40 };
}

export function scorePeerDelivery({ hasFreeUploadSlot = false, queueLength = null, uploadSpeed = null }) {
  let score = 50;

  if (hasFreeUploadSlot) {
    score += 30;
  }

  if (queueLength !== null && queueLength !== undefined) {
    if (queueLength === 0) score += 20;
    else if (queueLength <= 2) score += 10;
    else if (queueLength <= 5) score += 0;
    else score -= 10;
  }

  if (uploadSpeed !== null && uploadSpeed !== undefined) {
    if (uploadSpeed >= 10_000_000) score += 20;
    else if (uploadSpeed >= 1_000_000) score += 10;
    else if (uploadSpeed >= 100_000) score += 0;
    else score -= 10;
  }

  return { name: 'peerDelivery', score: Math.max(0, Math.min(100, score)) };
}

export function scoreUploaderReputation({ successCount = 0, failureCount = 0 }) {
  const total = successCount + failureCount;

  if (total < 5) {
    return { name: 'uploaderReputation', score: 50 };
  }

  const successRate = successCount / total;

  if (successRate >= 0.9) return { name: 'uploaderReputation', score: 100 };
  if (successRate >= 0.7) return { name: 'uploaderReputation', score: 80 };
  if (successRate >= 0.5) return { name: 'uploaderReputation', score: 60 };
  if (successRate >= 0.3) return { name: 'uploaderReputation', score: 40 };
  return { name: 'uploaderReputation', score: 20 };
}

const DEFAULT_SCORERS = [
  { name: 'formatTier', weight: 0.25, fn: scoreFormatTier },
  { name: 'candidateTrackMatch', weight: 0.20, fn: scoreCandidateTrackMatch },
  { name: 'audioDepth', weight: 0.12, fn: scoreAudioDepth },
  { name: 'duration', weight: 0.12, fn: scoreDuration },
  { name: 'formatConsistency', weight: 0.10, fn: scoreFormatConsistency },
  { name: 'trackCount', weight: 0.08, fn: scoreTrackCount },
  { name: 'peerDelivery', weight: 0.08, fn: scorePeerDelivery },
  { name: 'uploaderReputation', weight: 0.05, fn: scoreUploaderReputation },
];

export function scoreDownloadResult({
  candidate,
  formatPreferences = null,
  expectedTrackCount = null,
  expectedTrackTitles = null,
  expectedDurationSeconds = null,
  albumTitle = null,
  minimumTrackMatchRatio = DEFAULT_MINIMUM_MATCH_RATIO,
  uploaderReputation = null,
  scorers = DEFAULT_SCORERS,
}) {
  const extensions = candidate.normalizedPayload?.extensions ?? candidate.extensions ?? [];
  const files = candidate.files ?? [];
  const candidateFileCount = candidate.fileCount ?? candidate.normalizedPayload?.fileCount ?? files.length;

  const candidateDurationSeconds = files.reduce(
    (sum, f) => sum + (f.lengthSeconds ?? 0), 0,
  );

  const formatInput = formatPreferences
    ? {
      preferredFormat: formatPreferences.preferredFormat,
      minimumQuality: formatPreferences.minimumQuality,
      extensions,
      files,
    }
    : { extensions, files };

  const reputationInput = uploaderReputation
    ? {
      successCount: uploaderReputation.successCount ?? 0,
      failureCount: uploaderReputation.failureCount ?? 0,
    }
    : null;

  const hasExpectedTrackTitles = Array.isArray(expectedTrackTitles)
    && expectedTrackTitles.some((title) => typeof title === 'string' && title.trim().length > 0);

  const inputs = {
    formatTier: formatInput,
    candidateTrackMatch: hasExpectedTrackTitles
      ? {
        expectedTrackTitles,
        albumTitle,
        files,
        minimumRatio: minimumTrackMatchRatio,
      }
      : null,
    audioDepth: { files },
    trackCount: { candidateFileCount, expectedTrackCount },
    duration: { candidateDurationSeconds, expectedDurationSeconds },
    formatConsistency: { extensions },
    peerDelivery: {
      hasFreeUploadSlot: candidate.normalizedPayload?.hasFreeUploadSlot ?? false,
      queueLength: candidate.normalizedPayload?.queueLength ?? null,
      uploadSpeed: candidate.normalizedPayload?.uploadSpeed ?? null,
    },
    uploaderReputation: reputationInput,
  };

  const breakdown = [];
  let totalWeight = 0;
  let weightedSum = 0;
  let trackMatchSummary = null;

  for (const scorer of scorers) {
    const input = inputs[scorer.name];
    if (!input) continue;

    const result = scorer.fn(input);
    if (result.score === null || result.score === undefined) continue;

    if (scorer.name === 'candidateTrackMatch' && result.summary) {
      trackMatchSummary = result.summary;
    }

    breakdown.push({ name: scorer.name, score: result.score, weight: scorer.weight });
    weightedSum += result.score * scorer.weight;
    totalWeight += scorer.weight;
  }

  const compositeScore = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 100) / 100
    : null;

  return { compositeScore, breakdown, trackMatchSummary };
}
