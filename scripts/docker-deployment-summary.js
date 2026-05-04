/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

import { verifyDockerSmokeEvidenceFile } from './docker-smoke-evidence.js';

function createPassedValidationSummary(evidence, evidencePath) {
  return {
    artifactName: basename(evidencePath),
    evidenceGeneratedAt: evidence.generatedAt,
    evidencePath,
    status: 'passed',
    validationKind: evidence.validationKind,
  };
}

function createSkippedValidationSummary(reason) {
  return {
    artifactName: null,
    evidenceGeneratedAt: null,
    evidencePath: null,
    reason,
    status: 'skipped',
    validationKind: null,
  };
}

export function createDockerDeploymentSummary({
  generatedAt = new Date().toISOString(),
  imageRef = null,
  releaseTag = null,
  releasedImageEvidence,
  releasedImageEvidencePath,
  upgradePathEvidence = null,
  upgradePathEvidencePath = null,
} = {}) {
  if (!releasedImageEvidence || typeof releasedImageEvidence !== 'object' || Array.isArray(releasedImageEvidence)) {
    throw new Error('releasedImageEvidence is required');
  }

  if (releasedImageEvidence.validationKind !== 'released-image') {
    throw new Error(`releasedImageEvidence.validationKind must equal released-image, received ${String(releasedImageEvidence.validationKind)}`);
  }

  if (typeof releasedImageEvidencePath !== 'string' || releasedImageEvidencePath.length === 0) {
    throw new Error('releasedImageEvidencePath is required');
  }

  if (upgradePathEvidence && upgradePathEvidence.validationKind !== 'upgrade') {
    throw new Error(`upgradePathEvidence.validationKind must equal upgrade, received ${String(upgradePathEvidence.validationKind)}`);
  }

  return {
    generatedAt,
    imageRef,
    releaseTag,
    schemaVersion: 1,
    summaryKind: 'release-image-workflow',
    validations: {
      releasedImage: createPassedValidationSummary(releasedImageEvidence, releasedImageEvidencePath),
      upgradePath: upgradePathEvidence && upgradePathEvidencePath
        ? createPassedValidationSummary(upgradePathEvidence, upgradePathEvidencePath)
        : createSkippedValidationSummary('upgrade-path smoke evidence was not produced for this release run'),
    },
  };
}

export async function writeDockerDeploymentSummary({
  generatedAt,
  imageRef = null,
  mkdirFn = mkdir,
  readFileFn,
  releaseTag = null,
  releasedImageEvidencePath,
  summaryPath,
  upgradePathEvidencePath = null,
  verifyDockerSmokeEvidenceFileFn = verifyDockerSmokeEvidenceFile,
  writeFileFn = writeFile,
} = {}) {
  if (typeof summaryPath !== 'string' || summaryPath.trim().length === 0) {
    throw new Error('summaryPath is required');
  }

  const resolvedReleasedImageEvidencePath = resolve(releasedImageEvidencePath);
  const resolvedUpgradePathEvidencePath = typeof upgradePathEvidencePath === 'string' && upgradePathEvidencePath.trim().length > 0
    ? resolve(upgradePathEvidencePath)
    : null;
  const releasedImageEvidence = await verifyDockerSmokeEvidenceFileFn(resolvedReleasedImageEvidencePath, {
    readFileFn,
  });
  const upgradePathEvidence = resolvedUpgradePathEvidencePath
    ? await verifyDockerSmokeEvidenceFileFn(resolvedUpgradePathEvidencePath, {
      readFileFn,
    })
    : null;

  const manifest = createDockerDeploymentSummary({
    generatedAt,
    imageRef,
    releaseTag,
    releasedImageEvidence,
    releasedImageEvidencePath: resolvedReleasedImageEvidencePath,
    upgradePathEvidence,
    upgradePathEvidencePath: resolvedUpgradePathEvidencePath,
  });
  const resolvedSummaryPath = resolve(summaryPath);

  await mkdirFn(dirname(resolvedSummaryPath), { recursive: true });
  await writeFileFn(resolvedSummaryPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    summary: manifest,
    summaryPath: resolvedSummaryPath,
  };
}