/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isDockerProviderReadinessOnly,
  providerAcceptanceReadinessOnlyEnvVar,
  resolveDockerProviderAcceptanceRequirements,
} from '../../scripts/docker-provider-acceptance-requirements.js';

test('resolveDockerProviderAcceptanceRequirements preserves the default acceptance contract', () => {
  const requirements = resolveDockerProviderAcceptanceRequirements({
    env: {},
    values: {},
  });

  assert.deepEqual(requirements, {
    requireAcceptedTransfer: false,
    requireConfiguredProvider: true,
    requireDiagnostic: true,
    requireMusicQueueLink: false,
    requirePathMapping: true,
  });
  assert.equal(isDockerProviderReadinessOnly(requirements), false);
});

test('resolveDockerProviderAcceptanceRequirements selects only safe prerequisites in readiness-only mode', () => {
  const requirements = resolveDockerProviderAcceptanceRequirements({
    env: {
      [providerAcceptanceReadinessOnlyEnvVar]: 'true',
    },
    values: {},
  });

  assert.deepEqual(requirements, {
    requireAcceptedTransfer: false,
    requireConfiguredProvider: true,
    requireDiagnostic: false,
    requireMusicQueueLink: false,
    requirePathMapping: true,
  });
  assert.equal(isDockerProviderReadinessOnly(requirements), true);
});

test('readiness-only mode rejects strict execution requirements and disabled setup prerequisites', () => {
  assert.throws(
    () => resolveDockerProviderAcceptanceRequirements({
      env: {},
      values: {
        'readiness-only': true,
        'require-accepted-transfer': true,
      },
    }),
    /--readiness-only cannot be combined with --require-accepted-transfer/u,
  );

  assert.throws(
    () => resolveDockerProviderAcceptanceRequirements({
      env: {
        HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_REQUIRE_MUSIC_QUEUE_LINK: 'true',
        [providerAcceptanceReadinessOnlyEnvVar]: 'true',
      },
      values: {},
    }),
    /--readiness-only cannot be combined with --require-music-queue-link/u,
  );

  assert.throws(
    () => resolveDockerProviderAcceptanceRequirements({
      env: {},
      values: {
        'require-path-mapping': false,
        'readiness-only': true,
      },
    }),
    /--readiness-only requires provider configuration and path mapping; remove --no-require-path-mapping/u,
  );
});
