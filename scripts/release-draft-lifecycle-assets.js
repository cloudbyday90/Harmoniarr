/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createHash } from 'node:crypto';
import { lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultReleaseAssetNames, renderReleaseVerificationNote, verifyReleaseContract } from './release-contract.js';
import { normalizePublishedImageInputs } from './published-image-provenance-policy.js';

export async function withValidatedReleaseAssets({ assetDirectory, imageRef, inputs, run }) {
  normalizePublishedImageInputs({ imageRef, revision: inputs.revision, repository: inputs.repository });
  const loaded = [];
  for (const name of Object.values(defaultReleaseAssetNames)) {
    const path = join(assetDirectory, name);
    const stat = await lstat(path);
    const bound = name === defaultReleaseAssetNames.sbom ? 20_971_520 : 131_072;
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > bound) throw new Error('A release asset is missing, empty, or exceeds its bound');
    const bytes = await readFile(path);
    if (bytes.length !== stat.size) throw new Error('A release asset changed during validation');
    loaded.push({ name, bytes, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const text = (name) => loaded.find((asset) => asset.name === name).bytes.toString('utf8');
  const metadata = JSON.parse(text(defaultReleaseAssetNames.metadata));
  verifyReleaseContract(metadata, { expectedRepository: inputs.repository, expectedReleaseTag: inputs.releaseTag,
    expectedVersion: inputs.version, expectedImageName: inputs.imageName,
    expectedDigest: imageRef.split('@')[1], composeOverrideText: text(defaultReleaseAssetNames.composeOverride),
    releaseAssetNames: loaded.map((asset) => asset.name) });
  if (metadata.immutableImageRef !== imageRef || text(defaultReleaseAssetNames.verification) !== renderReleaseVerificationNote(metadata)) {
    throw new Error('Release verification assets do not match the expected image');
  }
  const sbom = JSON.parse(text(defaultReleaseAssetNames.sbom));
  if (!sbom || !/^SPDX-2\.[23]$/.test(sbom.spdxVersion ?? '') || sbom.SPDXID !== 'SPDXRef-DOCUMENT') {
    throw new Error('A valid SPDX release asset is required');
  }
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-release-assets-'));
  try {
    const assets = [];
    for (const asset of loaded) {
      const path = join(directory, asset.name);
      await writeFile(path, asset.bytes, { flag: 'wx', mode: 0o600 });
      assets.push({ name: asset.name, size: asset.size, sha256: asset.sha256, path });
    }
    return await run(assets);
  } finally { await rm(directory, { recursive: true, force: true }); }
}
