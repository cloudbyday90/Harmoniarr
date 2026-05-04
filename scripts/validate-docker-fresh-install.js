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

await runDirectScriptTask(import.meta, {
    prefix: 'harmoniarr-validate-docker-fresh-install',
    renderSuccessMessage: ({ embeddedPostgresPersistence, evidencePath: resolvedEvidencePath, freshInstall, existingDataRestart, port, projectName, startupFailure }) => {
      const healthSummary = freshInstall.healthBody.service ?? (freshInstall.healthBody.ok === true ? 'ok' : 'unknown');
      const restartSummary = existingDataRestart?.healthBody.service ?? (existingDataRestart?.healthBody.ok === true ? 'ok' : 'unknown');
      const persistenceSummary = embeddedPostgresPersistence
        ? `embedded PostgreSQL persisted probe ${embeddedPostgresPersistence.probeKey}`
        : 'embedded PostgreSQL persistence verification skipped';
      const startupFailureSummary = startupFailure
        ? `startup refusal verified (${startupFailure.serviceStatus}; exit ${startupFailure.serviceExitCode})`
        : 'startup refusal verification skipped';
      const evidenceSummary = resolvedEvidencePath ? `; evidence ${resolvedEvidencePath}` : '';
      return `Docker fresh-install smoke passed for project ${projectName} on http://127.0.0.1:${port}/healthz (${healthSummary} fresh install; ${restartSummary} existing-data restart; read-only rootfs verified; ${freshInstall.mediaTooling.ffmpegVersion}; ${freshInstall.mediaTooling.ffprobeVersion}; embedded PostgreSQL ready as ${freshInstall.embeddedPostgres.databaseName}/${freshInstall.embeddedPostgres.user}; pending migrations ${freshInstall.healthBody.pendingMigrations}; ${freshInstall.migrationCheckOutput}; ${persistenceSummary}; ${startupFailureSummary}${evidenceSummary})`;
    },
    run: async () => {
      const result = await validateDockerFreshInstall({
        verifyExistingDataRestart: true,
      });
      const evidence = await writeDockerSmokeEvidence({
        evidencePath,
        validationKind: 'fresh-install',
        validationResult: result,
      });

      return {
        ...result,
        evidencePath: evidence?.evidencePath ?? null,
      };
    },
  });
