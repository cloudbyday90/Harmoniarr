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

import { getBooleanInput, getOptionalStringInput, parseStrictScriptOptions } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';
import {
  renderManagedSlskdSmokeSuccessMessage,
  runManagedSlskdSmokeEvidence,
} from './managed-slskd-smoke-validation.js';

export const managedSlskdSmokeEvidencePathEnvVar = 'HARMONIARR_MANAGED_SLSKD_SMOKE_EVIDENCE_PATH';

export const validateManagedSlskdSmokeCliOptions = Object.freeze({
  build: { type: 'boolean' },
  'evidence-path': { type: 'string' },
  image: { type: 'string' },
});

export function resolveManagedSlskdSmokeInputs({
  args = process.argv.slice(2),
  env = process.env,
} = {}) {
  const { values } = parseStrictScriptOptions(validateManagedSlskdSmokeCliOptions, { args });
  const imageRef = getOptionalStringInput(values, 'image', 'HARMONIARR_MANAGED_SLSKD_SMOKE_IMAGE', env);

  return {
    buildImage: getBooleanInput(values, 'build', 'HARMONIARR_MANAGED_SLSKD_SMOKE_BUILD', env, !imageRef),
    evidencePath: getOptionalStringInput(values, 'evidence-path', managedSlskdSmokeEvidencePathEnvVar, env),
    imageRef,
  };
}

export async function runManagedSlskdSmokeFromEnvironment(env = process.env, {
  args = process.argv.slice(2),
} = {}) {
  return runManagedSlskdSmokeEvidence(resolveManagedSlskdSmokeInputs({ args, env }));
}

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-validate-managed-slskd-smoke',
  renderSuccessMessage: renderManagedSlskdSmokeSuccessMessage,
  run: () => runManagedSlskdSmokeFromEnvironment(),
});
