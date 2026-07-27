/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDockerControlledProviderPipelineValidationInputs } from '../../scripts/docker-controlled-provider-pipeline-validation.js';

test('controlled-provider pipeline validation builds an isolated image by default', () => {
  assert.deepEqual(resolveDockerControlledProviderPipelineValidationInputs({ args: [], env: {} }), {
    buildImage: true,
    imageRef: null,
    noCache: false,
    startupTimeoutSeconds: 180,
  });
});

test('controlled-provider pipeline validation supports an explicit no-cache build', () => {
  assert.deepEqual(resolveDockerControlledProviderPipelineValidationInputs({ args: ['--no-cache'], env: {} }), {
    buildImage: true,
    imageRef: null,
    noCache: true,
    startupTimeoutSeconds: 180,
  });
});

test('controlled-provider pipeline validation requires a named image in no-build mode', () => {
  assert.throws(
    () => resolveDockerControlledProviderPipelineValidationInputs({ args: ['--no-build'], env: {} }),
    /--no-build requires HARMONIARR_CONTROLLED_PROVIDER_VALIDATION_IMAGE/u,
  );
});
