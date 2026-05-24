import assert from 'node:assert/strict';
import test from 'node:test';
import { withServer } from './http-test-helpers.js';

const NAN_VALUES = ['abc', 'NaN', '', '1.5.3', 'null', 'undefined'];
const NEGATIVE_VALUES = ['-1', '-999'];

export function runPaginationRegressionTests(createApp, routeConfigs) {
  for (const { method = 'GET', path, params, pathParams = {} } of routeConfigs) {
    for (const paramName of params) {
      const badValues = [...NAN_VALUES, ...NEGATIVE_VALUES];

      for (const badValue of badValues) {
        const label = `${method} ${path} ?${paramName}=${badValue} returns 200 (not 500)`;

        test(label, async () => {
          const app = createApp();
          await withServer(app, async (baseUrl) => {
            const resolvedPath = Object.entries(pathParams).reduce(
              (acc, [key, value]) => acc.replace(`:${key}`, value),
              path,
            );

            const url = new URL(resolvedPath, baseUrl);
            url.searchParams.set(paramName, badValue);

            const response = await fetch(url, { method });
            assert.ok(
              response.status < 500,
              `Expected status < 500 for ?${paramName}=${badValue}, got ${response.status}`,
            );
          });
        });
      }
    }
  }
}
