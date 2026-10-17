/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { AsyncLocalStorage } from 'node:async_hooks';

const phaseContext = new AsyncLocalStorage();
const scopeFactories = new WeakMap();

const phases = new Set(['container_start', 'container_stop', 'database_connect', 'database_create',
  'pool_create', 'schema_prepare', 'fixture_seed', 'application_create', 'scenario_work',
  'http_scenario', 'http_request', 'pool_close', 'backend_drain', 'app_worker_drain', 'database_drop', 'admin_close',
  'workspace_create', 'workspace_remove', 'server_start', 'server_close', 'shutdown_drain',
  'template_prepare', 'template_seal', 'template_verify', 'template_drop',
  'database_register', 'database_release', 'media_tooling', 'media_image_inspect', 'media_version',
  'runtime_setup', 'runtime_cleanup']);
const isUuid = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value);

export function createFixturePhaseObserver({ enabled = true, onRecord = null,
  now = () => performance.now(), correlationId = randomUUID(), parentId = null } = {}) {
  if (typeof enabled !== 'boolean' || (onRecord !== null && typeof onRecord !== 'function')
    || typeof now !== 'function' || !isUuid(correlationId) || (parentId !== null && !isUuid(parentId))) {
    throw new TypeError('Invalid fixture phase observer options');
  }
  let sequence = 0;

  function execute(phase, operation, scope = phaseContext.getStore()?.scope) {
    if (!phases.has(phase) || typeof operation !== 'function') throw new TypeError('Invalid fixture phase operation');
    return phaseContext.run({ correlationId, phase, scope }, operation);
  }

  function readClock() {
    try { const value = now(); return Number.isFinite(value) ? value : null; }
    catch { return null; }
  }

  function publish(phase, outcome, started) {
    const ended = readClock();
    if (started === null || ended === null || ended < started || !onRecord) return;
    const record = Object.freeze({ version: 1, correlationId, parentId, sequence: ++sequence,
      phase, outcome, durationMs: ended - started });
    try { Promise.resolve(onRecord(record)).catch(() => {}); }
    catch { /* Optional observation must not alter the measured operation. */ }
  }

  async function measure(phase, operation) {
    if (!phases.has(phase) || typeof operation !== 'function') throw new TypeError('Invalid fixture phase operation');
    if (!enabled) return execute(phase, operation);
    const started = readClock();
    let outcome = 'passed';
    try { return await execute(phase, operation); }
    catch (error) {
      try { outcome = error?.name === 'AbortError' ? 'cancelled' : 'failed'; }
      catch { outcome = 'failed'; }
      throw error;
    } finally { publish(phase, outcome, started); }
  }

  function child() {
    return createFixturePhaseObserver({ enabled, onRecord, now, parentId: correlationId });
  }

  function currentPhase() {
    const context = phaseContext.getStore();
    return context?.correlationId === correlationId && context.scope?.active !== false ? context.phase : undefined;
  }

  const observer = { measure, child, correlationId, currentPhase };
  scopeFactories.set(observer, phase => {
    if (!phases.has(phase)) throw new TypeError('Invalid fixture phase scope');
    const scope = { active: true };
    return Object.freeze({ run: operation => execute(phase, operation, scope),
      finish: () => { scope.active = false; } });
  });
  return observer;
}

/** Only factory-owned observers may establish an explicitly retired boundary. */
export function createFixturePhaseScope(observer, phase) {
  return scopeFactories.get(observer)?.(phase) ?? null;
}

export function createIntegrationFixturePhaseObserver({ env = process.env,
  onRecord = (record) => { process.stderr.write(`[fixture-phase] ${JSON.stringify(record)}\n`); } } = {}) {
  const setting = env.HARMONIARR_INTEGRATION_PHASE_TIMINGS;
  if (![undefined, '', '0', 'false', '1', 'true'].includes(setting)) {
    throw new TypeError('HARMONIARR_INTEGRATION_PHASE_TIMINGS must be 0, 1, false or true');
  }
  return createFixturePhaseObserver({ enabled: setting === '1' || setting === 'true', onRecord });
}
