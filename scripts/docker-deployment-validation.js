/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { resolve } from 'node:path';

import { writeDockerDeploymentManifest } from './docker-deployment-manifest.js';
import { writeDockerSmokeEvidence } from './docker-smoke-evidence.js';
import { validateDockerFreshInstall, validateDockerUpgradePath } from './docker-smoke-validation.js';
import { normalizeOptionalString } from './script-input-resolution.js';

export const dockerDeploymentEvidenceDirEnvVar = 'HARMONIARR_DOCKER_VALIDATION_EVIDENCE_DIR';

export const dockerDeploymentPathEvidenceFileNames = Object.freeze({
  freshInstall: 'harmoniarr-docker-smoke-fresh-install.json',
  releasedImage: 'harmoniarr-docker-smoke-released-image.json',
  upgradePath: 'harmoniarr-docker-smoke-upgrade-path.json',
});

const optionalValidationSkipReasons = Object.freeze({
  releasedImage: 'HARMONIARR_IMAGE is not configured',
  upgradePath: 'HARMONIARR_BASELINE_IMAGE is not configured',
});

function resolveEvidencePath(evidenceDir, fileName) {
  const normalizedEvidenceDir = normalizeOptionalString(evidenceDir);
  return normalizedEvidenceDir ? resolve(normalizedEvidenceDir, fileName) : null;
}

function createPassedValidationStatus({
  evidencePath,
  validationKind,
  validationResult,
} = {}) {
  return {
    evidencePath,
    reason: null,
    status: 'passed',
    validationKind,
    validationResult,
  };
}

function createSkippedValidationStatus(reason) {
  return {
    evidencePath: null,
    reason,
    status: 'skipped',
    validationKind: null,
    validationResult: null,
  };
}

async function writeStepEvidence({
  evidenceDir,
  fileName,
  validationKind,
  validationResult,
  writeDockerSmokeEvidenceFn,
} = {}) {
  const evidencePath = resolveEvidencePath(evidenceDir, fileName);
  const evidence = await writeDockerSmokeEvidenceFn({
    evidencePath,
    validationKind,
    validationResult,
  });

  return evidence?.evidencePath ?? null;
}

export function renderDockerDeploymentPathValidationSuccessMessage({
  baselineImageRef,
  evidenceDir,
  imageRef,
  releasedImage,
  summaryPath,
  upgradePath,
} = {}) {
  const releasedImageSummary = releasedImage?.status === 'passed'
    ? `released image ${imageRef} passed`
    : `released image skipped (${releasedImage?.reason ?? optionalValidationSkipReasons.releasedImage})`;
  const upgradeTarget = imageRef ?? 'local workspace image build';
  const upgradePathSummary = upgradePath?.status === 'passed'
    ? `upgrade path ${baselineImageRef} -> ${upgradeTarget} passed`
    : `upgrade path skipped (${upgradePath?.reason ?? optionalValidationSkipReasons.upgradePath})`;
  const evidenceSummary = normalizeOptionalString(evidenceDir)
    ? `; evidence directory ${resolve(evidenceDir)}`
    : '';
  const summaryManifest = normalizeOptionalString(summaryPath)
    ? `; summary manifest ${summaryPath}`
    : '';

  return `Docker deployment-path validation passed (fresh install passed; ${releasedImageSummary}; ${upgradePathSummary}${evidenceSummary}${summaryManifest})`;
}

export async function runDockerDeploymentPathValidation({
  baselineImageRef = null,
  evidenceDir = null,
  imageRef = null,
  summaryPath = null,
  validateDockerFreshInstallFn = validateDockerFreshInstall,
  validateDockerUpgradePathFn = validateDockerUpgradePath,
  writeDockerDeploymentManifestFn = writeDockerDeploymentManifest,
  writeDockerSmokeEvidenceFn = writeDockerSmokeEvidence,
} = {}) {
  const normalizedImageRef = normalizeOptionalString(imageRef);
  const normalizedBaselineImageRef = normalizeOptionalString(baselineImageRef);
  const normalizedEvidenceDir = normalizeOptionalString(evidenceDir);

  const freshInstallResult = await validateDockerFreshInstallFn({
    verifyBackupRestoreFlow: true,
    verifyExistingDataRestart: true,
    verifyRequestMusicFlow: true,
  });
  const freshInstallEvidencePath = await writeStepEvidence({
    evidenceDir: normalizedEvidenceDir,
    fileName: dockerDeploymentPathEvidenceFileNames.freshInstall,
    validationKind: 'fresh-install',
    validationResult: freshInstallResult,
    writeDockerSmokeEvidenceFn,
  });

  let releasedImage = createSkippedValidationStatus(optionalValidationSkipReasons.releasedImage);
  if (normalizedImageRef) {
    const releasedImageResult = await validateDockerFreshInstallFn({
      buildImage: false,
      imageRef: normalizedImageRef,
      verifyBackupRestoreFlow: true,
      verifyExistingDataRestart: true,
      verifyRequestMusicFlow: true,
    });
    const releasedImageEvidencePath = await writeStepEvidence({
      evidenceDir: normalizedEvidenceDir,
      fileName: dockerDeploymentPathEvidenceFileNames.releasedImage,
      validationKind: 'released-image',
      validationResult: releasedImageResult,
      writeDockerSmokeEvidenceFn,
    });

    releasedImage = createPassedValidationStatus({
      evidencePath: releasedImageEvidencePath,
      validationKind: 'released-image',
      validationResult: releasedImageResult,
    });
  }

  let upgradePath = createSkippedValidationStatus(optionalValidationSkipReasons.upgradePath);
  if (normalizedBaselineImageRef) {
    const upgradePathResult = await validateDockerUpgradePathFn({
      baselineImageRef: normalizedBaselineImageRef,
      buildCandidateImage: normalizedImageRef == null,
      candidateImageRef: normalizedImageRef,
    });
    const upgradePathEvidencePath = await writeStepEvidence({
      evidenceDir: normalizedEvidenceDir,
      fileName: dockerDeploymentPathEvidenceFileNames.upgradePath,
      validationKind: 'upgrade-path',
      validationResult: upgradePathResult,
      writeDockerSmokeEvidenceFn,
    });

    upgradePath = createPassedValidationStatus({
      evidencePath: upgradePathEvidencePath,
      validationKind: 'upgrade-path',
      validationResult: upgradePathResult,
    });
  }

  const result = {
    baselineImageRef: normalizedBaselineImageRef,
    evidenceDir: normalizedEvidenceDir ? resolve(normalizedEvidenceDir) : null,
    freshInstall: createPassedValidationStatus({
      evidencePath: freshInstallEvidencePath,
      validationKind: 'fresh-install',
      validationResult: freshInstallResult,
    }),
    imageRef: normalizedImageRef,
    releasedImage,
    upgradePath,
  };

  const summary = await writeDockerDeploymentManifestFn({
    summaryPath,
    validationResult: result,
  });

  return {
    ...result,
    summaryPath: summary?.summaryPath ?? null,
  };
}