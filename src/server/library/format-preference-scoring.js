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

const FORMAT_SEARCH_TERMS = {
  flac: 'FLAC',
  mp3_320: '320',
  mp3_v0: 'V0',
};

const LOSSLESS_EXTENSIONS = new Set(['flac', 'wav', 'aiff', 'alac', 'ape', 'wv']);
const LOSSY_EXTENSIONS = new Set(['mp3', 'aac', 'ogg', 'opus', 'wma', 'm4a']);

export function buildFormatSearchTerm(preferredFormat) {
  if (!preferredFormat || preferredFormat === 'any') {
    return null;
  }
  return FORMAT_SEARCH_TERMS[preferredFormat] ?? null;
}

export function isQualityAboveMinimum({ minimumQuality, extension, bitRateKbps }) {
  if (!minimumQuality || minimumQuality === 'any') {
    return true;
  }

  const ext = typeof extension === 'string' ? extension.toLowerCase() : '';

  if (minimumQuality === 'lossless') {
    return LOSSLESS_EXTENSIONS.has(ext);
  }

  if (minimumQuality === 'high') {
    if (LOSSLESS_EXTENSIONS.has(ext)) {
      return true;
    }
    const bitrate = typeof bitRateKbps === 'number' ? bitRateKbps : 0;
    return bitrate >= 320;
  }

  return true;
}

export function scoreCandidateFormatMatch({
  preferredFormat,
  minimumQuality,
  extensions = [],
  files = [],
}) {
  if ((!preferredFormat || preferredFormat === 'any') && (!minimumQuality || minimumQuality === 'any')) {
    return { label: null, matches: true, score: 100 };
  }

  if (!Array.isArray(extensions) || extensions.length === 0) {
    return { label: 'Unknown format', matches: false, score: 0 };
  }

  const normalizedExtensions = extensions.map((ext) =>
    typeof ext === 'string' ? ext.toLowerCase() : '',
  );

  const meetsMinimum = files.length === 0
    ? normalizedExtensions.some((ext) => isQualityAboveMinimum({ extension: ext, minimumQuality, bitRateKbps: null }))
    : files.some((file) =>
      isQualityAboveMinimum({
        bitRateKbps: file.bitRateKbps ?? null,
        extension: file.extension ?? null,
        minimumQuality,
      }),
    );

  if (!meetsMinimum) {
    return { label: 'Below quality floor', matches: false, score: 0 };
  }

  if (!preferredFormat || preferredFormat === 'any') {
    return { label: null, matches: true, score: 100 };
  }

  const preferredExtensions = getPreferredExtensions(preferredFormat);
  const hasPreferredFormat = normalizedExtensions.some((ext) => preferredExtensions.has(ext));

  if (hasPreferredFormat) {
    return { label: 'Format match', matches: true, score: 100 };
  }

  if (isLosslessPreferred(preferredFormat) && normalizedExtensions.some((ext) => LOSSY_EXTENSIONS.has(ext))) {
    return { label: 'Lossy alternative', matches: true, score: 40 };
  }

  if (isLossyPreferred(preferredFormat) && normalizedExtensions.some((ext) => LOSSLESS_EXTENSIONS.has(ext))) {
    return { label: 'Higher quality available', matches: true, score: 60 };
  }

  return { label: 'Different format', matches: true, score: 20 };
}

function getPreferredExtensions(preferredFormat) {
  switch (preferredFormat) {
    case 'flac':
      return new Set(['flac']);
    case 'mp3_320':
      return new Set(['mp3']);
    case 'mp3_v0':
      return new Set(['mp3']);
    default:
      return new Set();
  }
}

function isLosslessPreferred(preferredFormat) {
  return preferredFormat === 'flac';
}

function isLossyPreferred(preferredFormat) {
  return preferredFormat === 'mp3_320' || preferredFormat === 'mp3_v0';
}
