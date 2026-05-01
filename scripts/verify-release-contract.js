/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readFile } from 'node:fs/promises';
import {
  listReleaseAssetNames,
  parseReleaseMetadata,
  parseReleaseView,
  verifyReleaseContract,
} from './release-contract.js';
import { resolveReleaseContractInputs } from './release-script-inputs.js';
import { runDirectScriptTask } from './script-runtime.js';

async function readTextFileIfPresent(filePath) {
  if (!filePath) {
    return null;
  }

  return readFile(filePath, 'utf8');
}

export async function verifyReleaseContractFromEnvironment(env = process.env, { args = process.argv.slice(2) } = {}) {
  const inputs = resolveReleaseContractInputs({ args, env });
  const metadataText = await readFile(inputs.metadataPath, 'utf8');
  const releaseViewText = await readTextFileIfPresent(inputs.releaseViewPath);
  const composeOverrideText = await readTextFileIfPresent(inputs.composeOverridePath);
  const metadata = parseReleaseMetadata(metadataText);
  const releaseView = releaseViewText ? parseReleaseView(releaseViewText) : null;

  return verifyReleaseContract(metadata, {
    composeOverrideText,
    expectedDigest: inputs.expectedDigest,
    expectedDockerHubImageName: inputs.expectedDockerHubImageName,
    expectedDockerHubTrustMode: inputs.expectedDockerHubTrustMode,
    expectedImageName: inputs.expectedImageName,
    expectedReleaseTag: inputs.expectedReleaseTag,
    expectedRepository: inputs.expectedRepository,
    expectedVersion: inputs.expectedVersion,
    releaseAssetNames: releaseView ? listReleaseAssetNames(releaseView) : [],
  });
}

await runDirectScriptTask(import.meta, {
    prefix: 'harmoniarr-verify-release-contract',
    renderSuccessMessage: ({ assetCount, immutableImageRef, releaseTag }) => {
      return `Release contract verified for ${releaseTag} (${immutableImageRef}; ${assetCount} release asset${assetCount === 1 ? '' : 's'} checked)`;
    },
    run: () => verifyReleaseContractFromEnvironment(),
  });