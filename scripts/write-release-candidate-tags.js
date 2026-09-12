/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { appendGitHubOutputEntries } from './github-actions-output.js';
import { createReleaseCandidateTagPlan, readReleaseTagWorkflowInputs } from './release-image-tag-plan.js';
import { parseStrictScriptOptions } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';

export const releaseCandidateTagHelp = 'Usage: node scripts/write-release-candidate-tags.js [--help]\nUses dispatched repository/source/release inputs and GITHUB_RUN_ID/GITHUB_RUN_ATTEMPT to emit unique candidate tags. It does not write registry tags.';

export async function runReleaseCandidateTagCommand({ args = process.argv.slice(2), env = process.env } = {}) {
  let values;
  try { ({ values } = parseStrictScriptOptions({ help: { type: 'boolean' } }, { args })); }
  catch { throw new Error('Unsupported candidate tag options; use --help'); }
  if (values.help) return { help: true };
  const result = createReleaseCandidateTagPlan({ ...readReleaseTagWorkflowInputs(env), runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT });
  if (typeof env.GITHUB_OUTPUT !== 'string' || !env.GITHUB_OUTPUT.trim()) throw new Error('A GitHub output file is required for candidate tags');
  try {
    await appendGitHubOutputEntries(env.GITHUB_OUTPUT, [{ name: 'candidate_tag', value: result.candidateTag },
      { name: 'candidate_tags', value: result.candidateTags.join('\n') }]);
  } catch { throw new Error('Candidate tag outputs could not be written'); }
  return result;
}

await runDirectScriptTask(import.meta, {
  prefix: 'release-candidate-tags', run: () => runReleaseCandidateTagCommand(),
  renderSuccessMessage: (result) => result.help ? releaseCandidateTagHelp : 'Unique candidate image tags prepared for this workflow attempt',
});
