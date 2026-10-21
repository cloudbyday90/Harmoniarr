/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { nextTick } from 'vue';
import { createUserCommandFocusTracker } from '../lib/user-command-focus.js';

export function useMetadataHistoryFocus(loadPage, { getCompletionTarget, getDocument = () => globalThis.document }) {
  return async (...args) => {
    const document = getDocument();
    const invoker = document?.activeElement;
    const focus = createUserCommandFocusTracker({ document });
    try {
      const result = await loadPage(...args);
      await nextTick();
      if (!result?.isCurrent() || !focus.ownsFocus()) return result;
      const target = result.kind === 'loaded' && !result.hasMore ? getCompletionTarget() : invoker;
      if (target?.isConnected && !target.disabled && document.activeElement !== target) target.focus({ preventScroll: target === invoker });
      return result;
    } finally {
      focus.dispose();
    }
  };
}
