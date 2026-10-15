/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/** One cohort's explicit opt-in; validate before PostgreSQL or media startup. */
export function resolveLibraryAddMediaOptions(environment = process.env) {
  const mode = environment.HARMONIARR_LIBRARY_ADD_MEDIA_EXECUTION ?? 'per-command';
  const diagnostics = environment.HARMONIARR_LIBRARY_ADD_MEDIA_DIAGNOSTICS ?? 'off';
  const mediaImage = environment.HARMONIARR_INTEGRATION_MEDIA_IMAGE;
  if (!['per-command', 'owned-api'].includes(mode) || !['off', 'on'].includes(diagnostics)
    || (mode === 'owned-api' && !mediaImage?.trim())) throw new TypeError('Invalid library-add media selection');
  return { mode, mediaImage, diagnostics: diagnostics === 'on' };
}
