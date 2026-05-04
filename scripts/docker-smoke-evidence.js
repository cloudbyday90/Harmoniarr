/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const dockerSmokeEvidencePathEnvVar = 'HARMONIARR_DOCKER_SMOKE_EVIDENCE_PATH';

function cloneValidationResult(validationResult) {
  if (!validationResult || typeof validationResult !== 'object' || Array.isArray(validationResult)) {
    throw new Error('validationResult must be an object');
  }

  const {
    workspaceRoot: _workspaceRoot,
    ...remaining
  } = validationResult;

  return remaining;
}

export function getOptionalDockerSmokeEvidencePath(env = process.env) {
  const value = env[dockerSmokeEvidencePathEnvVar];

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function createDockerSmokeEvidence({
  generatedAt = new Date().toISOString(),
  validationKind,
  validationResult,
} = {}) {
  if (!validationKind || typeof validationKind !== 'string') {
    throw new Error('validationKind is required');
  }

  return {
    generatedAt,
    schemaVersion: 1,
    validationKind,
    validationResult: cloneValidationResult(validationResult),
  };
}

export async function writeDockerSmokeEvidence({
  evidencePath,
  generatedAt,
  mkdirFn = mkdir,
  validationKind,
  validationResult,
  writeFileFn = writeFile,
} = {}) {
  if (!evidencePath) {
    return null;
  }

  const resolvedEvidencePath = resolve(evidencePath);
  const evidence = createDockerSmokeEvidence({
    generatedAt,
    validationKind,
    validationResult,
  });

  await mkdirFn(dirname(resolvedEvidencePath), { recursive: true });
  await writeFileFn(resolvedEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

  return {
    evidence,
    evidencePath: resolvedEvidencePath,
  };
}