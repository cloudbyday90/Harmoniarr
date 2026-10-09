/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function isUnconfirmedExecutionItem(item) {
  if (item?.planningSnapshot?.execution?.handoff?.state === 'not_dispatched') return false;
  return item?.itemStatus === 'awaiting_confirmation'
    || ['dispatching', 'awaiting_confirmation'].includes(item?.planningSnapshot?.execution?.handoff?.state);
}
