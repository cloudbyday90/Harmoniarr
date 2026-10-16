/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { readCheckoutProperty } from './pool-checkout-record.js';

export function buildPgAcquisitionRecord(input) {
  const read = key => readCheckoutProperty(input, key);
  return Object.freeze({
    version: 1,
    observation: ['observed', 'unsupported_driver', 'adapter_unavailable'].includes(read('observation'))
      ? read('observation') : 'not_observed',
    lastStage: ['queued', 'creating_client', 'acquire_entered', 'delivered'].includes(read('lastStage'))
      ? read('lastStage') : 'unknown',
    clientKind: ['new', 'reused'].includes(read('clientKind')) ? read('clientKind') : 'unavailable',
    ...Object.fromEntries(['queuedMs', 'newClientMs', 'acquireEnteredMs', 'deliveredMs'].map(key => {
      const value = read(key);
      return [key, Number.isFinite(value) && value >= 0 && value <= 86_400_000 ? value : null];
    })),
  });
}
