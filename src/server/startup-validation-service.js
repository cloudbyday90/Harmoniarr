/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { resolveBootstrapOwnerClaimConfig } from './bootstrap-owner-claim-service.js';
import { getPool } from './database.js';
import { createPathValidationService } from './paths/path-validation-service.js';
import { resolveSecretEncryptionKey, secretEncryptionKeyEnvVar } from './encrypted-secret-service.js';
import { loadSettings } from './settings.js';

function collectBlockingPathIssues(runtimePathValidation) {
  const issues = [];

  if (runtimePathValidation.appData.status !== 'healthy') {
    issues.push({
      label: runtimePathValidation.appData.label,
      message: runtimePathValidation.appData.message,
    });
  }

  for (const root of runtimePathValidation.settingsPathValidation.roots) {
    if (root.status !== 'healthy') {
      issues.push({
        label: root.label,
        message: root.message,
      });
    }
  }

  return issues;
}

function formatStartupValidationFailure(issues) {
  return `Startup validation failed: ${issues.map(({ label, message }) => `${label}: ${message}`).join(' ')}`;
}

export function createStartupValidationService({
  appDataPath = process.env.HARMONIARR_APPDATA ?? '/app/data',
  env = process.env,
  getPoolFn = getPool,
  loadSettingsFn = loadSettings,
  pathValidationService = createPathValidationService(),
  resolveBootstrapOwnerClaimConfigFn = resolveBootstrapOwnerClaimConfig,
  resolveSecretEncryptionKeyFn = resolveSecretEncryptionKey,
} = {}) {
  async function validateStartup() {
    resolveBootstrapOwnerClaimConfigFn(env);
    resolveSecretEncryptionKeyFn(env[secretEncryptionKeyEnvVar]);

    const queryable = getPoolFn();
    await queryable.query('SELECT 1');

    const settings = await loadSettingsFn(queryable);
    const runtimePathValidation = await pathValidationService.validateRuntimePaths({
      appDataPath,
      settings,
    });
    const blockingPathIssues = collectBlockingPathIssues(runtimePathValidation);

    return {
      blockingPathIssues,
      runtimePathValidation,
      settings,
    };
  }

  async function assertStartupReady() {
    const validation = await validateStartup();

    if (validation.blockingPathIssues.length > 0) {
      throw new Error(formatStartupValidationFailure(validation.blockingPathIssues));
    }

    return validation;
  }

  return {
    assertStartupReady,
    validateStartup,
  };
}