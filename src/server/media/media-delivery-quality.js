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

// Pure delivery-quality grader for applied media files. The apply summary only
// tells us *whether* files landed; it says nothing about *fidelity*. This module
// derives fidelity signals from the ffprobe inspection metadata we already
// collect during the apply preview, so the reputation ledger can downgrade peers
// that deliver fake / transcoded "lossless" files even when the apply itself
// succeeded cleanly.
//
// Detection follows the lightweight, decode-free heuristics established by the
// open-source fake-FLAC tooling (e.g. FLAC Detective / "Fakin' the Funk"):
//   - codec <-> extension mismatch: a lossless extension (.flac/.alac/.wav/...)
//     carrying a lossy codec (mp3/aac/opus/...) is a definitive transcode.
//   - lossless container under-bitrate: a genuine 16-bit/44.1kHz FLAC compresses
//     to roughly 40-70% of its uncompressed PCM bitrate; a ratio far below that
//     is a strong sign the source was lossy before re-encoding.
//   - tag completeness: missing core tags (artist/album/title) signals a sloppy
//     or scraped release.
//
// Full spectral-cutoff analysis (decode + FFT) is intentionally out of scope
// here because it cannot run on the synchronous apply path; that belongs in a
// dedicated offline sidecar. This module performs no IO and has no side effects.

// Extensions that promise a lossless / uncompressed stream.
const LOSSLESS_EXTENSIONS = new Set([
  'aiff', 'aif', 'alac', 'ape', 'flac', 'm4a', 'tak', 'tta', 'wav', 'wv',
]);

// Codecs that are lossless (or PCM). Anything claiming a lossless extension must
// resolve to one of these to be authentic.
const LOSSLESS_CODECS = new Set([
  'alac', 'ape', 'flac', 'pcm_s16be', 'pcm_s16le', 'pcm_s24be', 'pcm_s24le',
  'pcm_s32le', 'tak', 'tta', 'wavpack',
]);

// Codecs that are unambiguously lossy.
const LOSSY_CODECS = new Set([
  'aac', 'ac3', 'eac3', 'mp1', 'mp2', 'mp3', 'opus', 'vorbis', 'wmav2',
]);

// Below this lossy bitrate (bits/sec) a delivery is considered low quality.
const LOW_LOSSY_BITRATE = 192_000;

// A lossless container whose actual bitrate is below this fraction of its
// theoretical uncompressed PCM bitrate is treated as transcode-suspicious. Real
// lossless rips rarely compress below ~30% because high-frequency content is
// preserved; lossy-sourced fakes shed that content and compress much further.
const LOSSLESS_BITRATE_RATIO_FLOOR = 0.30;

// Core tags every legitimate music release should carry.
const REQUIRED_TAGS = ['artist', 'album', 'title'];

// Per-signal penalty weights, ordered from strongest to weakest signal.
const SIGNAL_PENALTIES = Object.freeze({
  codec_extension_mismatch: 0.6,
  lossless_low_bitrate: 0.4,
  low_bitrate: 0.2,
  incomplete_tags: 0.1,
});

function clampUnit(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value > 1 ? 1 : value;
}

function extractExtension(filename) {
  if (typeof filename !== 'string') {
    return null;
  }
  const trimmed = filename.trim().toLowerCase();
  const dotIndex = trimmed.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) {
    return null;
  }
  return trimmed.slice(dotIndex + 1);
}

function isLosslessExtension(extension) {
  // .m4a is overloaded (ALAC = lossless, AAC = lossy), so it is not treated as a
  // lossless promise on its own — the codec decides.
  return extension !== null && extension !== 'm4a' && LOSSLESS_EXTENSIONS.has(extension);
}

function listMissingTags(tags) {
  const safeTags = tags && typeof tags === 'object' ? tags : {};
  return REQUIRED_TAGS.filter((tag) => {
    const value = safeTags[tag];
    return typeof value !== 'string' || value.trim().length === 0;
  });
}

/**
 * Assesses the delivery fidelity of a single applied file from its filename and
 * ffprobe inspection metadata.
 *
 * @param {object} [params]
 * @param {string} [params.filename]
 * @param {object|null} [params.metadata] inspection metadata (may be null when
 *   ffprobe was unavailable — in that case no signals are produced).
 * @returns {{ penalty: number, signals: string[], labels: string[] }}
 */
export function assessFileDeliveryQuality({ filename = null, metadata = null } = {}) {
  const signals = [];

  if (!metadata || typeof metadata !== 'object') {
    return { penalty: 0, signals, labels: [] };
  }

  const extension = extractExtension(filename);
  const primaryCodec = typeof metadata.primaryAudioCodec === 'string'
    ? metadata.primaryAudioCodec.trim().toLowerCase()
    : null;
  const losslessExtension = isLosslessExtension(extension);
  const bitRate = Number.isFinite(metadata.bitRate) && metadata.bitRate > 0 ? metadata.bitRate : null;

  // Signal 1 (strongest): a lossless extension carrying a lossy codec.
  const codecMismatch = losslessExtension && primaryCodec !== null && LOSSY_CODECS.has(primaryCodec);
  if (codecMismatch) {
    signals.push('codec_extension_mismatch');
  }

  // Signal 2: lossless container compressing implausibly small (transcode hint).
  if (!codecMismatch && primaryCodec !== null && LOSSLESS_CODECS.has(primaryCodec) && bitRate !== null) {
    const sampleRate = Number.isFinite(metadata.sampleRate) ? metadata.sampleRate : null;
    const bitDepth = Number.isFinite(metadata.bitDepth) ? metadata.bitDepth : null;
    const channelCount = Number.isFinite(metadata.channelCount) && metadata.channelCount > 0
      ? metadata.channelCount
      : null;
    if (sampleRate && bitDepth && channelCount) {
      const uncompressedBitrate = sampleRate * bitDepth * channelCount;
      if (uncompressedBitrate > 0 && bitRate / uncompressedBitrate < LOSSLESS_BITRATE_RATIO_FLOOR) {
        signals.push('lossless_low_bitrate');
      }
    }
  }

  // Signal 3: a lossy delivery below the acceptable bitrate floor.
  if (!codecMismatch && primaryCodec !== null && LOSSY_CODECS.has(primaryCodec) && bitRate !== null && bitRate < LOW_LOSSY_BITRATE) {
    signals.push('low_bitrate');
  }

  // Signal 4 (weakest): missing core metadata tags.
  if (listMissingTags(metadata.tags).length > 0) {
    signals.push('incomplete_tags');
  }

  const penalty = signals.reduce((total, signal) => total + (SIGNAL_PENALTIES[signal] ?? 0), 0);

  return {
    penalty: clampUnit(penalty),
    signals,
    labels: [...signals],
  };
}

/**
 * Aggregates per-file delivery-quality assessments into a single penalty weight
 * for an applied candidate. The aggregate penalty is the maximum per-file
 * penalty (a single fake file taints the delivery) and the union of all signals.
 *
 * @param {object} [params]
 * @param {Array<{ filename?: string, inspection?: { metadata?: object|null }, metadata?: object|null }>} [params.files]
 * @returns {{ penaltyWeight: number, labels: string[], signals: string[], assessedFileCount: number }}
 */
export function assessDeliveredQuality({ files = [] } = {}) {
  const safeFiles = Array.isArray(files) ? files : [];
  const signalSet = new Set();
  let penaltyWeight = 0;
  let assessedFileCount = 0;

  for (const file of safeFiles) {
    if (!file || typeof file !== 'object') {
      continue;
    }
    const metadata = file.inspection && typeof file.inspection === 'object'
      ? file.inspection.metadata
      : file.metadata;
    if (!metadata || typeof metadata !== 'object') {
      continue;
    }
    assessedFileCount += 1;
    const assessment = assessFileDeliveryQuality({ filename: file.filename, metadata });
    if (assessment.penalty > penaltyWeight) {
      penaltyWeight = assessment.penalty;
    }
    for (const signal of assessment.signals) {
      signalSet.add(signal);
    }
  }

  const signals = [...signalSet];
  return {
    penaltyWeight: clampUnit(penaltyWeight),
    labels: signals,
    signals,
    assessedFileCount,
  };
}
