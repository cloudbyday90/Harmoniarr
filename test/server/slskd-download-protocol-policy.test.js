/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSlskdProviderBindingCurrent, createSlskdProviderBinding,
  selectSlskdDownloadProtocol, validateSlskdProviderBinding,
} from '../../src/server/slskd/slskd-download-protocol-policy.js';

const config = { baseUrl: 'http://localhost:5030', providerMode: 'managed' };

for (const version of ['0.26.0.0', '0.26.1.0']) test(`the observed stable wire version ${version} admits batch dispatch and survives binding serialization unchanged`, () => {
  assert.equal(selectSlskdDownloadProtocol(version), 'batch');
  const binding = createSlskdProviderBinding({ config, version });
  assert.equal(binding.version, version);
  assert.equal(binding.protocol, 'batch');
  const saved = JSON.parse(JSON.stringify(binding));
  assert.equal(validateSlskdProviderBinding(saved), true);
  assert.doesNotThrow(() => assertSlskdProviderBindingCurrent({ binding: saved, config }));
});

test('existing three-component batch and legacy bindings remain valid without rewriting their versions', () => {
  for (const [version, protocol] of [['0.26.0', 'batch'], ['0.25.1', 'legacy']]) {
    const binding = createSlskdProviderBinding({ config, version });
    assert.equal(binding.protocol, protocol);
    assert.equal(binding.version, version);
    assert.equal(validateSlskdProviderBinding(binding), true);
  }
});

test('unreviewed revisions, canaries, metadata and coerced input cannot select or validate a transport', () => {
  const supported = createSlskdProviderBinding({ config, version: '0.26.0' });
  for (const version of ['0.26.1', '0.26.2.0', '0.27.0.0', '0.25.1.0', '0.26.0.1', '0.26.1.1', '0.26.1.0-dev',
    '0.26.0.65534-abcd1234', '0.26.0.0-dev', '0.26.0.0+build', '0.26.0.0.0',
    '00.26.0.0', '0.26.00.0', 'v0.26.0.0', ' 0.26.0.0', '0.26.0.0\n', '',
    null, undefined, 0.26, ['0.26.0.0'], { version: '0.26.0.0' }, Object('0.26.0.0')]) {
    assert.throws(() => selectSlskdDownloadProtocol(version), { code: 'slskd_download_version_unsupported' });
    assert.equal(validateSlskdProviderBinding({ ...supported, version }), false);
  }
});

test('the observed wire form keeps a distinct identity and cannot grant the legacy protocol', () => {
  const wire = createSlskdProviderBinding({ config, version: '0.26.0.0' });
  const previous = createSlskdProviderBinding({ config, version: '0.26.0' });
  assert.equal(wire.endpointFingerprint, previous.endpointFingerprint);
  assert.notDeepEqual(wire, previous);
  assert.equal(validateSlskdProviderBinding({ ...wire, protocol: 'legacy' }), false);
  assert.throws(() => assertSlskdProviderBindingCurrent({ config,
    binding: { ...wire, protocol: 'legacy' } }), { code: 'slskd_download_provider_changed' });
});
