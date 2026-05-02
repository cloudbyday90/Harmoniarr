import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildUserMusicRootPath,
  normalizeManagedLibraryRelativeRoot,
  normalizeUserMusicRoots,
  resolveUserMusicRoot,
} from '../../src/server/paths/user-music-root-service.js';

test('normalizeUserMusicRoots normalizes path separators and trims values', () => {
  assert.deepEqual(normalizeUserMusicRoots([{
    relativeRoot: ' household\\alice ',
    userId: ' user-1 ',
  }]), [{
    relativeRoot: 'household/alice',
    userId: 'user-1',
  }]);
});

test('normalizeUserMusicRoots rejects duplicate user ids and traversal roots', () => {
  assert.throws(
    () => normalizeUserMusicRoots([{
      relativeRoot: 'alice',
      userId: 'user-1',
    }, {
      relativeRoot: 'other',
      userId: 'user-1',
    }]),
    /duplicate userId values/,
  );

  assert.throws(
    () => normalizeUserMusicRoots([{
      relativeRoot: '../escape',
      userId: 'user-1',
    }]),
    /must not contain dot traversal segments/,
  );
});

test('resolveUserMusicRoot returns configured per-user roots and preserves unconfigured fallbacks', () => {
  assert.deepEqual(resolveUserMusicRoot({
    musicRoot: '/data/music',
    targetUser: { id: 'user-1' },
    appUsers: [{
      authProvider: 'local',
      id: 'user-1',
      managedLibraryRelativeRoot: 'owned/alice',
    }],
    userMusicRoots: [{
      relativeRoot: 'legacy-alice',
      userId: 'user-1',
    }],
  }), {
    authProvider: 'local',
    configured: true,
    configuredBy: 'app_user',
    id: 'user-1',
    relativeRoot: 'owned/alice',
    userRootPath: '/data/music/users/owned/alice',
  });

  assert.deepEqual(resolveUserMusicRoot({
    musicRoot: '/data/music',
    targetUser: { id: 'user-1' },
    userMusicRoots: [{
      relativeRoot: 'alice',
      userId: 'user-1',
    }],
  }), {
    authProvider: 'local',
    configured: true,
    configuredBy: 'settings',
    id: 'user-1',
    relativeRoot: 'alice',
    userRootPath: '/data/music/users/alice',
  });

  assert.deepEqual(resolveUserMusicRoot({
    musicRoot: '/data/music',
    targetUser: { id: 'user-2' },
    userMusicRoots: [{
      relativeRoot: 'alice',
      userId: 'user-1',
    }],
  }), {
    authProvider: 'local',
    configured: false,
    configuredBy: null,
    id: 'user-2',
    relativeRoot: null,
    userRootPath: '/data/music',
  });
});

test('normalizeManagedLibraryRelativeRoot reuses the shared relative-root normalization rules', () => {
  assert.equal(normalizeManagedLibraryRelativeRoot(' household\\alice '), 'household/alice');
});

test('buildUserMusicRootPath nests under the users namespace', () => {
  assert.equal(buildUserMusicRootPath({
    musicRoot: '/data/music',
    relativeRoot: 'family/alice',
  }), '/data/music/users/family/alice');
});