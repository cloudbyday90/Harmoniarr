/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { validateDockerUpgradePath } from './docker-smoke-validation.js';
import { getOptionalDockerSmokeEvidencePath, writeDockerSmokeEvidence } from './docker-smoke-evidence.js';
import { runDirectScriptTask } from './script-runtime.js';

const evidencePath = getOptionalDockerSmokeEvidencePath();

function getRequiredBaselineImageRef(env = process.env) {
  const imageRef = env.HARMONIARR_BASELINE_IMAGE?.trim();

  if (!imageRef) {
    throw new Error('HARMONIARR_BASELINE_IMAGE must point to the prior accepted immutable image reference to validate upgrades');
  }

  return imageRef;
}

function getOptionalCandidateImageRef(env = process.env) {
  const imageRef = env.HARMONIARR_IMAGE?.trim();
  return imageRef && imageRef.length > 0 ? imageRef : null;
}

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-validate-docker-upgrade',
  renderSuccessMessage: ({ baselineImageRef, candidateImageRef, evidencePath: resolvedEvidencePath, port, projectName, settingsPersistence, upgradedRuntime }) => {
    const candidateSummary = candidateImageRef ?? 'local workspace image build';
    const healthSummary = upgradedRuntime.healthBody.service ?? (upgradedRuntime.healthBody.ok === true ? 'ok' : 'unknown');
    const evidenceSummary = resolvedEvidencePath ? `; evidence ${resolvedEvidencePath}` : '';
    return `Docker upgrade smoke passed from ${baselineImageRef} to ${candidateSummary} via project ${projectName} on http://127.0.0.1:${port}/healthz (${healthSummary} upgraded runtime; persisted settings log level ${settingsPersistence.observedLogLevel}; ${upgradedRuntime.migrationCheckOutput}${evidenceSummary})`;
  },
  run: async () => {
    const result = await validateDockerUpgradePath({
      baselineImageRef: getRequiredBaselineImageRef(),
      buildCandidateImage: getOptionalCandidateImageRef() ? false : true,
      candidateImageRef: getOptionalCandidateImageRef(),
    });
    const evidence = await writeDockerSmokeEvidence({
      evidencePath,
      validationKind: 'upgrade-path',
      validationResult: result,
    });

    return {
      ...result,
      evidencePath: evidence?.evidencePath ?? null,
    };
  },
});