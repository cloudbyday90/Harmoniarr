/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { nextTick } from 'vue';
import { createUserCommandFocusTracker } from '../lib/user-command-focus.js';

export function useMetadataCommandFocus(command, errorMessage, { getDocument = () => globalThis.document } = {}) {
  return async (...args) => {
    const focus = createUserCommandFocusTracker({ document: getDocument() });
    try {
      const result = await command(...args);
      await nextTick();
      if (errorMessage.value) focus.restoreAfterFailure();
      return result;
    } finally {
      focus.dispose();
    }
  };
}
