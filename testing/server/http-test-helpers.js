/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import express from 'express';

function defaultJsonErrorHandler(error, _request, response, _next) {
  response.status(Number.isInteger(error?.status) ? error.status : 500).json({
    ok: false,
    error: {
      code: error?.code ?? 'internal_error',
      message: error?.message ?? 'Unexpected server error',
    },
  });
}

export function createJsonTestApp(registerRoutes, {
  errorHandler = defaultJsonErrorHandler,
} = {}) {
  const app = express();
  app.use(express.json());

  registerRoutes(app);
  app.use(errorHandler);

  return app;
}

function withTimeout(createPromise, timeoutMs, label) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timeoutId.unref?.();
  });

  return Promise.race([
    Promise.resolve().then(createPromise),
    timeoutPromise,
  ]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export async function withServer(app, callback, {
  closeTimeoutMs = 10_000,
  listenTimeoutMs = 10_000,
  phaseObserver = null,
} = {}) {
  const measure = (phase, run) => phaseObserver ? phaseObserver.measure(phase, run) : run();
  const server = await measure('server_start', () => withTimeout(
    () => new Promise((resolve) => {
      const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
    }),
    listenTimeoutMs,
    'HTTP test server startup',
  ));

  let scenarioFailed = false;
  let result; let failure;
  try {
    const address = server.address();
    result = await callback(`http://127.0.0.1:${address.port}`);
  } catch (error) {
    scenarioFailed = true;
    failure = error;
  }
  try {
    await measure('server_close', () => withTimeout(
      () => new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
        server.closeAllConnections?.();
      }),
      closeTimeoutMs,
      'HTTP test server shutdown',
    ));
  } catch (error) {
    if (!scenarioFailed) { scenarioFailed = true; failure = error; }
  }
  if (scenarioFailed) throw failure;
  return result;
}
