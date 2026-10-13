/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isCheckoutCorrelationId, readCheckoutProperty } from './pool-checkout-record.js';

const stages = new Set(['constructed', 'transport_connected', 'tls_stream_created', 'tls_connected',
  'startup_dispatched', 'authentication_requested', 'authentication_accepted', 'backend_ready']);
const fields = ['constructedMs', 'transportConnectedMs', 'tlsStreamCreatedMs', 'tlsConnectedMs',
  'startupDispatchedMs', 'authenticationRequestedMs', 'authenticationAcceptedMs', 'backendReadyMs'];

export function buildPgConnectionRecord(input) {
  const read = key => readCheckoutProperty(input, key);
  const timings = Object.fromEntries(fields.map(key => {
    const value = read(key);
    return [key, Number.isFinite(value) && value >= 0 && value <= 86_400_000 ? value : null];
  }));
  return Object.freeze({
    version: 1,
    observation: ['observed', 'not_observed', 'unsupported_driver', 'adapter_unavailable'].includes(read('observation'))
      ? read('observation') : 'not_observed',
    clientId: isCheckoutCorrelationId(read('clientId')) ? read('clientId') : null,
    targetMatch: ['matched', 'mismatched'].includes(read('targetMatch')) ? read('targetMatch') : 'unavailable',
    lastStage: stages.has(read('lastStage')) ? read('lastStage') : 'unknown',
    ...timings,
  });
}

/** Identity comparison only: no credentials, DNS equivalence or server identity claim. */
export function capturePgTargetIdentity(config) {
  const read = key => readCheckoutProperty(config, key);
  const host = read('host'); const port = read('port'); const user = read('user'); const database = read('database');
  if (![host, user, database].every(value => typeof value === 'string' && value.length > 0)
    || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return Object.freeze({ host, port, user, database });
}

export function comparePgTargetIdentity(client, expected) {
  const actual = capturePgTargetIdentity(client);
  if (!actual || !expected) return 'unavailable';
  return Object.keys(expected).every(key => actual[key] === expected[key]) ? 'matched' : 'mismatched';
}
