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

function mapCodecNames(streams) {
  return [...new Set(streams
    .map((stream) => (typeof stream?.codec_name === 'string' ? stream.codec_name.trim().toLowerCase() : ''))
    .filter((codec) => codec.length > 0))];
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
      const warnings = buildPolicyWarnings({
        audioStreamCount: audioStreams.length,
        durationSeconds,
        maxDurationSeconds,
      });

      return {
        metadata: {
          audioCodecs,
          audioStreamCount: audioStreams.length,
          bitRate,
          containerFormatName: parsed?.format?.format_name ?? null,
          durationSeconds,
          primaryAudioCodec: audioCodecs[0] ?? null,
          streamCount: streams.length,
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
