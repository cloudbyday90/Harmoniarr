/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { validateDockerFreshInstall } from './docker-smoke-validation.js';
import { getOptionalDockerSmokeEvidencePath, writeDockerSmokeEvidence } from './docker-smoke-evidence.js';
import { runDirectScriptTask } from './script-runtime.js';

const evidencePath = getOptionalDockerSmokeEvidencePath();

function getRequiredImageRef(env = process.env) {
  const imageRef = env.HARMONIARR_IMAGE?.trim();

  if (!imageRef) {
    throw new Error('HARMONIARR_IMAGE must point to the published immutable image reference to validate');
  }

  return imageRef;
}

await runDirectScriptTask(import.meta, {
    prefix: 'harmoniarr-validate-docker-released-image',
    renderSuccessMessage: ({ backupRestoreFlow, embeddedPostgresPersistence, existingDataRestart, evidencePath: resolvedEvidencePath, freshInstall, imageRef, port, projectName, startupFailure }) => {
      const freshSummary = freshInstall.healthBody.service ?? (freshInstall.healthBody.ok === true ? 'ok' : 'unknown');
      const restartSummary = existingDataRestart?.healthBody.service ?? (existingDataRestart?.healthBody.ok === true ? 'ok' : 'unknown');
      const recoverySummary = backupRestoreFlow
        ? `backup artifact ${backupRestoreFlow.backupArtifactId} restore-apply ${backupRestoreFlow.restoreApplyStatus}`
        : 'backup and restore validation skipped';
      const persistenceSummary = embeddedPostgresPersistence
        ? `embedded PostgreSQL persisted probe ${embeddedPostgresPersistence.probeKey}`
        : 'embedded PostgreSQL persistence verification skipped';
      const startupFailureSummary = startupFailure
        ? `startup refusal verified (${startupFailure.serviceStatus}; exit ${startupFailure.serviceExitCode})`
        : 'startup refusal verification skipped';
      const evidenceSummary = resolvedEvidencePath ? `; evidence ${resolvedEvidencePath}` : '';
      return `Released image smoke passed for ${imageRef} via project ${projectName} on http://127.0.0.1:${port}/healthz (${freshSummary} fresh install with snapshot bootstrap; ${freshInstall.mediaTooling.ffmpegVersion}; ${freshInstall.mediaTooling.ffprobeVersion}; ${restartSummary} existing-data restart without snapshot bootstrap; embedded PostgreSQL ready as ${freshInstall.embeddedPostgres.databaseName}/${freshInstall.embeddedPostgres.user}; ${freshInstall.migrationCheckOutput}; ${recoverySummary}; ${persistenceSummary}; ${startupFailureSummary}${evidenceSummary})`;
    },
    run: async () => {
      const result = await validateDockerFreshInstall({
        buildImage: false,
        imageRef: getRequiredImageRef(),
        verifyBackupRestoreFlow: true,
        verifyExistingDataRestart: true,
      });
      const evidence = await writeDockerSmokeEvidence({
        evidencePath,
        validationKind: 'released-image',
        validationResult: result,
      });

      return {
        ...result,
        evidencePath: evidence?.evidencePath ?? null,
      };
    },
  });
