/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readFile } from 'node:fs/promises';
import { getReleaseMirror, parseReleaseMetadata, verifyReleaseContract } from './release-contract.js';
import { resolveReleaseMirrorInputs } from './release-script-inputs.js';
import { inspectRegistryImageManifest, verifyRegistryImageReferences } from './verify-release-mirror.js';
import { runDirectScriptTask } from './script-runtime.js';

export async function verifyStagedReleaseMirror({ metadata, expectedDigest, mirrorName = 'dockerHub',
  inspectRegistryImageManifestFn = inspectRegistryImageManifest } = {}) {
  if (!/^sha256:[a-f0-9]{64}$/.test(expectedDigest ?? '')) throw new Error('An explicit staged build digest is required');
  verifyReleaseContract(metadata, { expectedDigest });
  const mirror = getReleaseMirror(metadata, mirrorName);
  if (mirror.immutableImageRef !== `${mirror.imageName}@${expectedDigest}`) throw new Error('Staged mirror identity differs from the build');
  return verifyRegistryImageReferences({ expectedDigest, inspectRegistryImageManifestFn,
    references: [mirror.immutableImageRef] });
}

export async function verifyStagedReleaseMirrorFromEnvironment(env = process.env, { args = process.argv.slice(2) } = {}) {
  const { metadataPath, expectedDigest, mirrorName } = resolveReleaseMirrorInputs({ args, env });
  return verifyStagedReleaseMirror({ metadata: parseReleaseMetadata(await readFile(metadataPath, 'utf8')), expectedDigest, mirrorName });
}

await runDirectScriptTask(import.meta, {
  prefix: 'staged-release-mirror',
  run: () => verifyStagedReleaseMirrorFromEnvironment(),
  renderSuccessMessage: () => 'Staged mirror digest verified; release aliases remain pending promotion',
});
