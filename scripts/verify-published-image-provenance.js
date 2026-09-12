/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { normalizePublishedImageInputs, projectPublishedImageProvenance } from './published-image-provenance-policy.js';
import { verifyPublishedImageProvenance } from './published-image-provenance.js';
import { parseStrictScriptOptions } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';

export const publishedImageProvenanceHelp = 'Usage: node scripts/verify-published-image-provenance.js [--help]\nRequired environment: HARMONIARR_IMAGE (canonical GHCR digest), HARMONIARR_IMAGE_REVISION (full source commit), HARMONIARR_REPOSITORY (owner/repo), HARMONIARR_PROVENANCE_EVIDENCE_PATH (new file). Verifies live GitHub provenance before image execution. This proof does not claim runtime validation or release approval.';

export function parsePublishedImageProvenanceInputs({ args = process.argv.slice(2), env = process.env } = {}) {
  let values;
  try { ({ values } = parseStrictScriptOptions({ help: { type: 'boolean' } }, { args })); }
  catch { throw new Error('Unsupported image provenance options; use --help'); }
  if (values.help) return { help: true };
  for (const key of ['HARMONIARR_IMAGE', 'HARMONIARR_IMAGE_REVISION', 'HARMONIARR_REPOSITORY', 'HARMONIARR_PROVENANCE_EVIDENCE_PATH']) {
    if (typeof env[key] !== 'string' || !env[key].trim()) throw new Error(`${key} is required`);
  }
  const inputs = normalizePublishedImageInputs({ imageRef: env.HARMONIARR_IMAGE,
    revision: env.HARMONIARR_IMAGE_REVISION, repository: env.HARMONIARR_REPOSITORY });
  return { ...inputs, evidencePath: env.HARMONIARR_PROVENANCE_EVIDENCE_PATH };
}

export async function runPublishedImageProvenanceCommand({
  args = process.argv.slice(2), env = process.env, verify = verifyPublishedImageProvenance,
} = {}) {
  const inputs = parsePublishedImageProvenanceInputs({ args, env });
  if (inputs.help) return inputs;
  let output;
  try {
    await mkdir(dirname(inputs.evidencePath), { recursive: true });
    output = await open(inputs.evidencePath, 'wx', 0o600);
  } catch { throw new Error('Select a new writable image provenance evidence file'); }
  let evidence;
  let failed = false;
  try {
    evidence = projectPublishedImageProvenance(await verify(inputs, { env }), inputs);
    await output.writeFile(`${JSON.stringify(evidence, null, 2)}\n`);
  } catch {
    failed = true;
    try { await output.truncate(0); } catch { /* Failure remains fatal. */ }
  } finally {
    try { await output.close(); } catch { failed = true; }
  }
  if (failed) throw new Error('Published image provenance verification or evidence writing failed; no image execution is authorized');
  return evidence;
}

await runDirectScriptTask(import.meta, {
  prefix: 'published-image-provenance',
  run: () => runPublishedImageProvenanceCommand(),
  renderSuccessMessage: (result) => result.help ? publishedImageProvenanceHelp
    : 'Published image provenance verified for the exact digest, source commit and signing workflow',
});
