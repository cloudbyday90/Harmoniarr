/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { resolve } from 'node:path';

import {
  defaultDockerBrowserSmokeBaseUrl,
  runDockerOperatorBrowserSmoke,
} from './docker-browser-smoke-validation.js';
import { dockerDeploymentSummaryPathEnvVar, writeDockerDeploymentManifest } from './docker-deployment-manifest.js';
import { runDockerDeploymentPathValidation } from './docker-deployment-validation.js';
import {
  getBooleanInput,
  getOptionalStringInput,
  getRequiredStringInput,
  normalizeOptionalString,
  parseStrictScriptOptions,
} from './script-input-resolution.js';

export const releaseEvidenceDirEnvVar = 'HARMONIARR_RELEASE_EVIDENCE_DIR';
export const releaseEvidenceRunIdEnvVar = 'HARMONIARR_RELEASE_EVIDENCE_RUN_ID';
export const releaseEvidenceIncludeBrowserSmokeEnvVar = 'HARMONIARR_RELEASE_EVIDENCE_INCLUDE_BROWSER_SMOKE';

const defaultEvidenceRootDir = 'artifacts/release-evidence';
const defaultBrowserSmokeEvidenceFileName = 'harmoniarr-docker-browser-smoke.json';

export const releaseEvidencePackCliOptions = Object.freeze({
  'baseline-image-ref': { type: 'string' },
  'browser-base-url': { type: 'string' },
  'browser-evidence-path': { type: 'string' },
  'browser-headless': { type: 'boolean' },
  'browser-password': { type: 'string' },
  'browser-screenshot-dir': { type: 'string' },
  'browser-timeout-ms': { type: 'string' },
  'browser-username': { type: 'string' },
  'evidence-dir': { type: 'string' },
  'image-ref': { type: 'string' },
  'include-browser-smoke': { type: 'boolean' },
  'run-id': { type: 'string' },
  'summary-path': { type: 'string' },
});

function parsePositiveInteger(value, fieldName, defaultValue) {
  if (value == null || String(value).trim() === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return parsed;
}

function createSkippedBrowserSmokeStatus(reason) {
  return {
    evidencePath: null,
    reason,
    status: 'skipped',
    validationKind: null,
    validationResult: null,
  };
}

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
  const includeBrowserSmoke = getBooleanInput(values, 'include-browser-smoke', releaseEvidenceIncludeBrowserSmokeEnvVar, env, false);
  const browserBaseUrl = getOptionalStringInput(values, 'browser-base-url', 'HARMONIARR_BASE_URL', env)
    ?? defaultDockerBrowserSmokeBaseUrl;
  const browserEvidencePath = getOptionalStringInput(values, 'browser-evidence-path', 'HARMONIARR_DOCKER_BROWSER_SMOKE_EVIDENCE_PATH', env)
    ?? resolve(normalizedEvidenceDir, defaultBrowserSmokeEvidenceFileName);
  const browserScreenshotDir = getOptionalStringInput(values, 'browser-screenshot-dir', 'HARMONIARR_DOCKER_BROWSER_SMOKE_SCREENSHOT_DIR', env)
    ?? resolve(normalizedEvidenceDir, 'browser-smoke-screenshots');
  const browserHeadless = getBooleanInput(values, 'browser-headless', 'HARMONIARR_DOCKER_BROWSER_SMOKE_HEADLESS', env, true);
  const browserTimeoutMs = parsePositiveInteger(
    values['browser-timeout-ms'] ?? env.HARMONIARR_DOCKER_BROWSER_SMOKE_TIMEOUT_MS,
    'browser-timeout-ms',
    15_000,
  );

  return {
    baselineImageRef: getOptionalStringInput(values, 'baseline-image-ref', 'HARMONIARR_BASELINE_IMAGE', env),
    browserBaseUrl,
    browserEvidencePath,
    browserHeadless,
    browserPassword: includeBrowserSmoke
      ? getRequiredStringInput(values, 'browser-password', 'HARMONIARR_WALKTHROUGH_PASSWORD', env)
      : getOptionalStringInput(values, 'browser-password', 'HARMONIARR_WALKTHROUGH_PASSWORD', env),
    browserScreenshotDir,
    browserTimeoutMs,
    browserUsername: includeBrowserSmoke
      ? getRequiredStringInput(values, 'browser-username', 'HARMONIARR_WALKTHROUGH_USERNAME', env)
      : getOptionalStringInput(values, 'browser-username', 'HARMONIARR_WALKTHROUGH_USERNAME', env),
    evidenceDir: normalizedEvidenceDir,
    imageRef: getOptionalStringInput(values, 'image-ref', 'HARMONIARR_IMAGE', env),
    includeBrowserSmoke,
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
  const browserSmokeSummary = result.browserSmoke?.status === 'passed'
    ? 'browser smoke passed'
    : `browser smoke skipped (${result.browserSmoke?.reason ?? 'not enabled'})`;
  return `Release evidence pack complete (fresh install passed; ${releasedImageSummary}; ${upgradeSummary}; ${browserSmokeSummary}; evidence directory ${result.evidenceDir}; summary ${result.summaryPath})`;
}

export async function runReleaseEvidencePackValidation({
  baselineImageRef = null,
  browserBaseUrl,
  browserEvidencePath,
  browserHeadless = true,
  browserPassword,
  browserScreenshotDir = null,
  browserTimeoutMs = 15_000,
  browserUsername,
  evidenceDir,
  imageRef = null,
  includeBrowserSmoke = false,
  runDockerOperatorBrowserSmokeFn = runDockerOperatorBrowserSmoke,
  runDockerDeploymentPathValidationFn = runDockerDeploymentPathValidation,
  runId,
  summaryPath,
  writeDockerDeploymentManifestFn = writeDockerDeploymentManifest,
} = {}) {
  const deploymentValidationResult = await runDockerDeploymentPathValidationFn({
    baselineImageRef,
    evidenceDir,
    imageRef,
    summaryPath,
  });

  const browserSmoke = includeBrowserSmoke
    ? {
      evidencePath: null,
      reason: null,
      status: 'passed',
      validationKind: 'browser-operator-smoke',
      validationResult: await runDockerOperatorBrowserSmokeFn({
        baseUrl: browserBaseUrl,
        evidencePath: browserEvidencePath,
        headless: browserHeadless,
        password: browserPassword,
        screenshotDir: browserScreenshotDir,
        timeoutMs: browserTimeoutMs,
        username: browserUsername,
      }),
    }
    : createSkippedBrowserSmokeStatus('browser smoke is not enabled for this release evidence pack run');

  if (browserSmoke.status === 'passed') {
    browserSmoke.evidencePath = browserSmoke.validationResult?.evidencePath ?? null;
  }

  const combinedValidationResult = {
    ...deploymentValidationResult,
    browserSmoke,
  };

  let rewrittenSummaryPath = deploymentValidationResult.summaryPath ?? null;
  if (summaryPath) {
    const rewrittenSummary = await writeDockerDeploymentManifestFn({
      summaryPath,
      validationResult: combinedValidationResult,
    });
    rewrittenSummaryPath = rewrittenSummary?.summaryPath ?? rewrittenSummaryPath;
  }

  return {
    ...combinedValidationResult,
    runId: normalizeOptionalString(runId),
    summaryPath: rewrittenSummaryPath,
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
