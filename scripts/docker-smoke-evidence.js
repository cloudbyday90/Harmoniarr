/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function assertDockerProviderAcceptanceValidationResult(validationResult, validationKind) {
  assertObjectSection(validationResult.provider, `${validationKind}.provider`);
  assertObjectSection(validationResult.paths, `${validationKind}.paths`);
  assertObjectSection(validationResult.importReview, `${validationKind}.importReview`);
  assertObjectSection(validationResult.musicQueue, `${validationKind}.musicQueue`);
  assertNonNegativeInteger(validationResult.musicQueue.linkedTransferCount, `${validationKind}.musicQueue.linkedTransferCount`);
  assertNonNegativeInteger(validationResult.musicQueue.totalTransferCount, `${validationKind}.musicQueue.totalTransferCount`);

  if (!Array.isArray(validationResult.importReview.diagnostics)) {
    throw new Error(`${validationKind}.importReview.diagnostics must be an array`);
  }

  if (validationResult.importReview.diagnostics.length === 0) {
    throw new Error(`${validationKind}.importReview.diagnostics must include at least one diagnostic`);
  }
}

function assertManagedSlskdValidationResult(validationResult, validationKind) {
  assertObjectSection(validationResult.config, `${validationKind}.config`);
  assertObjectSection(validationResult.harmoniarr, `${validationKind}.harmoniarr`);
  assertObjectSection(validationResult.provider, `${validationKind}.provider`);
  assertStringField(validationResult.projectName, `${validationKind}.projectName`);

  if (validationResult.config.rendererExitCode !== 0) {
    throw new Error(`${validationKind}.config.rendererExitCode must equal 0`);
  }

  if (validationResult.config.fileMode !== '600') {
    throw new Error(`${validationKind}.config.fileMode must equal 600`);
  }

  if (validationResult.config.remoteConfigurationDisabled !== true) {
    throw new Error(`${validationKind}.config.remoteConfigurationDisabled must equal true`);
  }

  if (validationResult.harmoniarr.healthCheckOk !== true) {
    throw new Error(`${validationKind}.harmoniarr.healthCheckOk must equal true`);
  }

  if (validationResult.provider.apiPortPublished !== false) {
    throw new Error(`${validationKind}.provider.apiPortPublished must equal false`);
  }

  if (validationResult.provider.apiProbeStatus !== 200) {
    throw new Error(`${validationKind}.provider.apiProbeStatus must equal 200`);
  }

  if (validationResult.provider.egressIsolated !== true) {
    throw new Error(`${validationKind}.provider.egressIsolated must equal true`);
  }

  if (validationResult.provider.healthStatus !== 'healthy') {
    throw new Error(`${validationKind}.provider.healthStatus must equal healthy`);
  }
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
    case 'docker-provider-acceptance':
      assertDockerProviderAcceptanceValidationResult(normalizedValidationResult, validationKind);
      break;
    case 'managed-slskd':
      assertManagedSlskdValidationResult(normalizedValidationResult, validationKind);
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

function assertDockerSmokeEvidenceObject(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new Error('docker smoke evidence must be an object');
  }
}

export function parseDockerSmokeEvidence(text) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('docker smoke evidence text is required');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('docker smoke evidence must be valid JSON');
  }
}

export function assertDockerSmokeEvidenceContract(evidence) {
  assertDockerSmokeEvidenceObject(evidence);

  if (evidence.schemaVersion !== 1) {
    throw new Error(`docker smoke evidence schemaVersion must equal 1, received ${String(evidence.schemaVersion)}`);
  }

  assertStringField(evidence.validationKind, 'docker smoke evidence.validationKind');
  assertStringField(evidence.generatedAt, 'docker smoke evidence.generatedAt');

  return {
    ...evidence,
    validationResult: assertDockerSmokeValidationResultContract({
      validationKind: evidence.validationKind,
      validationResult: evidence.validationResult,
    }),
  };
}

export async function verifyDockerSmokeEvidenceFile(filePath, {
  readFileFn = readFile,
} = {}) {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    throw new Error('docker smoke evidence filePath is required');
  }

  const text = await readFileFn(filePath, 'utf8');
  return assertDockerSmokeEvidenceContract(parseDockerSmokeEvidence(text));
}
