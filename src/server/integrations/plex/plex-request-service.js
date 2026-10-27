/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { startDeadlineTask } from '../../deadline-task-service.js';
import { withWorkerTaskCleanup } from '../../worker-task-cleanup.js';
import { createPlexHttpsTransport } from './plex-https-transport.js';
import { admitPlexDestination, decodePlexResponse, plexHttpError, plexOperationPolicy, plexRequestTimeoutMs, plexMaxActiveRequests } from './plex-http-policy.js';

export function createPlexRequestService({ transport = createPlexHttpsTransport(), timeoutMs = plexRequestTimeoutMs, maxActive = plexMaxActiveRequests } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > plexRequestTimeoutMs
    || !Number.isSafeInteger(maxActive) || maxActive < 1 || maxActive > plexMaxActiveRequests) throw new TypeError('Bounded Plex request policy is required');
  const active = new Set(); let closed = false, sealed = false, closing;
  function requestJson({ url, method, headers, operation, signal }) {
    if (closed || sealed) return Promise.reject(plexHttpError('closed'));
    if (active.size >= maxActive) return Promise.reject(plexHttpError('busy'));
    const destination = admitPlexDestination(url).href, policy = plexOperationPolicy(operation), acceptedHeaders = { ...headers };
    const controller = new AbortController();
    const task = startDeadlineTask(async scope => {
      let owner;
      return withWorkerTaskCleanup(async () => {
        scope.check(); owner = transport.startRequest(destination, { method, headers: acceptedHeaders, maxBytes: policy.bytes, signal: scope.signal, check: scope.check });
        const response = await owner.result; scope.check();
        const body = decodePlexResponse(response, operation); scope.check(); return body;
      }, async () => {
        if (owner) {
          let safe = false;
          try { safe = await owner.drained === true; } catch { /* Refuse publication and future admission. */ }
          if (!safe) { scope.markRetirementUncertain(); throw plexHttpError('unavailable'); }
        }
      });
    }, { signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal, timeoutMs, createTimeoutError: () => plexHttpError('timeout') });
    const entry = { controller, drained: task.drained }; active.add(entry);
    void task.drained.then(safe => { active.delete(entry); if (!safe) sealed = true; });
    return task.result.catch(error => {
      if (error?.status && (error.code?.startsWith('plex_request_') || [policy.invalid, policy.unauthorized, policy.failed].includes(error.code))) throw error;
      throw plexHttpError('unavailable');
    });
  }
  function close() {
    if (closing) return closing;
    closed = true; for (const entry of active) entry.controller.abort();
    closing = Promise.all([...active].map(entry => entry.drained)).then(() => { if (sealed) throw new Error('Plex request retirement is uncertain'); }); return closing;
  }
  return { requestJson, close, waitForDrain: () => Promise.all([...active].map(entry => entry.drained)).then(values => !sealed && values.every(Boolean)),
    getState: () => ({ active: active.size, closed, sealed }) };
}
