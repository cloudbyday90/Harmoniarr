/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const dockerDeploymentSummaryPathEnvVar = 'HARMONIARR_DOCKER_VALIDATION_SUMMARY_PATH';

function assertOptionalString(value, label) {
  if (value != null && (typeof value !== 'string' || value.length === 0)) {
    throw new Error(`${label} must be null or a non-empty string`);
  }
}

function assertValidationStatus(validation, label) {
  if (!validation || typeof validation !== 'object' || Array.isArray(validation)) {
    throw new Error(`${label} must be an object`);
  }

  if (validation.status !== 'passed' && validation.status !== 'skipped') {
    throw new Error(`${label}.status must be either "passed" or "skipped"`);
  }

  assertOptionalString(validation.evidencePath, `${label}.evidencePath`);
  assertOptionalString(validation.reason, `${label}.reason`);
  assertOptionalString(validation.validationKind, `${label}.validationKind`);

  if (validation.status === 'passed') {
    if (!validation.validationResult || typeof validation.validationResult !== 'object' || Array.isArray(validation.validationResult)) {
      throw new Error(`${label}.validationResult must be an object when status is passed`);
    }

    if (typeof validation.validationKind !== 'string' || validation.validationKind.length === 0) {
      throw new Error(`${label}.validationKind must be a non-empty string when status is passed`);
    }
  }

  return validation;
}

function createValidationSummary(validation) {
  const validated = assertValidationStatus(validation, 'deploymentValidation');
  const result = validated.validationResult;

  return {
    evidencePath: validated.evidencePath,
    projectName: result?.projectName ?? null,
    reason: validated.reason,
    status: validated.status,
    validationKind: validated.validationKind,
  };
}

export function createDockerDeploymentManifest({
  generatedAt = new Date().toISOString(),
  validationResult,
} = {}) {
  if (!validationResult || typeof validationResult !== 'object' || Array.isArray(validationResult)) {
    throw new Error('validationResult must be an object');
  }

  return {
    baselineImageRef: validationResult.baselineImageRef ?? null,
    evidenceDir: validationResult.evidenceDir ?? null,
    generatedAt,
    imageRef: validationResult.imageRef ?? null,
    schemaVersion: 1,
    validations: {
      freshInstall: createValidationSummary(validationResult.freshInstall),
      releasedImage: createValidationSummary(validationResult.releasedImage),
      upgradePath: createValidationSummary(validationResult.upgradePath),
    },
  };
}

export async function writeDockerDeploymentManifest({
  generatedAt,
  mkdirFn = mkdir,
  summaryPath,
  validationResult,
  writeFileFn = writeFile,
} = {}) {
  if (!summaryPath) {
    return null;
  }

  const resolvedSummaryPath = resolve(summaryPath);
  const manifest = createDockerDeploymentManifest({
    generatedAt,
    validationResult,
  });

  await mkdirFn(dirname(resolvedSummaryPath), { recursive: true });
  await writeFileFn(resolvedSummaryPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    manifest,
    summaryPath: resolvedSummaryPath,
  };
}