/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { nextTick } from 'vue';
import { usePasswordMatch } from './usePasswordMatch.js';

/** Link the existing match policy to an owned submit-time correction target. */
export function usePasswordConfirmation(getPassword, getConfirm, inputRef) {
  const match = usePasswordMatch(getPassword, getConfirm);
  async function validate() {
    if (match.isMatch.value) return true;
    const active = globalThis.document?.activeElement;
    match.markTouched();
    await nextTick();
    if (!match.isMatch.value && globalThis.document?.activeElement === active) inputRef.value?.focus();
    return false;
  }
  return { ...match, validate };
}
