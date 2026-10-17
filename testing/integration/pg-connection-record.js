/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isCheckoutCorrelationId, readCheckoutProperty } from './pool-checkout-record.js';
import { buildPgStartupWriteRecord } from './pg-startup-write-record.js';

const stages = new Set(['constructed', 'transport_connected', 'tls_stream_created', 'tls_connected',
  'startup_dispatched', 'authentication_requested', 'authentication_accepted', 'backend_ready']);
const fields = ['constructedMs', 'transportConnectedMs', 'tlsStreamCreatedMs', 'tlsConnectedMs',
  'startupDispatchedMs', 'authenticationRequestedMs', 'authenticationAcceptedMs', 'backendReadyMs'];

export function buildPgConnectionRecord(input) {
  const read = key => readCheckoutProperty(input, key);
  const observation = read('observation'); const clientId = read('clientId');
  const targetMatch = read('targetMatch'); const lastStage = read('lastStage');
  const timings = Object.fromEntries(fields.map(key => {
    const value = read(key);
    return [key, Number.isFinite(value) && value >= 0 && value <= 86_400_000 ? value : null];
  }));
  return Object.freeze({
    version: 2,
    observation: ['observed', 'not_observed', 'unsupported_driver', 'adapter_unavailable'].includes(observation)
      ? observation : 'not_observed',
    clientId: isCheckoutCorrelationId(clientId) ? clientId : null,
    targetMatch: ['matched', 'mismatched'].includes(targetMatch) ? targetMatch : 'unavailable',
    lastStage: stages.has(lastStage) ? lastStage : 'unknown',
    ...timings,
    startupWrite: buildPgStartupWriteRecord(read('startupWrite')),
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
