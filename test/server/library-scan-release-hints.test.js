import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyLibraryScanReleaseHints,
  countLibraryScanReleaseHints,
} from '../../src/server/library/library-scan-release-hints.js';

test('applyLibraryScanReleaseHints scopes exact catalog files by canonical path', () => {
  const files = [{
    canonicalPath: 'C:\\Music\\Autechre\\Amber\\01 Foil.flac',
    id: 'file-1',
    relativePath: 'Autechre/Amber/01 Foil.flac',
  }, {
    canonicalPath: 'C:/Music/Autechre/Amber/02 Montreal.flac',
    id: 'file-2',
    relativePath: 'Autechre/Amber/02 Montreal.flac',
  }];

  assert.deepEqual(applyLibraryScanReleaseHints({
    files,
    releaseHints: [{
      canonicalPath: 'C:/Music/Autechre/Amber/01 Foil.flac',
      metadataReleaseId: 'release-1',
    }],
  }), [{
    canonicalPath: 'C:\\Music\\Autechre\\Amber\\01 Foil.flac',
    id: 'file-1',
    relativePath: 'Autechre/Amber/01 Foil.flac',
    scopeMetadataReleaseId: 'release-1',
  }, files[1]]);
});

test('applyLibraryScanReleaseHints ignores conflicting hints for the same path', () => {
  const files = [{
    canonicalPath: '/music/Autechre/Amber/01 Foil.flac',
    id: 'file-1',
    relativePath: 'Autechre/Amber/01 Foil.flac',
  }];

  assert.deepEqual(applyLibraryScanReleaseHints({
    files,
    releaseHints: [{
      canonicalPath: '/music/Autechre/Amber/01 Foil.flac',
      metadataReleaseId: 'release-1',
    }, {
      canonicalPath: '/music/Autechre/Amber/01 Foil.flac',
      metadataReleaseId: 'release-2',
    }],
  }), files);
});

test('countLibraryScanReleaseHints counts valid release ids only', () => {
  assert.equal(countLibraryScanReleaseHints([
    { metadataReleaseId: 'release-1' },
    { metadataReleaseId: ' ' },
    {},
  ]), 1);
});
