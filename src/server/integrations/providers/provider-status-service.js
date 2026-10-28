/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from '../../api-error.js';
import { normalizeDatabaseConnectionError } from '../../database-error-mapper.js';

const providers = { plex: 'plex', spotify: 'spotify', youtube: 'youtube', appleMusic: 'apple_music' };
const lookupFailures = new Set(['database_unavailable', 'auth_lookup_unavailable', 'session_lookup_unavailable']);
function isSharedFailure(error) {
  return lookupFailures.has(error?.code) || !Object.is(normalizeDatabaseConnectionError(error), error);
}
function databaseUnavailable() {
  return createApiError(503, 'database_unavailable', 'Database is temporarily unavailable');
}

/** Aggregate observations only. Commands and native read lifetimes remain with their owners. */
export function createProviderStatusService({ readers = {} } = {}) {
  for (const [key, reader] of Object.entries(readers)) {
    if (!Object.hasOwn(providers, key) || typeof reader !== 'function') throw new TypeError('Unsupported provider status reader');
  }
  const entries = Object.keys(providers).filter(key => Object.hasOwn(readers, key)).map(key => [key, readers[key]]);
  async function buildStatuses({ queryable } = {}) {
    let outcomes;
    if (queryable === undefined) {
      outcomes = await Promise.allSettled(entries.map(([, read]) => Promise.resolve().then(() => read())));
      if (outcomes.some(outcome => outcome.status === 'rejected' && isSharedFailure(outcome.reason))) throw databaseUnavailable();
    } else {
      outcomes = [];
      for (const [, read] of entries) {
        try { outcomes.push({ status: 'fulfilled', value: await read(queryable) }); }
        catch (error) {
          if (isSharedFailure(error)) throw databaseUnavailable();
          outcomes.push({ status: 'rejected' });
        }
      }
    }
    const statuses = {}, unavailableProviders = [];
    for (let index = 0; index < entries.length; index++) {
      const [key] = entries[index], outcome = outcomes[index];
      if (outcome.status === 'fulfilled') statuses[key] = outcome.value;
      else {
        statuses[key] = { provider: providers[key], availability: 'unavailable', code: 'provider_status_unavailable' };
        unavailableProviders.push(key);
      }
    }
    const state = !unavailableProviders.length ? 'complete' : unavailableProviders.length === entries.length ? 'unavailable' : 'partial';
    return { ...statuses, statusSummary: { state, unavailableProviders } };
  }
  return { buildStatuses };
}
