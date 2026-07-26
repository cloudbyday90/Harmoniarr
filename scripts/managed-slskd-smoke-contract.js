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

import { randomBytes } from 'node:crypto';

export const managedSlskdSmokeValidationKind = 'managed-slskd';

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertObject(value, label) {
  assertCondition(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assertString(value, label) {
  assertCondition(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
}

function createSecretValue(randomBytesFn) {
  return randomBytesFn(32).toString('base64url');
}

export function createManagedSlskdSmokeSecrets({ randomBytesFn = randomBytes } = {}) {
  return {
    slskd_api_key: createSecretValue(randomBytesFn),
    slskd_jwt_key: createSecretValue(randomBytesFn),
    slskd_soulseek_password: createSecretValue(randomBytesFn),
    slskd_soulseek_username: `harmoniarr-smoke-${createSecretValue(randomBytesFn).slice(0, 12)}`,
    slskd_web_password: createSecretValue(randomBytesFn),
    slskd_web_username: 'harmoniarr-smoke',
  };
}

export function buildManagedSlskdApiProbeProgram() {
  return [
    "import { readFile } from 'node:fs/promises';",
    "const apiKey = (await readFile('/run/secrets/slskd_api_key', 'utf8')).trim();",
    "const response = await fetch('http://slskd:5030/api/v0/application', { headers: { Accept: 'application/json', 'X-API-Key': apiKey } });",
    "if (!response.ok) throw new Error('Managed provider API probe returned HTTP ' + response.status);",
    'const payload = await response.json();',
    "if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Managed provider API probe returned an invalid response');",
    'process.stdout.write(JSON.stringify({ status: response.status }) + \'\\n\');',
  ].join('\n');
}

export function assertManagedSlskdSmokeResult(result) {
  assertObject(result, 'managed slskd smoke result');
  assertObject(result.config, 'managed slskd smoke result.config');
  assertObject(result.harmoniarr, 'managed slskd smoke result.harmoniarr');
  assertObject(result.provider, 'managed slskd smoke result.provider');
  assertString(result.projectName, 'managed slskd smoke result.projectName');

  assertCondition(result.config.rendererExitCode === 0, 'Managed slskd config renderer must exit successfully');
  assertCondition(result.config.fileMode === '600', 'Managed slskd config file mode must be 600');
  assertCondition(result.config.remoteConfigurationDisabled === true, 'Managed slskd remote configuration must be disabled');
  assertCondition(result.harmoniarr.healthCheckOk === true, 'Harmoniarr health check must report success');
  assertCondition(result.provider.apiPortPublished === false, 'Managed slskd API port must not be host-published');
  assertCondition(result.provider.apiProbeStatus === 200, 'Managed slskd API probe must return HTTP 200');
  assertCondition(result.provider.egressIsolated === true, 'Managed slskd smoke must isolate provider egress');
  assertCondition(result.provider.healthStatus === 'healthy', 'Managed slskd container health must be healthy');

  return result;
}
