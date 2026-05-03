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

const encoderByCodec = Object.freeze({
  aac: 'aac',
  opus: 'libopus',
});

function resolveEncoder(codec) {
  if (typeof codec !== 'string') {
    return encoderByCodec.opus;
  }

  const normalized = codec.trim().toLowerCase();
  return encoderByCodec[normalized] ?? encoderByCodec.opus;
}

export function createMediaTranscodeExecutionService({
  ffmpegBin = process.env.HARMONIARR_FFMPEG_BIN || 'ffmpeg',
  ffmpegThreads = null,
  getMediaToolingStatus = async () => ({
    details: {
      ffmpegAvailable: true,
    },
    status: 'healthy',
  }),
  mediaCommandService = createMediaCommandService({
    allowedBinaries: [ffmpegBin],
  }),
  timeoutMs = 30_000,
} = {}) {
  async function executeCandidate({ sourcePath, transcodePlan } = {}) {
    if (typeof sourcePath !== 'string' || sourcePath.trim().length === 0) {
      throw new Error('executeCandidate requires sourcePath');
    }

    if (transcodePlan?.recommendedAction !== 'transcode_candidate') {
      return {
        mode: 'preflight_only',
        status: 'not_required',
        warnings: [],
      };
    }

    const toolingStatus = await getMediaToolingStatus();
    if (toolingStatus?.details?.ffmpegAvailable !== true) {
      return {
        mode: 'preflight_only',
        status: 'tooling_unavailable',
        warnings: [{
          code: 'media_transcode_execution_tooling_unavailable',
          message: 'Transcode preflight could not run because ffmpeg is not currently available.',
        }],
      };
    }

    const encoder = resolveEncoder(transcodePlan?.target?.audioCodec);
    const args = [
      '-v', 'error',
      '-nostdin',
      '-i', sourcePath,
      '-map', '0:a:0',
      '-vn',
      ...(Number.isInteger(ffmpegThreads) && ffmpegThreads > 0 ? ['-threads', String(ffmpegThreads)] : []),
      '-c:a', encoder,
      '-f', 'null',
      '-',
    ];

    try {
      await mediaCommandService.runCommand({
        args,
        binary: ffmpegBin,
        label: 'media transcode preflight',
        maxBuffer: 2 * 1024 * 1024,
        timeoutMs,
      });

      return {
        mode: 'preflight_only',
        status: 'preflight_passed',
        warnings: [],
      };
    } catch {
      return {
        mode: 'preflight_only',
        status: 'preflight_failed',
        warnings: [{
          code: 'media_transcode_execution_preflight_failed',
          message: 'Transcode preflight failed while validating ffmpeg decode and encode readiness for this file.',
        }],
      };
    }
  }

  return {
    executeCandidate,
  };
}
