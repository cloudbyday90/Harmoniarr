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

function normalizeCodecSet(codecs) {
  if (!Array.isArray(codecs)) {
    return new Set();
  }

  return new Set(codecs
    .filter((codec) => typeof codec === 'string' && codec.trim().length > 0)
    .map((codec) => codec.trim().toLowerCase()));
}

export function createMediaTranscodePlanningService({
  losslessCodecs = ['alac', 'ape', 'flac', 'pcm_s16le', 'pcm_s24le', 'wavpack'],
  lossyCodecs = ['aac', 'mp3', 'opus', 'vorbis'],
  transcodeTargetCodec = 'opus',
} = {}) {
  const losslessCodecSet = normalizeCodecSet(losslessCodecs);
  const lossyCodecSet = normalizeCodecSet(lossyCodecs);

  function planInspection({ inspection = null } = {}) {
    const metadata = inspection?.metadata ?? null;

    if (!metadata) {
      return {
        mode: 'planning_only',
        rationale: 'inspection_unavailable',
        recommendedAction: 'keep_original',
        target: null,
        warnings: [{
          code: 'media_transcode_inspection_unavailable',
          message: 'Transcode planning could not evaluate media codecs because inspection metadata is unavailable.',
        }],
      };
    }

    if ((metadata.audioStreamCount ?? 0) < 1) {
      return {
        mode: 'planning_only',
        rationale: 'no_audio_stream',
        recommendedAction: 'keep_original',
        target: null,
        warnings: [{
          code: 'media_transcode_no_audio_stream',
          message: 'Transcode planning found no audio stream. This file should be reviewed before any transform path is enabled.',
        }],
      };
    }

    const codecSet = normalizeCodecSet(metadata.audioCodecs);
    const hasLosslessSource = [...codecSet].some((codec) => losslessCodecSet.has(codec));
    if (hasLosslessSource) {
      return {
        mode: 'planning_only',
        rationale: 'preserve_lossless_source',
        recommendedAction: 'keep_original',
        target: null,
        warnings: [],
      };
    }

    const hasLossySource = [...codecSet].some((codec) => lossyCodecSet.has(codec));
    if (hasLossySource) {
      return {
        mode: 'planning_only',
        rationale: 'lossy_source_detected',
        recommendedAction: 'transcode_candidate',
        target: {
          audioCodec: transcodeTargetCodec,
        },
        warnings: [{
          code: 'media_transcode_lossy_source_detected',
          message: `Planning detected a lossy source codec. If transcode execution is enabled later, default policy should require explicit operator acknowledgment before writing ${transcodeTargetCodec} derivatives.`,
        }],
      };
    }

    return {
      mode: 'planning_only',
      rationale: 'codec_family_unknown',
      recommendedAction: 'keep_original',
      target: null,
      warnings: [{
        code: 'media_transcode_unknown_codec_family',
        message: 'Transcode planning encountered an unknown codec family and will keep the original source until policy is explicitly configured.',
      }],
    };
  }

  return {
    planInspection,
  };
}