/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { appendGitHubOutputEntries } from './github-actions-output.js';
import { createReleaseDraftClient } from './release-draft-lifecycle-client.js';
import { normalizeReleaseDraftInputs, projectReleasePublication } from './release-draft-lifecycle-policy.js';
import { createReleaseDraftLifecycleService } from './release-draft-lifecycle-service.js';
import { parseStrictScriptOptions } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';

export const releaseDraftLifecycleHelp = 'Usage: node scripts/release-draft-lifecycle.js --mode prepare|finalize\nRequires a workflow_dispatch at the pre-existing release tag commit. Prepare creates or resumes an owned draft only; finalize validates four exact assets, publishes it, and verifies immutable release provenance. No published release edits, tag creation, clobber, deletion, or repository-setting mutation is provided.';

export function parseReleaseDraftLifecycleInputs({ args = process.argv.slice(2), env = process.env } = {}) {
  let values;
  try { ({ values } = parseStrictScriptOptions({ help: { type: 'boolean' }, mode: { type: 'string' } }, { args })); }
  catch { throw new Error('Unsupported release lifecycle options; use --help'); }
  if (values.help) return { help: true };
  if (!['prepare', 'finalize'].includes(values.mode)) throw new Error('A prepare or finalize lifecycle mode is required');
  const required = ['HARMONIARR_REPOSITORY', 'HARMONIARR_RELEASE_TAG', 'HARMONIARR_RELEASE_REVISION', 'HARMONIARR_RELEASE_POLICY_TOKEN'];
  if (values.mode === 'finalize') required.push('HARMONIARR_RELEASE_ID', 'HARMONIARR_RELEASE_ASSET_DIR', 'HARMONIARR_IMAGE', 'HARMONIARR_RELEASE_PUBLICATION_EVIDENCE_PATH');
  for (const key of required) if (typeof env[key] !== 'string' || !env[key].trim()) throw new Error(`${key} is required`);
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_SHA !== env.HARMONIARR_RELEASE_REVISION
    || env.GITHUB_REPOSITORY?.toLowerCase() !== env.HARMONIARR_REPOSITORY.toLowerCase()) {
    throw new Error('Release lifecycle must match the dispatched repository and source commit');
  }
  const releaseId = values.mode === 'finalize' && /^[1-9][0-9]*$/.test(env.HARMONIARR_RELEASE_ID) ? Number(env.HARMONIARR_RELEASE_ID) : null;
  if (values.mode === 'finalize' && releaseId === null) throw new Error('A numeric release identifier is required');
  return { ...normalizeReleaseDraftInputs({ repository: env.HARMONIARR_REPOSITORY, releaseTag: env.HARMONIARR_RELEASE_TAG,
    revision: env.HARMONIARR_RELEASE_REVISION, releaseId }), mode: values.mode,
    assetDirectory: env.HARMONIARR_RELEASE_ASSET_DIR, imageRef: env.HARMONIARR_IMAGE,
    evidencePath: env.HARMONIARR_RELEASE_PUBLICATION_EVIDENCE_PATH };
}

export async function runReleaseDraftLifecycleCommand({ args = process.argv.slice(2), env = process.env, service } = {}) {
  const inputs = parseReleaseDraftLifecycleInputs({ args, env });
  if (inputs.help) return inputs;
  const lifecycle = service ?? createReleaseDraftLifecycleService({ releaseClient: createReleaseDraftClient({ env }) });
  if (inputs.mode === 'prepare') {
    const result = await lifecycle.prepareRelease(inputs);
    if (!Number.isSafeInteger(result?.releaseId) || result.releaseId <= 0 || result.draft !== true
      || result.sourceRevision !== inputs.revision) throw new Error('Invalid prepared release evidence');
    await appendGitHubOutputEntries(env.GITHUB_OUTPUT, [{ name: 'release_id', value: result.releaseId }]);
    return result;
  }
  let output;
  try {
    await mkdir(dirname(inputs.evidencePath), { recursive: true });
    output = await open(inputs.evidencePath, 'wx', 0o600);
  } catch { throw new Error('Select a new writable release publication evidence file'); }
  let result;
  let failed = false;
  try {
    result = projectReleasePublication(await lifecycle.finalizeRelease(inputs), inputs);
    await output.writeFile(`${JSON.stringify(result, null, 2)}\n`);
    await appendGitHubOutputEntries(env.GITHUB_OUTPUT, [{ name: 'release_id', value: result.releaseId }]);
  } catch {
    failed = true;
    try { await output.truncate(0); } catch { /* Failure remains fatal. */ }
  } finally { try { await output.close(); } catch { failed = true; } }
  if (failed) throw new Error('Release finalization or evidence writing failed; inspect the release before retrying');
  return result;
}

await runDirectScriptTask(import.meta, {
  prefix: 'release-draft-lifecycle', run: () => runReleaseDraftLifecycleCommand(),
  renderSuccessMessage: (result) => result.help ? releaseDraftLifecycleHelp
    : result.draft ? 'Owned release draft prepared for verification' : 'Immutable release published and verified',
});
