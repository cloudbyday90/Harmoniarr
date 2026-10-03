/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/** Tracks the initiating interaction while disabling/removing controls may blur them. */
export function createUserCommandFocusTracker({ document, returnTarget = null } = {}) {
  const initiator = document?.activeElement;
  let ownsFocus = Boolean(initiator && initiator !== document?.body);
  const isOwnedTarget = (target) => target === initiator || target === returnTarget;
  function onFocus(event) {
    if (event.target !== document.body && !isOwnedTarget(event.target)) ownsFocus = false;
  }
  document?.addEventListener('focusin', onFocus);
  return {
    ownsFocus: () => ownsFocus && (document.activeElement === document.body || isOwnedTarget(document.activeElement)),
    restoreAfterFailure() {
      if (ownsFocus && document.activeElement === document.body && initiator?.isConnected && !initiator.disabled) {
        initiator.focus({ preventScroll: true });
      }
    },
    dispose: () => document?.removeEventListener('focusin', onFocus),
  };
}
