/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { resolve } from 'node:path';

import { dockerDeploymentSummaryPathEnvVar } from './docker-deployment-manifest.js';
import { runDockerDeploymentPathValidation } from './docker-deployment-validation.js';
import { getOptionalStringInput, normalizeOptionalString, parseStrictScriptOptions } from './script-input-resolution.js';

export const releaseEvidenceDirEnvVar = 'HARMONIARR_RELEASE_EVIDENCE_DIR';
export const releaseEvidenceRunIdEnvVar = 'HARMONIARR_RELEASE_EVIDENCE_RUN_ID';

const defaultEvidenceRootDir = 'artifacts/release-evidence';

export const releaseEvidencePackCliOptions = Object.freeze({
  'baseline-image-ref': { type: 'string' },
  'evidence-dir': { type: 'string' },
  'image-ref': { type: 'string' },
  'run-id': { type: 'string' },
  'summary-path': { type: 'string' },
});

function padTimestampSegment(value) {
  return String(value).padStart(2, '0');
}

export function createReleaseEvidenceRunId(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = padTimestampSegment(date.getUTCMonth() + 1);
  const day = padTimestampSegment(date.getUTCDate());
  const hour = padTimestampSegment(date.getUTCHours());
  const minute = padTimestampSegment(date.getUTCMinutes());
  const second = padTimestampSegment(date.getUTCSeconds());

  return `${year}${month}${day}-${hour}${minute}${second}`;
}

export function resolveReleaseEvidencePackInputs({
  args = process.argv.slice(2),
  env = process.env,
  nowFn = () => new Date(),
} = {}) {
  const { values } = parseStrictScriptOptions(releaseEvidencePackCliOptions, {
    allowPositionals: true,
    args,
  });

  const normalizedRunId = normalizeOptionalString(values['run-id'])
    ?? normalizeOptionalString(env[releaseEvidenceRunIdEnvVar])
    ?? createReleaseEvidenceRunId(nowFn());
  const normalizedEvidenceDir = getOptionalStringInput(values, 'evidence-dir', releaseEvidenceDirEnvVar, env)
    ?? resolve(defaultEvidenceRootDir, normalizedRunId);

  return {
    baselineImageRef: getOptionalStringInput(values, 'baseline-image-ref', 'HARMONIARR_BASELINE_IMAGE', env),
    evidenceDir: normalizedEvidenceDir,
    imageRef: getOptionalStringInput(values, 'image-ref', 'HARMONIARR_IMAGE', env),
    runId: normalizedRunId,
    summaryPath: getOptionalStringInput(values, 'summary-path', dockerDeploymentSummaryPathEnvVar, env)
      ?? resolve(normalizedEvidenceDir, 'harmoniarr-docker-deployment-summary.json'),
  };
}

export function renderReleaseEvidencePackSuccessMessage(result = {}) {
  const releasedImageSummary = result.releasedImage?.status === 'passed'
    ? 'released image passed'
    : `released image skipped (${result.releasedImage?.reason ?? 'not configured'})`;
  const upgradeSummary = result.upgradePath?.status === 'passed'
    ? 'upgrade path passed'
    : `upgrade path skipped (${result.upgradePath?.reason ?? 'not configured'})`;
  return `Release evidence pack complete (fresh install passed; ${releasedImageSummary}; ${upgradeSummary}; evidence directory ${result.evidenceDir}; summary ${result.summaryPath})`;
}

export async function runReleaseEvidencePackValidation({
  baselineImageRef = null,
  evidenceDir,
  imageRef = null,
  runDockerDeploymentPathValidationFn = runDockerDeploymentPathValidation,
  runId,
  summaryPath,
} = {}) {
  const validationResult = await runDockerDeploymentPathValidationFn({
    baselineImageRef,
    evidenceDir,
    imageRef,
    summaryPath,
  });

  return {
    ...validationResult,
    runId: normalizeOptionalString(runId),
  };
}

export async function runReleaseEvidencePackFromEnvironment(env = process.env, {
  args = process.argv.slice(2),
  nowFn = () => new Date(),
  runReleaseEvidencePackValidationFn = runReleaseEvidencePackValidation,
} = {}) {
  const inputs = resolveReleaseEvidencePackInputs({ args, env, nowFn });
  return runReleaseEvidencePackValidationFn(inputs);
}
