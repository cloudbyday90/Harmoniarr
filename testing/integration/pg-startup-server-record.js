/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isCheckoutCorrelationId, readCheckoutProperty as read } from './pool-checkout-record.js';

export function buildPgStartupServerRecord(input) {
  const duration = key => { const n = read(input, key); return Number.isFinite(n) && n >= 0 && n <= 86_400_000 ? n : null; };
  const flags = Object.fromEntries(['clipped', 'receiptObserved', 'authenticationObserved', 'authorizationObserved', 'readyObserved']
    .map(key => [key, read(input, key) === true]));
  const outcome = read(input, 'outcome'); const clientId = read(input, 'clientId'); const stage = read(input, 'lastStage');
  const associated = outcome === 'associated' && isCheckoutCorrelationId(clientId) && flags.authorizationObserved;
  const ready = associated && stage === 'ready' && flags.readyObserved;
  const count = read(input, 'receiptRowsInWindow');
  return Object.freeze({ version: 1,
    outcome: associated ? 'associated' : ['unassociated', 'ambiguous', 'failed'].includes(outcome) ? outcome : 'unavailable',
    clientId: associated ? clientId : null,
    lastStage: ready ? 'ready' : associated ? 'authorization' : 'unknown',
    receiptRowsInWindow: Number.isInteger(count) && count >= 0 && count <= 256 ? count : null, clipped: flags.clipped,
    receiptObserved: associated && flags.receiptObserved, authenticationObserved: associated && flags.authenticationObserved,
    authorizationObserved: associated, readyObserved: ready,
    setupTotalMs: ready ? duration('setupTotalMs') : null, forkMs: ready ? duration('forkMs') : null,
    authenticationMs: ready ? duration('authenticationMs') : null,
  });
}
