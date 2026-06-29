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
  QUALITY_PROFILE_CODES,
  createAcquisitionQualityPolicyService,
} from '../acquisition/acquisition-quality-policy-service.js';
import { assessFileDeliveryQuality } from '../media/media-delivery-quality.js';

const LOSSLESS_CODECS = new Set([
  'alac',
  'ape',
  'flac',
  'pcm_s16be',
  'pcm_s16le',
  'pcm_s24be',
  'pcm_s24le',
  'pcm_s32le',
  'tak',
  'tta',
  'wavpack',
]);

const FATAL_INSPECTION_WARNING_CODES = new Set([
  'media_inspection_no_audio_stream',
  'media_inspection_probe_failed',
  'media_inspection_unavailable',
]);

const BLOCKING_DELIVERY_SIGNALS = new Set([
  'codec_extension_mismatch',
  'lossless_low_bitrate',
  'low_bitrate',
]);

const BLOCKING_SPECTRAL_VERDICTS = new Set(['suspicious', 'transcoded']);

function normalizeToken(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function extractExtension(filename) {
  const normalized = normalizeToken(filename);
  const dotIndex = normalized.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === normalized.length - 1) {
    return null;
  }
  return normalized.slice(dotIndex + 1);
}

function toPositiveKbps(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed / 1000);
}

function resolveMusicQueueContext(summaryCandidate) {
  const context = summaryCandidate?.musicQueueContext
    ?? summaryCandidate?.normalizedPayload?.musicQueue
    ?? summaryCandidate?.normalized_payload?.musicQueue
    ?? {};

  return {
    profileCode: typeof context.profileCode === 'string' && context.profileCode.trim()
      ? context.profileCode.trim()
      : QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE,
    qualityOverride: context.qualityOverride && typeof context.qualityOverride === 'object'
      ? context.qualityOverride
      : null,
  };
}

function resolveFileMetadata(file) {
  const metadata = file?.inspection && typeof file.inspection === 'object'
    ? file.inspection.metadata
    : null;
  return metadata && typeof metadata === 'object' ? metadata : null;
}

function resolveInspectionWarnings(file) {
  return Array.isArray(file?.inspection?.warnings) ? file.inspection.warnings : [];
}

function hasFatalInspectionWarning(file) {
  return resolveInspectionWarnings(file).some((warning) => FATAL_INSPECTION_WARNING_CODES.has(warning?.code));
}

function resolveSpectralVerdict(file) {
  const candidates = [
    file?.spectral?.verdict,
    file?.inspection?.spectral?.verdict,
    file?.inspection?.metadata?.spectralVerdict,
    file?.inspection?.metadata?.spectral?.verdict,
  ];
  return candidates.map(normalizeToken).find(Boolean) ?? null;
}

function buildMediaVerification({ file, metadata }) {
  const codec = normalizeToken(metadata.primaryAudioCodec);
  const extension = extractExtension(file?.filename);
  return {
    audioFormat: codec,
    bitDepth: metadata.bitDepth ?? null,
    bitrateKbps: toPositiveKbps(metadata.bitRate),
    channelCount: metadata.channelCount ?? null,
    codec,
    container: normalizeToken(metadata.containerFormatName),
    duration: metadata.duration ?? null,
    extension,
    isLossless: LOSSLESS_CODECS.has(codec),
    sampleRate: metadata.sampleRate ?? null,
    tags: metadata.tags && typeof metadata.tags === 'object' ? metadata.tags : {},
    verifiedLossless: LOSSLESS_CODECS.has(codec),
  };
}

function buildBlocker({ code, file, message }) {
  return {
    code,
    fileId: file?.fileId ?? null,
    filename: file?.filename ?? null,
    message,
  };
}

function evaluateStrictLosslessFile({ file, qualityPolicyService, qualityOverride, profileCode, summaryCandidate }) {
  if (file?.status?.code && file.status.code !== 'ready') {
    return buildBlocker({
      code: 'safe_auto_file_not_ready',
      file,
      message: 'The file is not ready for automatic add to library.',
    });
  }

  if (hasFatalInspectionWarning(file)) {
    return buildBlocker({
      code: 'safe_auto_media_inspection_failed',
      file,
      message: 'Harmoniarr could not verify this file with ffprobe.',
    });
  }

  const metadata = resolveFileMetadata(file);
  if (!metadata) {
    return buildBlocker({
      code: 'safe_auto_media_inspection_missing',
      file,
      message: 'No ffprobe audio evidence is available for this file.',
    });
  }

  const mediaVerification = buildMediaVerification({ file, metadata });
  const qualityDecision = qualityPolicyService.evaluateQualityEvidence({
    candidate: summaryCandidate,
    mediaVerification,
    profileCode,
    qualityOverride,
  });
  if (!qualityDecision.autoAddEligible) {
    return buildBlocker({
      code: `safe_auto_quality_${qualityDecision.code}`,
      file,
      message: qualityDecision.explanation,
    });
  }

  const deliveryQuality = assessFileDeliveryQuality({ filename: file?.filename, metadata });
  const blockingSignal = deliveryQuality.signals.find((signal) => BLOCKING_DELIVERY_SIGNALS.has(signal));
  if (blockingSignal) {
    return buildBlocker({
      code: `safe_auto_quality_${blockingSignal}`,
      file,
      message: 'This file does not match the required audio quality evidence.',
    });
  }

  const spectralVerdict = resolveSpectralVerdict(file);
  if (BLOCKING_SPECTRAL_VERDICTS.has(spectralVerdict)) {
    return buildBlocker({
      code: `safe_auto_spectral_${spectralVerdict}`,
      file,
      message: 'Spectral analysis does not verify this lossless file.',
    });
  }

  return null;
}

export function createImportCandidateSafeAutoAddQualityGateService({
  qualityPolicyService = createAcquisitionQualityPolicyService(),
} = {}) {
  function evaluateSafeAutoAddQuality({
    applyPreview,
    summaryCandidate = {},
  } = {}) {
    const { profileCode, qualityOverride } = resolveMusicQueueContext(summaryCandidate);
    const profile = qualityPolicyService.resolveQualityProfile(profileCode);
    if (!profile.requiresVerification) {
      return {
        eligible: true,
        blockers: [],
        checkedFileCount: 0,
        message: `${profile.label} does not require a strict lossless verification gate before automatic add.`,
        profileCode: profile.code,
        status: 'eligible',
      };
    }

    const files = Array.isArray(applyPreview?.files) ? applyPreview.files : [];
    if (files.length === 0) {
      return {
        eligible: false,
        blockers: [{
          code: 'safe_auto_no_files',
          fileId: null,
          filename: null,
          message: 'No downloaded files are available for audio-quality verification.',
        }],
        checkedFileCount: 0,
        message: 'Automatic add stopped because no downloaded files are available for audio-quality verification.',
        profileCode: profile.code,
        status: 'blocked',
      };
    }

    const blockers = files
      .map((file) => evaluateStrictLosslessFile({
        file,
        profileCode: profile.code,
        qualityOverride,
        qualityPolicyService,
        summaryCandidate,
      }))
      .filter(Boolean);

    if (blockers.length > 0) {
      return {
        eligible: false,
        blockers,
        checkedFileCount: files.length,
        message: `${blockers.length} file${blockers.length === 1 ? '' : 's'} did not pass verified lossless checks before automatic add.`,
        profileCode: profile.code,
        status: 'blocked',
      };
    }

    return {
      eligible: true,
      blockers: [],
      checkedFileCount: files.length,
      message: `${files.length} file${files.length === 1 ? ' passed' : 's passed'} verified lossless checks before automatic add.`,
      profileCode: profile.code,
      status: 'eligible',
    };
  }

  return {
    evaluateSafeAutoAddQuality,
  };
}
