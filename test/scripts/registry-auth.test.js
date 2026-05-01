import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrasRegistryAuthArgs, resolveRegistryAuth } from '../../scripts/registry-auth.js';

test('resolveRegistryAuth enforces required credentials', () => {
  const registryBinding = {
    auth: {
      required: true,
      tokenEnvName: 'TOKEN',
      usernameEnvName: 'USER',
    },
    key: 'dockerHub',
  };

  assert.throws(() => resolveRegistryAuth(registryBinding, {}), /requires USER and TOKEN/);
  assert.deepEqual(resolveRegistryAuth(registryBinding, {
    TOKEN: 'secret',
    USER: 'alice',
  }), {
    password: 'secret',
    required: true,
    tokenEnvName: 'TOKEN',
    username: 'alice',
    usernameEnvName: 'USER',
  });
});

test('buildOrasRegistryAuthArgs renders prefixed ORAS auth flags', () => {
  assert.deepEqual(buildOrasRegistryAuthArgs({
    prefix: 'from',
    registryAuth: {
      password: 'secret',
      username: 'alice',
    },
  }), [
    '--from-username',
    'alice',
    '--from-password',
    'secret',
  ]);
});