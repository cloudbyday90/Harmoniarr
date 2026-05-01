/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readFile } from 'node:fs/promises';
import {
  listReleaseMirrorReferences,
  parseReleaseMetadata,
} from './release-contract.js';
import { resolveReleaseMirrorInputs } from './release-script-inputs.js';
import { runBufferedCommand } from './process-runtime.js';
import { runDirectScriptTask } from './script-runtime.js';

export function parseManifestInspectOutput(text) {
  const parsed = JSON.parse(text);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('registry manifest output must be a JSON object');
  }

  if (typeof parsed.digest !== 'string' || parsed.digest.trim() === '') {
    throw new Error('registry manifest output must include a non-empty digest');
  }

  return parsed;
}

export async function inspectRegistryImageManifest(reference, {
  runCommandFn = runBufferedCommand,
} = {}) {
  if (!reference?.trim()) {
    throw new Error('reference is required');
  }

  const result = await runCommandFn({
    args: ['buildx', 'imagetools', 'inspect', '--format', '{{json .Manifest}}', reference],
    command: 'docker',
  });

  return parseManifestInspectOutput(result.stdout);
}

export async function verifyRegistryImageReferences({
  expectedDigest,
  inspectRegistryImageManifestFn = inspectRegistryImageManifest,
  references,
} = {}) {
  if (!expectedDigest?.trim()) {
    throw new Error('expectedDigest is required');
  }

  if (!Array.isArray(references) || references.length === 0) {
    throw new Error('references must be a non-empty array');
  }

  const verifiedReferences = [];
  for (const reference of references) {
    const manifest = await inspectRegistryImageManifestFn(reference);
    if (manifest.digest !== expectedDigest) {
      throw new Error(`registry reference ${reference} resolved to ${manifest.digest} instead of ${expectedDigest}`);
    }

    verifiedReferences.push(reference);
  }

  return {
    expectedDigest,
    verifiedReferenceCount: verifiedReferences.length,
    verifiedReferences,
  };
}

export async function verifyReleaseMirrorFromEnvironment(env = process.env, { args = process.argv.slice(2) } = {}) {
  const { expectedDigest, metadataPath, mirrorName } = resolveReleaseMirrorInputs({ args, env });
  const metadataText = await readFile(metadataPath, 'utf8');
  const metadata = parseReleaseMetadata(metadataText);

  return verifyRegistryImageReferences({
    expectedDigest: expectedDigest ?? metadata.digest,
    references: listReleaseMirrorReferences(metadata, mirrorName),
  });
}

await runDirectScriptTask(import.meta, {
    prefix: 'harmoniarr-verify-release-mirror',
    renderSuccessMessage: ({ expectedDigest, verifiedReferenceCount }) => {
      return `Verified ${verifiedReferenceCount} mirrored image reference${verifiedReferenceCount === 1 ? '' : 's'} against ${expectedDigest}`;
    },
    run: () => verifyReleaseMirrorFromEnvironment(),
  });