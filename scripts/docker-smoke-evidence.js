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

function assertObjectSection(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertStringField(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

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

function assertFreshInstallValidationResult(validationResult, validationKind) {
  assertObjectSection(validationResult.freshInstall, `${validationKind}.freshInstall`);
  assertObjectSection(validationResult.backupRestoreFlow, `${validationKind}.backupRestoreFlow`);
  assertObjectSection(validationResult.existingDataRestart, `${validationKind}.existingDataRestart`);
  assertObjectSection(validationResult.requestMusicFlow, `${validationKind}.requestMusicFlow`);
  assertStringField(validationResult.requestMusicFlow.delegatedRequestId, `${validationKind}.requestMusicFlow.delegatedRequestId`);
  assertStringField(validationResult.requestMusicFlow.requestedForUsername, `${validationKind}.requestMusicFlow.requestedForUsername`);
  assertStringField(validationResult.requestMusicFlow.summaryScope, `${validationKind}.requestMusicFlow.summaryScope`);
}

function assertUpgradeValidationResult(validationResult, validationKind) {
  assertObjectSection(validationResult.settingsPersistence, `${validationKind}.settingsPersistence`);
  assertObjectSection(validationResult.upgradedRuntime, `${validationKind}.upgradedRuntime`);
}

export function assertDockerSmokeValidationResultContract({
  validationKind,
  validationResult,
} = {}) {
  const normalizedValidationResult = cloneValidationResult(validationResult);

  switch (validationKind) {
    case 'fresh-install':
    case 'released-image':
      assertFreshInstallValidationResult(normalizedValidationResult, validationKind);
      break;
    case 'upgrade':
      assertUpgradeValidationResult(normalizedValidationResult, validationKind);
      break;
    default:
      break;
  }

  return normalizedValidationResult;
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
    validationResult: assertDockerSmokeValidationResultContract({
      validationKind,
      validationResult,
    }),
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