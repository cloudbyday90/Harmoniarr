/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseStrictScriptOptions } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';
import { validateDockerCandidateAcceptance } from './docker-candidate-acceptance.js';

export const dockerCandidateHelp = 'Usage: node scripts/validate-docker-candidate.js --candidate-image <digest-ref> --baseline-image <digest-ref> --candidate-revision <commit-sha> --baseline-revision <commit-sha> --evidence-path <new-json-file> [--allow-local-images]\nTests isolated fresh installation, restart and upgrade of immutable images. Local image IDs require explicit opt-in. Source labels are checked; registry provenance and accepted baseline status require separate verification.';

export function parseDockerCandidateOptions(args = process.argv.slice(2)) {
  let values;
  try {
    ({ values } = parseStrictScriptOptions({ help: { type: 'boolean' }, 'allow-local-images': { type: 'boolean' },
      'candidate-image': { type: 'string' }, 'baseline-image': { type: 'string' },
      'candidate-revision': { type: 'string' }, 'baseline-revision': { type: 'string' },
      'evidence-path': { type: 'string' } }, { args }));
  } catch { throw new Error('Unsupported candidate acceptance options; use --help'); }
  if (values.help) return { help: true };
  for (const key of ['candidate-image', 'baseline-image', 'candidate-revision', 'baseline-revision', 'evidence-path']) {
    if (typeof values[key] !== 'string' || !values[key].trim()) throw new Error(`--${key} is required`);
  }
  return { candidateImageRef: values['candidate-image'], baselineImageRef: values['baseline-image'],
    candidateRevision: values['candidate-revision'], baselineRevision: values['baseline-revision'],
    allowLocalImages: values['allow-local-images'] === true, evidencePath: values['evidence-path'] };
}

export async function runDockerCandidateCommand({ args = process.argv.slice(2), validate = validateDockerCandidateAcceptance,
  onProgress = () => {} } = {}) {
  const options = parseDockerCandidateOptions(args);
  if (options.help) return options;
  let output;
  try {
    await mkdir(dirname(options.evidencePath), { recursive: true });
    output = await open(options.evidencePath, 'wx', 0o600);
  } catch { throw new Error('Select a new writable candidate acceptance evidence file'); }
  let result;
  let failure;
  try {
    result = await validate({ ...options, onProgress });
    if (result?.status !== 'passed' || result.cleanupVerified !== true) throw new Error('Incomplete acceptance result');
    await output.writeFile(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    failure = error?.code === 'candidate_acceptance_failed' ? error : new Error('Candidate acceptance or evidence writing failed');
  } finally {
    try { await output.close(); } catch { failure = new Error('Candidate acceptance evidence could not be closed'); }
  }
  if (failure) throw failure;
  return result;
}

await runDirectScriptTask(import.meta, {
  prefix: 'immutable-candidate',
  run: () => runDockerCandidateCommand({ onProgress: (stage) => process.stdout.write(`[immutable-candidate] ${stage}\n`) }),
  renderSuccessMessage: (result) => result.help ? dockerCandidateHelp : `Immutable candidate acceptance passed (${result.artifactScope}); evidence saved and isolated fixture removed`,
});
