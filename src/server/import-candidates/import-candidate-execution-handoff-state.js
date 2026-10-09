/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isUnresolvedPreProviderPreparation } from './import-execution-pre-provider-policy.js';

export function isUnconfirmedExecutionItem(item, run) {
  if (isUnresolvedPreProviderPreparation({ run: run && typeof run === 'object' ? run : { id: item?.operationRunId }, item })) return true;
  if (item?.planningSnapshot?.execution?.handoff?.state === 'not_dispatched') return false;
  return item?.itemStatus === 'awaiting_confirmation'
    || ['dispatching', 'awaiting_confirmation'].includes(item?.planningSnapshot?.execution?.handoff?.state);
}
