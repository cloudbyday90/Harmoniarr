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

function resolveBinaryName(envValue, fallback) {
  if (typeof envValue !== 'string') {
    return fallback;
  }

  const trimmed = envValue.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

async function checkBinary({ binary, mediaCommandService }) {
  try {
    await mediaCommandService.runCommand({
      args: ['-version'],
      binary,
      timeoutMs: 5000,
    });
    return {
      available: true,
      binary,
    };
  } catch (error) {
    return {
      available: false,
      binary,
      error,
    };
  }
}

export function createMediaToolingStatusService({
  ffmpegBinary = resolveBinaryName(process.env.HARMONIARR_FFMPEG_BIN, 'ffmpeg'),
  ffprobeBinary = resolveBinaryName(process.env.HARMONIARR_FFPROBE_BIN, 'ffprobe'),
  mediaCommandService = createMediaCommandService({
    allowedBinaries: [ffmpegBinary, ffprobeBinary],
  }),
} = {}) {
  async function getStatus() {
    const [ffmpegResult, ffprobeResult] = await Promise.all([
      checkBinary({ binary: ffmpegBinary, mediaCommandService }),
      checkBinary({ binary: ffprobeBinary, mediaCommandService }),
    ]);

    const ffmpegAvailable = ffmpegResult.available;
    const ffprobeAvailable = ffprobeResult.available;

    if (ffmpegAvailable && ffprobeAvailable) {
      return {
        status: 'healthy',
        message: 'Media inspection tooling is available.',
        details: {
          ffmpegAvailable: true,
          ffprobeAvailable: true,
        },
      };
    }

    const missingBinaries = [
      ...(ffmpegAvailable ? [] : [ffmpegResult.binary]),
      ...(ffprobeAvailable ? [] : [ffprobeResult.binary]),
    ];

    const missingOnly = [ffmpegResult.error, ffprobeResult.error]
      .filter((error) => error)
      .every((error) => error?.code === 'ENOENT');

    return {
      status: missingOnly ? 'misconfigured' : 'degraded',
      code: missingOnly ? 'media_tooling_missing' : 'media_tooling_check_failed',
      message: missingOnly
        ? `Media inspection tooling is unavailable (${missingBinaries.join(', ')} not found on PATH).`
        : 'Media inspection tooling checks failed.',
      details: {
        ffmpegAvailable,
        ffprobeAvailable,
      },
    };
  }

  return {
    getStatus,
  };
}
