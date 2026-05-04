/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { validateDockerFreshInstall } from './docker-smoke-validation.js';
import { runDirectScriptTask } from './script-runtime.js';

function getRequiredImageRef(env = process.env) {
  const imageRef = env.HARMONIARR_IMAGE?.trim();

  if (!imageRef) {
    throw new Error('HARMONIARR_IMAGE must point to the published immutable image reference to validate');
  }

  return imageRef;
}

await runDirectScriptTask(import.meta, {
    prefix: 'harmoniarr-validate-docker-released-image',
    renderSuccessMessage: ({ existingDataRestart, freshInstall, imageRef, port, projectName, startupFailure }) => {
      const freshSummary = freshInstall.healthBody.service ?? (freshInstall.healthBody.ok === true ? 'ok' : 'unknown');
      const restartSummary = existingDataRestart?.healthBody.service ?? (existingDataRestart?.healthBody.ok === true ? 'ok' : 'unknown');
      const startupFailureSummary = startupFailure
        ? `startup refusal verified (${startupFailure.serviceStatus}; exit ${startupFailure.serviceExitCode})`
        : 'startup refusal verification skipped';
      return `Released image smoke passed for ${imageRef} via project ${projectName} on http://127.0.0.1:${port}/healthz (${freshSummary} fresh install with snapshot bootstrap; ${freshInstall.mediaTooling.ffmpegVersion}; ${freshInstall.mediaTooling.ffprobeVersion}; ${restartSummary} existing-data restart without snapshot bootstrap; ${freshInstall.migrationCheckOutput}; ${startupFailureSummary})`;
    },
    run: () => validateDockerFreshInstall({
      buildImage: false,
      imageRef: getRequiredImageRef(),
      verifyExistingDataRestart: true,
    }),
  });
