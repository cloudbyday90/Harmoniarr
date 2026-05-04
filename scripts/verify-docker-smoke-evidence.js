/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { verifyDockerSmokeEvidenceFile } from './docker-smoke-evidence.js';
import { getRequiredStringInput, parseStrictScriptOptions } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';

export const verifyDockerSmokeEvidenceCliOptions = Object.freeze({
  'evidence-path': { type: 'string' },
});

export function resolveDockerSmokeEvidenceVerificationInputs({
  args = process.argv.slice(2),
  env = process.env,
} = {}) {
  const { values } = parseStrictScriptOptions(verifyDockerSmokeEvidenceCliOptions, {
    allowPositionals: true,
    args,
  });

  return {
    evidencePath: getRequiredStringInput(values, 'evidence-path', 'HARMONIARR_DOCKER_SMOKE_EVIDENCE_PATH', env),
  };
}

export async function verifyDockerSmokeEvidenceFromEnvironment(env = process.env, {
  args = process.argv.slice(2),
  readFileFn,
} = {}) {
  const inputs = resolveDockerSmokeEvidenceVerificationInputs({ args, env });
  const evidence = await verifyDockerSmokeEvidenceFile(inputs.evidencePath, {
    readFileFn,
  });

  return {
    evidencePath: inputs.evidencePath,
    generatedAt: evidence.generatedAt,
    validationKind: evidence.validationKind,
  };
}

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-verify-docker-smoke-evidence',
  renderSuccessMessage: ({ evidencePath, validationKind }) => {
    return `Docker smoke evidence verified for ${validationKind} (${evidencePath})`;
  },
  run: () => verifyDockerSmokeEvidenceFromEnvironment(),
});