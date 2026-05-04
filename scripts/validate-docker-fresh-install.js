/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { validateDockerFreshInstall } from './docker-smoke-validation.js';
import { runDirectScriptTask } from './script-runtime.js';

await runDirectScriptTask(import.meta, {
    prefix: 'harmoniarr-validate-docker-fresh-install',
    renderSuccessMessage: ({ freshInstall, port, projectName, startupFailure }) => {
      const healthSummary = freshInstall.healthBody.service ?? (freshInstall.healthBody.ok === true ? 'ok' : 'unknown');
      const startupFailureSummary = startupFailure
        ? `startup refusal verified (${startupFailure.serviceStatus}; exit ${startupFailure.serviceExitCode})`
        : 'startup refusal verification skipped';
      return `Docker fresh-install smoke passed for project ${projectName} on http://127.0.0.1:${port}/healthz (${healthSummary}; read-only rootfs verified; ${freshInstall.mediaTooling.ffmpegVersion}; ${freshInstall.mediaTooling.ffprobeVersion}; pending migrations ${freshInstall.healthBody.pendingMigrations}; ${freshInstall.migrationCheckOutput}; ${startupFailureSummary})`;
    },
    run: () => validateDockerFreshInstall(),
  });
