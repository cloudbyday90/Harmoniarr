/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { appendFile } from 'node:fs/promises';
import { normalizePublishedImageInputs } from './published-image-provenance-policy.js';
import { runDirectScriptTask } from './script-runtime.js';

export function resolveReleaseBaseline(env = process.env) {
  const inputImage = env.HARMONIARR_INPUT_BASELINE_IMAGE || '';
  const inputRevision = env.HARMONIARR_INPUT_BASELINE_REVISION || '';
  const fromInput = Boolean(inputImage || inputRevision);
  const image = fromInput ? inputImage : env.HARMONIARR_DEFAULT_BASELINE_IMAGE || '';
  const revision = fromInput ? inputRevision : env.HARMONIARR_DEFAULT_BASELINE_REVISION || '';
  if (!image && !revision) return { enabled: false, image: '', revision: '' };
  if (!env.HARMONIARR_REPOSITORY) throw new Error('A GitHub repository is required');
  normalizePublishedImageInputs({ imageRef: image, revision, repository: env.HARMONIARR_REPOSITORY });
  return { enabled: true, image, revision };
}

export async function writeReleaseBaselinePlan(env = process.env) {
  const plan = resolveReleaseBaseline(env);
  if (!env.GITHUB_OUTPUT) throw new Error('GitHub output file is required');
  await appendFile(env.GITHUB_OUTPUT, `baseline_enabled=${plan.enabled}\nbaseline_image=${plan.image}\nbaseline_revision=${plan.revision}\n`);
  return plan;
}

await runDirectScriptTask(import.meta, {
  prefix: 'release-baseline',
  run: () => writeReleaseBaselinePlan(),
  renderSuccessMessage: (plan) => plan.enabled ? 'Baseline pair validated' : 'No upgrade baseline configured',
});
