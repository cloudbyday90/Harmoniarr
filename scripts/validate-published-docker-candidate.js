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
import { validatePublishedDockerCandidateAcceptance } from './published-docker-candidate-acceptance.js';

export const publishedCandidateHelp = 'Usage: node scripts/validate-published-docker-candidate.js --candidate-image <ghcr-digest-ref> --baseline-image <ghcr-digest-ref> --candidate-revision <commit-sha> --baseline-revision <commit-sha> --baseline-release-tag <published-tag> --evidence-path <new-json-file> [--repository <owner/repo>]\nVerifies live GitHub provenance and an explicitly selected published baseline before isolated fresh/restart/upgrade acceptance. Requires authenticated gh and registry access. No local-image, imported-proof, or verification-skip mode.';

export function parsePublishedCandidateOptions(args = process.argv.slice(2)) {
  let values;
  try {
    ({ values } = parseStrictScriptOptions({ help: { type: 'boolean' }, repository: { type: 'string' },
      'candidate-image': { type: 'string' }, 'baseline-image': { type: 'string' },
      'candidate-revision': { type: 'string' }, 'baseline-revision': { type: 'string' },
      'baseline-release-tag': { type: 'string' }, 'evidence-path': { type: 'string' },
    }, { args }));
  } catch { throw new Error('Unsupported published candidate options; use --help'); }
  if (values.help) return { help: true };
  for (const key of ['candidate-image', 'baseline-image', 'candidate-revision', 'baseline-revision', 'baseline-release-tag', 'evidence-path']) {
    if (typeof values[key] !== 'string' || !values[key].trim()) throw new Error(`--${key} is required`);
  }
  return { candidateImageRef: values['candidate-image'], baselineImageRef: values['baseline-image'],
    candidateRevision: values['candidate-revision'], baselineRevision: values['baseline-revision'],
    baselineReleaseTag: values['baseline-release-tag'], repository: values.repository ?? 'cloudbyday90/Harmoniarr',
    evidencePath: values['evidence-path'] };
}

export async function runPublishedCandidateCommand({ args = process.argv.slice(2),
  validate = validatePublishedDockerCandidateAcceptance, onProgress = () => {} } = {}) {
  const options = parsePublishedCandidateOptions(args);
  if (options.help) return options;
  let output;
  try {
    await mkdir(dirname(options.evidencePath), { recursive: true });
    output = await open(options.evidencePath, 'wx', 0o600);
  } catch { throw new Error('Select a new writable published candidate evidence file'); }
  let result;
  let failed = false;
  try {
    result = await validate({ ...options, onProgress });
    if (result?.status !== 'passed' || result.validationKind !== 'published-candidate-acceptance'
      || result.provenanceVerified !== true || result.publishedBaselineVerified !== true
      || result.cleanupVerified !== true) throw new Error('Incomplete published acceptance');
    await output.writeFile(`${JSON.stringify(result, null, 2)}\n`);
  } catch { failed = true; }
  finally { try { await output.close(); } catch { failed = true; } }
  if (failed) throw new Error('Published candidate verification, runtime acceptance, or evidence writing failed; no release acceptance was established');
  return result;
}

await runDirectScriptTask(import.meta, {
  prefix: 'published-candidate',
  run: () => runPublishedCandidateCommand({ onProgress: (stage) => process.stdout.write(`[published-candidate] ${stage}\n`) }),
  renderSuccessMessage: (result) => result.help ? publishedCandidateHelp
    : 'Published candidate runtime acceptance passed with verified provenance; baseline publication was checked, and release approval remains separate',
});
