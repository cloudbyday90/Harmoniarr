/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getPublicApiError } from './api-error.js';
import { normalizeDatabaseConnectionError } from './database-error-mapper.js';
import { normalizeApiParsingError } from './http-hardening.js';

const internalError = Object.freeze({ status: 500, code: 'internal_error', message: 'Unexpected server error' });

export function buildHttpErrorResponse(error) {
  let publicError = getPublicApiError(error);
  if (!publicError) {
    try { publicError = getPublicApiError(normalizeDatabaseConnectionError(normalizeApiParsingError(error))); }
    catch { /* Unknown objects may throw from property getters; never project that failure. */ }
  }
  const { status, code, message } = publicError ?? internalError;
  return { status, body: { ok: false, error: { code, message } } };
}

export function createHttpErrorHandler() {
  return function httpErrorHandler(error, _request, response, next) {
    const { status, body } = buildHttpErrorResponse(error);
    if (response.headersSent) {
      // Express owns connection failure after a response starts. Do not forward private fields.
      return next(Object.assign(new Error(body.error.message), { status, code: body.error.code }));
    }
    response.setHeader('Cache-Control', 'no-store');
    return response.status(status).json(body);
  };
}
