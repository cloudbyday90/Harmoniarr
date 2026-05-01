import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSettingsPatch } from '../../src/server/validators/settings-validator.js';

test('normalizeSettingsPatch accepts explicit download path mappings', () => {
  const updates = normalizeSettingsPatch({
    paths: {
      downloadMappings: [{
        slskdPrefix: '/downloads/completed',
        harmoniarrPrefix: '/data/downloads/completed',
      }],
    },
  });

  assert.deepEqual(updates, [{
    namespace: 'paths',
    settingKey: 'downloadMappings',
    value: [{
      slskdPrefix: '/downloads/completed',
      slskdPrefixStyle: 'posix',
      harmoniarrPrefix: '/data/downloads/completed',
      harmoniarrPrefixStyle: 'posix',
    }],
  }]);
});

test('normalizeSettingsPatch rejects overlapping download path mappings', () => {
  assert.throws(
    () => normalizeSettingsPatch({
      paths: {
        downloadMappings: [{
          slskdPrefix: '/downloads',
          harmoniarrPrefix: '/data/downloads',
        }, {
          slskdPrefix: '/downloads/completed',
          harmoniarrPrefix: '/data/downloads/completed',
        }],
      },
    }),
    (error) => error?.status === 400
      && error?.code === 'validation_error'
      && error?.message === 'paths.downloadMappings contains overlapping slskdPrefix values: /downloads and /downloads/completed',
  );
});