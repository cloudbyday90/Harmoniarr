import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeDownloadPathMappings,
  resolveDownloadCandidateFolder,
  validateDownloadPathMappingsAgainstSettings,
} from '../../src/server/paths/download-path-mapping-service.js';

test('normalizeDownloadPathMappings normalizes separators and preserves explicit mapping pairs', () => {
  assert.deepEqual(normalizeDownloadPathMappings([{
    slskdPrefix: 'C:\\Soulseek\\Complete\\',
    harmoniarrPrefix: '/data/downloads/complete/',
  }]), [{
    slskdPrefix: 'C:/Soulseek/Complete',
    slskdPrefixStyle: 'windows',
    harmoniarrPrefix: '/data/downloads/complete',
    harmoniarrPrefixStyle: 'posix',
  }]);
});

test('validateDownloadPathMappingsAgainstSettings rejects translated prefixes outside the downloads root', () => {
  assert.throws(
    () => validateDownloadPathMappingsAgainstSettings({
      downloadMappings: [{
        slskdPrefix: '/downloads/completed',
        harmoniarrPrefix: '/mnt/downloads/completed',
      }],
      downloadsRoot: '/data/downloads',
    }),
    /must stay within paths.downloads/,
  );
});

test('resolveDownloadCandidateFolder translates absolute slskd paths through explicit mappings', () => {
  const resolution = resolveDownloadCandidateFolder({
    candidateFolderPath: '/downloads/completed/Autechre/Amber',
    downloadMappings: [{
      slskdPrefix: '/downloads/completed',
      harmoniarrPrefix: '/data/downloads/completed',
    }],
    downloadsRoot: '/data/downloads',
  });

  assert.equal(resolution.resolutionStrategy, 'mapping_absolute_source');
  assert.equal(resolution.rawSourceFolderPath, '/downloads/completed/Autechre/Amber');
  assert.equal(resolution.resolvedFolderPath, '/data/downloads/completed/Autechre/Amber');
  assert.deepEqual(resolution.matchedMapping, {
    slskdPrefix: '/downloads/completed',
    harmoniarrPrefix: '/data/downloads/completed',
  });
});

test('resolveDownloadCandidateFolder uses a single explicit mapping for relative candidate folders', () => {
  const resolution = resolveDownloadCandidateFolder({
    candidateFolderPath: 'Autechre\\Amber',
    downloadMappings: [{
      slskdPrefix: '/downloads/completed',
      harmoniarrPrefix: '/data/downloads/completed',
    }],
    downloadsRoot: '/data/downloads',
  });

  assert.equal(resolution.resolutionStrategy, 'mapping_relative_candidate');
  assert.equal(resolution.rawSourceFolderPath, '/downloads/completed/Autechre/Amber');
  assert.equal(resolution.resolvedFolderPath, '/data/downloads/completed/Autechre/Amber');
});

test('resolveDownloadCandidateFolder blocks ambiguous relative candidates when multiple mappings exist', () => {
  const resolution = resolveDownloadCandidateFolder({
    candidateFolderPath: 'Autechre/Amber',
    downloadMappings: [{
      slskdPrefix: '/downloads/completed',
      harmoniarrPrefix: '/data/downloads/completed',
    }, {
      slskdPrefix: '/downloads/alt-completed',
      harmoniarrPrefix: '/data/downloads/alt-completed',
    }],
    downloadsRoot: '/data/downloads',
  });

  assert.equal(resolution.validation, undefined);
  assert.equal(resolution.blockers[0].code, 'ambiguous_relative_candidate_path');
  assert.equal(resolution.resolvedFolderPath, null);
});