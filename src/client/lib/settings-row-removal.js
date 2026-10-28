/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createUserCommandFocusTracker } from './user-command-focus.js';

/** Remove synchronously; recover only the focus owned by the disappearing row. */
export async function removeSettingsRowWithFocus({ invoker, addButton, remove, afterUpdate }) {
  const card = invoker?.closest('.cfg-mapping-card'), document = card?.ownerDocument;
  const ownsFocus = Boolean(card && card.contains(document.activeElement));
  const focus = ownsFocus ? createUserCommandFocusTracker({ document }) : null;
  const targets = focus ? [card.nextElementSibling?.querySelector('input'), card.previousElementSibling?.querySelector('input'), addButton] : [];
  try {
    remove();
    if (!focus) return;
    await afterUpdate();
    if (invoker.isConnected || !focus.ownsFocus()) return;
    const target = targets.find(node => node?.isConnected && !node.disabled && node.getClientRects().length > 0);
    target?.focus();
  } finally { focus?.dispose(); }
}
