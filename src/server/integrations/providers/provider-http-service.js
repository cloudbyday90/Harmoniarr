/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { startDeadlineTask } from '../../deadline-task-service.js';
import { withWorkerTaskCleanup } from '../../worker-task-cleanup.js';
import { createProviderHttpsTransport } from './provider-https-transport.js';
import { createProviderFetchTransport } from './provider-fetch-transport.js';
import { captureProviderHttpRequest, hasProviderProxy } from './provider-http-policy.js';
import { createProviderRequestError, classifyProviderHttpError, parseProviderRetryAfter } from './provider-request-error.js';

export function createProviderHttpService({ fetchFn = globalThis.fetch,
  transport = fetchFn === globalThis.fetch ? createProviderHttpsTransport() : createProviderFetchTransport(fetchFn), maxActive = 4, maxTimeoutMs = 60_000, env = process.env } = {}) {
  if (!Number.isSafeInteger(maxActive) || maxActive < 1 || maxActive > 4 || !Number.isSafeInteger(maxTimeoutMs) || maxTimeoutMs < 1 || maxTimeoutMs > 60_000) throw new TypeError('A bounded provider request policy is required');
  const active = new Set(); let closed = false, sealed = false, closing;
  function request(input) {
    const { provider, oauth = false, signal, beforeRequest } = input;
    const failure = kind => createProviderRequestError(provider, kind, { oauth });
    let accepted;
    try { accepted = captureProviderHttpRequest(input); }
    catch { return Promise.reject(failure('request_rejected')); }
    if (closed || sealed || active.size >= maxActive) return Promise.reject(failure('unavailable'));
    if (transport.kind === 'native' && hasProviderProxy(env)) return Promise.reject(failure('request_rejected'));
    accepted.timeoutMs = Math.min(accepted.timeoutMs, maxTimeoutMs);
    const controller = new AbortController();
    const task = startDeadlineTask(async scope => {
      let owner;
      return withWorkerTaskCleanup(async () => {
        scope.check(); await beforeRequest?.(); scope.check();
        owner = transport.startRequest(accepted.url, { ...accepted, headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate, br',
          ...accepted.headers, ...(accepted.body ? { 'Content-Length': String(accepted.body.length) } : {}) }, signal: scope.signal, check: scope.check });
        const response = await owner.result; scope.check();
        let parsed;
        if (response.status >= 200 && response.status < 300 && accepted.empty) return {};
        try {
          if (!Buffer.isBuffer(response.body) || response.body.length > accepted.maxBytes) throw failure('response_invalid');
          parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.body));
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw failure('response_invalid');
        } catch { if (response.status >= 200 && response.status < 300) throw failure('response_invalid'); }
        if (response.status < 200 || response.status >= 300) throw classifyProviderHttpError({ provider, status: response.status, body: parsed,
          retryAfterSeconds: parseProviderRetryAfter(response.headers.get('retry-after')), oauth });
        scope.check(); return parsed;
      }, async () => {
        if (owner) {
          let safe = false;
          try { safe = await owner.drained === true; } catch { /* Seal future admission if retirement cannot be established. */ }
          if (!safe) { scope.markRetirementUncertain(); throw failure('unavailable'); }
        }
      });
    }, { timeoutMs: accepted.timeoutMs, signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal, createTimeoutError: () => failure('timeout') });
    const entry = { controller, drained: task.drained }; active.add(entry);
    void task.drained.then(safe => { active.delete(entry); if (!safe) sealed = true; });
    return task.result.catch(error => {
      if (error?.diagnosticCode) throw createProviderRequestError(provider, error.diagnosticCode, { ...error.details, oauth });
      const reason = error?.transportFailure;
      throw failure(reason === 'timeout' ? 'timeout' : ['oversized', 'invalid'].includes(reason) ? 'response_invalid' : 'unavailable');
    });
  }
  function close() {
    if (closing) return closing;
    closed = true; for (const entry of active) entry.controller.abort();
    closing = Promise.all([...active].map(entry => entry.drained)).then(() => { if (sealed) throw new Error('Provider request retirement is uncertain'); }); return closing;
  }
  return { request, close, waitForDrain: () => Promise.all([...active].map(entry => entry.drained)).then(values => !sealed && values.every(Boolean)),
    getState: () => ({ active: active.size, closed, sealed }) };
}
