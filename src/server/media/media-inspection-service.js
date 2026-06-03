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

import { createMediaCommandService } from './media-command-service.js';


function parseDurationSeconds(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseBitrate(value) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function mapCodecNames(streams) {
  return [...new Set(streams
    .map((stream) => (typeof stream?.codec_name === 'string' ? stream.codec_name.trim().toLowerCase() : ''))
    .filter((codec) => codec.length > 0))];
}

// ffprobe exposes embedded tags as a free-form key/value object (the casing and
// presence vary by container/encoder). We normalize keys to lowercase and trim
// string values so downstream quality grading can check tag completeness
// deterministically without caring about container quirks. Non-string values
// are ignored to keep the surface predictable.
function normalizeTags(...sources) {
  const tags = {};
  for (const source of sources) {
    if (!source || typeof source !== 'object') {
      continue;
    }
    for (const [rawKey, rawValue] of Object.entries(source)) {
      if (typeof rawKey !== 'string' || typeof rawValue !== 'string') {
        continue;
      }
      const key = rawKey.trim().toLowerCase();
      const value = rawValue.trim();
      if (key.length === 0 || value.length === 0 || key in tags) {
        continue;
      }
      tags[key] = value;
    }
  }
  return tags;
}

function normalizeReadiness(status) {
  const ffmpegAvailable = status?.details?.ffmpegAvailable === true;
  const ffprobeAvailable = status?.details?.ffprobeAvailable === true;
  return {
    ffmpegAvailable,
    ffprobeAvailable,
    ready: ffmpegAvailable && ffprobeAvailable,
  };
}

function buildUnavailableWarning(readiness) {
  return {
    code: 'media_inspection_unavailable',
    message: readiness.ffprobeAvailable
      ? 'Media inspection is currently unavailable because ffmpeg or ffprobe is not ready.'
      : 'Media inspection is currently unavailable because ffprobe is not ready.',
  };
}

function buildPolicyWarnings({ audioStreamCount, durationSeconds, maxDurationSeconds }) {
  const warnings = [];

  if (audioStreamCount === 0) {
    warnings.push({
      code: 'media_inspection_no_audio_stream',
      message: 'The file does not expose an audio stream and may not import as expected.',
    });
  }

  if (Number.isFinite(maxDurationSeconds) && maxDurationSeconds > 0 && Number.isFinite(durationSeconds) && durationSeconds > maxDurationSeconds) {
    warnings.push({
      code: 'media_inspection_duration_exceeds_policy',
      message: `The file duration (${Math.round(durationSeconds)}s) exceeds the configured inspection policy threshold (${Math.round(maxDurationSeconds)}s).`,
    });
  }

  return warnings;
}

export function createMediaInspectionService({
  ffprobeBin = process.env.HARMONIARR_FFPROBE_BIN || 'ffprobe',
  getMediaToolingStatus = async () => ({
    details: {
      ffmpegAvailable: true,
      ffprobeAvailable: true,
    },
    status: 'healthy',
  }),
  maxDurationSeconds = 2 * 60 * 60,
  mediaCommandService = createMediaCommandService({
    allowedBinaries: [ffprobeBin],
  }),
  timeoutMs = 15_000,
} = {}) {
  async function getReadiness() {
    return normalizeReadiness(await getMediaToolingStatus());
  }

  async function inspectSourceFile({ sourcePath }) {
    if (typeof sourcePath !== 'string' || sourcePath.trim().length === 0) {
      throw new Error('inspectSourceFile requires sourcePath');
    }

    const readiness = await getReadiness();
    if (!readiness.ready) {
      return {
        metadata: null,
        warnings: [buildUnavailableWarning(readiness)],
      };
    }

    const args = [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      sourcePath,
    ];

    try {
      const { stdout } = await mediaCommandService.runCommand({
        args,
        binary: ffprobeBin,
        label: 'media inspection',
        maxBuffer: 1024 * 1024,
        timeoutMs,
      });
      const parsed = JSON.parse(stdout);
      const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
      const audioStreams = streams.filter((stream) => stream?.codec_type === 'audio');
      const videoStreams = streams.filter((stream) => stream?.codec_type === 'video');
      const audioCodecs = mapCodecNames(audioStreams);
      const videoCodecs = mapCodecNames(videoStreams);
      const durationSeconds = parseDurationSeconds(parsed?.format?.duration);
      const bitRate = parseBitrate(parsed?.format?.bit_rate);
      const primaryAudioStream = audioStreams[0] ?? null;
      const sampleRate = parsePositiveInteger(primaryAudioStream?.sample_rate);
      const bitDepth = parsePositiveInteger(
        primaryAudioStream?.bits_per_raw_sample ?? primaryAudioStream?.bits_per_sample,
      );
      const channelCount = parsePositiveInteger(primaryAudioStream?.channels);
      const tags = normalizeTags(parsed?.format?.tags, primaryAudioStream?.tags);
      const warnings = buildPolicyWarnings({
        audioStreamCount: audioStreams.length,
        durationSeconds,
        maxDurationSeconds,
      });

      return {
        metadata: {
          audioCodecs,
          audioStreamCount: audioStreams.length,
          bitDepth,
          bitRate,
          channelCount,
          containerFormatName: parsed?.format?.format_name ?? null,
          durationSeconds,
          primaryAudioCodec: audioCodecs[0] ?? null,
          sampleRate,
          streamCount: streams.length,
          tags,
          videoCodecs,
          videoStreamCount: videoStreams.length,
        },
        warnings,
      };
    } catch {
      return {
        metadata: null,
        warnings: [{
          code: 'media_inspection_probe_failed',
          message: 'Media inspection failed to read stream metadata from ffprobe output.',
        }],
      };
    }
  }

  return {
    getReadiness,
    inspectSourceFile,
  };
}
