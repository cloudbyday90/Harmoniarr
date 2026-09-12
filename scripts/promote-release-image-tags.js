/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createReleaseImagePromotionPlan, projectReleaseImagePromotion, readReleaseTagWorkflowInputs } from './release-image-tag-plan.js';
import { promoteReleaseImageTags } from './release-image-tag-service.js';
import { parseStrictScriptOptions } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';

export const releaseImageTagPromotionHelp = 'Usage: node scripts/promote-release-image-tags.js [--help]\nRequires dispatched repository/source/release inputs, HARMONIARR_IMAGE digest, optional HARMONIARR_DOCKERHUB_IMAGE_NAME, and a new HARMONIARR_TAG_PROMOTION_EVIDENCE_PATH. Promotes the supplied manifest bytes to deterministic release aliases. Runtime acceptance and provenance checks belong to prior workflow gates. There is no atomic multi-tag update or automatic rollback.';

export async function runReleaseImageTagPromotionCommand({ args = process.argv.slice(2), env = process.env, promote = promoteReleaseImageTags } = {}) {
  let values;
  try { ({ values } = parseStrictScriptOptions({ help: { type: 'boolean' } }, { args })); }
  catch { throw new Error('Unsupported image tag promotion options; use --help'); }
  if (values.help) return { help: true };
  const inputs = { ...readReleaseTagWorkflowInputs(env), imageRef: env.HARMONIARR_IMAGE };
  const plan = createReleaseImagePromotionPlan(inputs);
  const evidencePath = env.HARMONIARR_TAG_PROMOTION_EVIDENCE_PATH;
  if (typeof evidencePath !== 'string' || !evidencePath.trim()) throw new Error('A new image tag promotion evidence path is required');
  let output;
  try { await mkdir(dirname(evidencePath), { recursive: true }); output = await open(evidencePath, 'wx', 0o600); }
  catch { throw new Error('Select a new writable image tag promotion evidence file'); }
  let result;
  let failed = false;
  try {
    result = projectReleaseImagePromotion(await promote(inputs, { env }), plan);
    await output.writeFile(`${JSON.stringify(result, null, 2)}\n`);
  } catch {
    failed = true;
    try { await output.truncate(0); } catch { /* Failure remains fatal. */ }
  } finally { try { await output.close(); } catch { failed = true; } }
  if (failed) throw new Error('Image promotion or evidence writing failed; aliases may have changed and require inspection');
  return result;
}

await runDirectScriptTask(import.meta, {
  prefix: 'release-image-tag-promotion', run: () => runReleaseImageTagPromotionCommand(),
  renderSuccessMessage: (result) => result.help ? releaseImageTagPromotionHelp : 'Release image aliases promoted and verified against the supplied digest',
});
