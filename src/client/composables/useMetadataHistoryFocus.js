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
      if (!target?.isConnected || target.disabled) return result;
      if (document.activeElement !== target) target.focus({ preventScroll: target === invoker });
      // Appending can move an invoker that retained focus. Reveal it without
      // centering an already-visible button or following a redirected focus.
      if (result.kind === 'loaded' && target === invoker && result.isCurrent() && focus.ownsFocus() &&
          document.activeElement === target && target.isConnected && !target.disabled) {
        target.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
      }
      return result;
    } finally {
      focus.dispose();
    }
  };
}
