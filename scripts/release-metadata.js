/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createReleaseMetadata,
  renderReleaseComposeOverride,
  renderReleaseVerificationNote,
  toTagList,
} from './release-contract.js';

export async function writeReleaseMetadataFiles({
  directory,
  digest,
  dockerHubImageName,
  dockerHubTrustMode,
  imageName,
  releaseTag,
  repository,
  tagsText,
  version,
} = {}) {
  if (!directory) {
    throw new Error('directory is required');
  }

  await mkdir(directory, { recursive: true });

  const metadata = createReleaseMetadata({
    digest,
    dockerHubImageName,
    dockerHubTrustMode,
    imageName,
    releaseTag,
    repository,
    tags: toTagList(tagsText),
    version,
  });
  const metadataPath = resolve(directory, metadata.assets.metadata);
  const verificationPath = resolve(directory, metadata.assets.verification);
  const composeOverridePath = resolve(directory, metadata.assets.composeOverride);

  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  await writeFile(verificationPath, renderReleaseVerificationNote(metadata), 'utf8');
  await writeFile(composeOverridePath, renderReleaseComposeOverride(metadata), 'utf8');

  return {
    composeOverridePath,
    metadata,
    metadataPath,
    verificationPath,
  };
}