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

// ffmpeg-backed measurement adapter for the spectral-cutoff DSP sidecar. This is
// the only place that runs the heavy FFT pass over the decoded audio stream. It
// drives ffmpeg's `aspectralstats` filter (libavfilter), which computes an FFT
// per frame and emits a per-frame spectral *rolloff* (the 85% cumulative-energy
// frequency) via the `ametadata=print` filter. We collect every per-frame
// rolloff value and reduce them to a single brick-wall cutoff estimate (the max
// across frames) in the pure analysis layer.
//
// All process execution flows through the shared media-command-service boundary,
// which spawns with shell:false, an explicit binary allowlist, windowsHide, and
// hard timeout/maxBuffer caps. No user-controlled string is ever interpolated
// into a shell command line, so the source file path cannot be used for command
// injection.

import { createMediaCommandService } from './media-command-service.js';
import { estimateCutoffFromRolloffSamples } from './media-spectral-analysis.js';

// ffmpeg's ametadata print emits keys like:
//   lavfi.aspectralstats.1.rolloff=18234.5
//   lavfi.aspectralstats.2.rolloff=17990.1
// (per-channel) or `lavfi.aspectralstats.rolloff=...` for mono. Capture them all.
const ROLLOFF_LINE_PATTERN = /lavfi\.aspectralstats(?:\.\d+)?\.rolloff=([0-9]+(?:\.[0-9]+)?)/g;

// Platform null sink for ffmpeg's muxer; we only care about filter metadata.
const NULL_SINK = process.platform === 'win32' ? 'NUL' : '/dev/null';

function parseRolloffSamples(stdout) {
  if (typeof stdout !== 'string' || stdout.length === 0) {
    return [];
  }

  const samples = [];
  for (const match of stdout.matchAll(ROLLOFF_LINE_PATTERN)) {
    const value = Number.parseFloat(match[1]);
    if (Number.isFinite(value) && value > 0) {
      samples.push(value);
    }
  }
  return samples;
}

export function createFfmpegSpectralAnalyzer({
  ffmpegBin = process.env.HARMONIARR_FFMPEG_BIN || 'ffmpeg',
  maxAnalysisSeconds = 8 * 60,
  maxBuffer = 16 * 1024 * 1024,
  mediaCommandService = createMediaCommandService({
    allowedBinaries: [ffmpegBin],
  }),
  timeoutMs = 120_000,
} = {}) {
  /**
   * Runs the FFT pass over a single audio file and returns its spectral cutoff.
   *
   * @param {object} input
   * @param {string} input.filePath - Absolute path to the audio file to analyse.
   * @returns {Promise<{
   *   cutoffHz: number | null,
   *   frameCount: number,
   *   durationMs: number | null
   * }>}
   */
  async function analyzeSpectralCutoff({ filePath } = {}) {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      throw new Error('analyzeSpectralCutoff requires filePath');
    }

    const args = [
      '-hide_banner',
      '-nostats',
      '-v', 'error',
    ];

    // Bound how much audio we decode; the brightest frames that define the
    // brick-wall edge appear throughout the track, so a leading window is a
    // sufficient and cheap sample for the cutoff estimate.
    if (Number.isFinite(maxAnalysisSeconds) && maxAnalysisSeconds > 0) {
      args.push('-t', String(maxAnalysisSeconds));
    }

    args.push(
      '-i', filePath,
      '-map', '0:a:0',
      '-af', 'aspectralstats=measure=rolloff,ametadata=print:file=-',
      '-f', 'null',
      NULL_SINK,
    );

    const { stdout, durationMs } = await mediaCommandService.runCommand({
      args,
      binary: ffmpegBin,
      label: 'spectral cutoff analysis',
      maxBuffer,
      timeoutMs,
    });

    const rolloffSamples = parseRolloffSamples(stdout);
    return {
      cutoffHz: estimateCutoffFromRolloffSamples(rolloffSamples),
      frameCount: rolloffSamples.length,
      durationMs: Number.isFinite(durationMs) ? durationMs : null,
    };
  }

  return { analyzeSpectralCutoff };
}
