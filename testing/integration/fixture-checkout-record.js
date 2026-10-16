/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { buildPoolCheckoutRecord, isCheckoutCorrelationId } from './pool-checkout-record.js';
import { buildPgConnectionRecord } from './pg-connection-record.js';
import { buildPgAcquisitionRecord } from './pg-acquisition-record.js';

const phases = new Set(['schema_prepare', 'template_prepare', 'fixture_seed', 'application_create',
  'scenario_work', 'http_scenario', 'app_worker_drain', 'shutdown_drain']);

export function buildFixtureCheckoutRecord({ checkoutId, poolKind, phase, connection, acquisition, ...input }) {
  const base = buildPoolCheckoutRecord(input);
  return Object.freeze({ ...base, version: 3, kind: 'owned_pool_checkout',
    checkoutId: isCheckoutCorrelationId(checkoutId) ? checkoutId : null,
    poolKind: ['scenario_pool', 'application_pool'].includes(poolKind) ? poolKind : 'unknown',
    phase: phases.has(phase) ? phase : 'unknown', lastServerPhase: 'unknown',
    connection: buildPgConnectionRecord(connection),
    acquisition: buildPgAcquisitionRecord(acquisition),
  });
}
