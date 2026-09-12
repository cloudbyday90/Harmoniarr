/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createHash } from 'node:crypto';

const imageIndexes = new Set(['application/vnd.oci.image.index.v1+json', 'application/vnd.docker.distribution.manifest.list.v2+json']);
const imageManifests = new Set(['application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.v2+json']);

export function verifyReleaseImageManifestBytes(result, expectedDigest) {
  if (result?.exitCode !== 0 || !Buffer.isBuffer(result.stdout) || result.stdout.length === 0
    || result.stdout.length > 4_194_304) throw new Error('A bounded raw image manifest response is required');
  // Buildx inspect --raw writes the original bytes without adding a newline.
  // Hash before decoding; trimming or serializing JSON would change its identity.
  const digest = `sha256:${createHash('sha256').update(result.stdout).digest('hex')}`;
  if (digest !== expectedDigest) throw new Error('The image manifest digest does not match the validated build');
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(result.stdout));
  if (manifest?.schemaVersion !== 2 || !(imageIndexes.has(manifest.mediaType) || imageManifests.has(manifest.mediaType))) {
    throw new Error('Only OCI or Docker image manifests and indexes can be promoted');
  }
  if (imageIndexes.has(manifest.mediaType)) {
    if (!Array.isArray(manifest.manifests) || manifest.manifests.length === 0 || manifest.manifests.length > 256
      || manifest.manifests.some((entry) => !/^sha256:[a-f0-9]{64}$/.test(entry?.digest ?? '')
        || !Number.isSafeInteger(entry.size) || entry.size <= 0)) throw new Error('Invalid image index descriptors');
  } else if (!/^sha256:[a-f0-9]{64}$/.test(manifest.config?.digest ?? '')
    || !Array.isArray(manifest.layers)) throw new Error('Invalid image manifest structure');
  return digest;
}
