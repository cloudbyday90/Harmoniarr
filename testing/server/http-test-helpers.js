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

export async function withServer(app, callback) {
  const server = await new Promise((resolve) => {
    const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
  });

  try {
    const address = server.address();
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}