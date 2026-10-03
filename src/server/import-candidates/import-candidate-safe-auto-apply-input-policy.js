/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/** A measured download does not establish the quality of an older staging/reuse input. */
export async function assertSafeAutoApplyInputs({ applyPreview, statFn, resolveReusableSourcePath }) {
  if (!applyPreview.files?.length) {
    const error = new Error('A safe library add requires downloaded files.');
    error.code = 'import_candidate_apply_not_ready';
    throw error;
  }
  for (const file of applyPreview.files) {
    let stagingExists = file.stagingTarget?.exists === true;
    if (!stagingExists && file.stagingTarget?.path) {
      try { await statFn(file.stagingTarget.path); stagingExists = true; }
      catch (error) { if (error?.code !== 'ENOENT') throw error; }
    }
    if (stagingExists || file.recovery?.confirmedStageIntent || file.recovery?.confirmedFinalizeIntent
      || await resolveReusableSourcePath(file)) {
      const error = new Error('Existing staging or reusable files need their own audio verification before a safe library add.');
      error.code = 'safe_auto_alternate_input_requires_verification';
      throw error;
    }
  }
}
