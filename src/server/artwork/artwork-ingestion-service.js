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

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createApiError } from '../auth.js';
import { createArtworkPolicyService } from './artwork-policy-service.js';
import { getArtworkAssetBySha256, upsertArtworkAsset } from './artwork-repository.js';

const supportedInputFormats = new Map([
  ['jpeg', { extension: 'jpg', mimeType: 'image/jpeg' }],
  ['png', { extension: 'png', mimeType: 'image/png' }],
  ['webp', { extension: 'webp', mimeType: 'image/webp' }],
]);

const outputEncoders = {
  jpeg(image) {
    return image.jpeg({ chromaSubsampling: '4:4:4', quality: 90 });
  },
  png(image) {
    return image.png({ compressionLevel: 9 });
  },
  webp(image) {
    return image.webp({ effort: 4, quality: 90 });
  },
};

const storageClassDirectories = new Map([
  ['derivative', 'derivatives'],
  ['extracted_embedded', 'extracted'],
  ['embedded_extract', 'extracted'],
]);

function createArtworkValidationError(code, message) {
  return createApiError(400, code, message);
}

function ensureNonEmptyBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw createArtworkValidationError('validation_error', 'artwork buffer must be a Buffer');
  }

  if (buffer.length === 0) {
    throw createArtworkValidationError('validation_error', 'artwork buffer must not be empty');
  }
}

function computeSha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function resolveCanonicalDimensions(metadata) {
  return {
    height: metadata.autoOrient?.height ?? metadata.height ?? null,
    width: metadata.autoOrient?.width ?? metadata.width ?? null,
  };
}

function normalizeStorageClass(storageClass) {
  if (typeof storageClass !== 'string' || storageClass.trim().length === 0) {
    throw createArtworkValidationError('validation_error', 'storageClass must be a non-empty string');
  }

  return storageClass.trim().toLowerCase();
}

function resolveStorageDirectory(storageClass) {
  return storageClassDirectories.get(storageClass) ?? 'originals';
}

export function buildArtworkRelativePath({ extension, sha256, storageClass }) {
  const directory = resolveStorageDirectory(storageClass);
  return path.posix.join(directory, sha256.slice(0, 2), sha256.slice(2, 4), `${sha256}.${extension}`);
}

export async function inspectArtworkBuffer(buffer) {
  ensureNonEmptyBuffer(buffer);
  return sharp(buffer).metadata();
}

export async function sanitizeArtworkBuffer({ buffer, format }) {
  const encoder = outputEncoders[format];
  if (!encoder) {
    throw createArtworkValidationError('artwork_format_unsupported', `Unsupported artwork format: ${format}`);
  }

  const pipeline = encoder(sharp(buffer).rotate()).timeout({ seconds: 3 });
  return pipeline.toBuffer({ resolveWithObject: true });
}

export async function prepareArtworkAsset({
  buffer,
  fetchedAt = null,
  policy,
  sourceProvider = null,
  sourceUrl = null,
  storageClass = 'provider_original',
  inspectArtworkBufferFn = inspectArtworkBuffer,
  sanitizeArtworkBufferFn = sanitizeArtworkBuffer,
} = {}) {
  ensureNonEmptyBuffer(buffer);

  if (!policy?.limits || !policy?.storage?.root) {
    throw new Error('policy with artwork limits and storage paths is required');
  }

  const normalizedStorageClass = normalizeStorageClass(storageClass);
  const payloadChecksum = computeSha256(buffer);

  if (buffer.length > policy.limits.maxOriginalFileSizeBytes) {
    throw createArtworkValidationError(
      'artwork_file_too_large',
      `Artwork file exceeds the configured size limit of ${policy.limits.maxOriginalFileSizeBytes} bytes`,
    );
  }

  const metadata = await inspectArtworkBufferFn(buffer);
  const { width, height } = resolveCanonicalDimensions(metadata);
  const formatDescriptor = supportedInputFormats.get(metadata.format);

  if (!formatDescriptor) {
    throw createArtworkValidationError(
      'artwork_format_unsupported',
      'Artwork must be a jpeg, png, or webp image',
    );
  }

  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw createArtworkValidationError('artwork_dimensions_invalid', 'Artwork dimensions could not be determined');
  }

  if (metadata.pages && metadata.pages > 1) {
    throw createArtworkValidationError('artwork_animation_unsupported', 'Animated or multi-page artwork is not supported');
  }

  if (width > policy.limits.maxOriginalDimensionPixels || height > policy.limits.maxOriginalDimensionPixels) {
    throw createArtworkValidationError(
      'artwork_dimensions_too_large',
      `Artwork dimensions exceed the configured limit of ${policy.limits.maxOriginalDimensionPixels} pixels`,
    );
  }

  const { data, info } = await sanitizeArtworkBufferFn({
    buffer,
    format: metadata.format,
  });
  const sha256 = computeSha256(data);
  const relativePath = buildArtworkRelativePath({
    extension: formatDescriptor.extension,
    sha256,
    storageClass: normalizedStorageClass,
  });

  return {
    asset: {
      fetchedAt,
      fileSizeBytes: info.size,
      height: info.height,
      lastVerifiedAt: new Date().toISOString(),
      mimeType: formatDescriptor.mimeType,
      payloadChecksum,
      relativePath,
      sha256,
      sourceProvider,
      sourceUrl,
      storageClass: normalizedStorageClass,
      storageNamespace: 'artwork',
      width: info.width,
    },
    data,
  };
}

function resolveAbsoluteArtworkPath(rootPath, relativePath) {
  const absoluteRoot = path.resolve(rootPath);
  const absolutePath = path.resolve(rootPath, relativePath);

  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new Error('Resolved artwork path escapes the configured storage root');
  }

  return absolutePath;
}

export function createArtworkIngestionService({
  artworkPolicyService = createArtworkPolicyService(),
  getArtworkAssetBySha256Fn = getArtworkAssetBySha256,
  inspectArtworkBufferFn = inspectArtworkBuffer,
  readFileFn = readFile,
  sanitizeArtworkBufferFn = sanitizeArtworkBuffer,
  upsertArtworkAssetFn = upsertArtworkAsset,
  writeFileFn = writeFile,
  mkdirFn = mkdir,
} = {}) {
  async function ingestArtworkBuffer({
    buffer,
    fetchedAt = null,
    sourceProvider = null,
    sourceUrl = null,
    storageClass = 'provider_original',
  } = {}) {
    const policy = await artworkPolicyService.getArtworkRuntimePolicy();
    const prepared = await prepareArtworkAsset({
      buffer,
      fetchedAt,
      inspectArtworkBufferFn,
      policy,
      sanitizeArtworkBufferFn,
      sourceProvider,
      sourceUrl,
      storageClass,
    });
    const existingAsset = await getArtworkAssetBySha256Fn(prepared.asset.sha256);
    const absolutePath = resolveAbsoluteArtworkPath(policy.storage.root, prepared.asset.relativePath);

    await mkdirFn(path.dirname(absolutePath), { recursive: true });
    try {
      await writeFileFn(absolutePath, prepared.data, { flag: 'wx' });
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }
    }

    if (existingAsset) {
      return {
        absolutePath,
        asset: existingAsset,
        stored: false,
      };
    }

    return {
      absolutePath,
      asset: await upsertArtworkAssetFn(prepared.asset),
      stored: true,
    };
  }

  async function ingestArtworkFile({
    filePath,
    fetchedAt = null,
    sourceProvider = null,
    sourceUrl = null,
    storageClass = 'provider_original',
  } = {}) {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      throw createArtworkValidationError('validation_error', 'filePath must be a non-empty string');
    }

    const buffer = await readFileFn(filePath);
    return ingestArtworkBuffer({
      buffer,
      fetchedAt,
      sourceProvider,
      sourceUrl,
      storageClass,
    });
  }

  return {
    ingestArtworkFile,
    ingestArtworkBuffer,
  };
}