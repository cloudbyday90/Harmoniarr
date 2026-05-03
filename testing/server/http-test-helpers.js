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
} = {}) {
  const server = await withTimeout(
    () => new Promise((resolve) => {
      const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
    }),
    listenTimeoutMs,
    'HTTP test server startup',
  );

  try {
    const address = server.address();
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await withTimeout(
      () => new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
      closeTimeoutMs,
      'HTTP test server shutdown',
    );
  }
}
