import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyMusicBrainzDependencyError,
  classifySlskdDependencyError,
  createDependencyHealthService,
  createProviderHealthRecorder,
} from '../../src/server/dependency-health-service.js';

test('classifyMusicBrainzDependencyError maps throttling to safe degraded metadata', () => {
  const cause = new Error('socket hang up');
  const error = new Error('MusicBrainz artist search request failed with status 503');
  error.code = 'musicbrainz_unavailable';
  error.details = {
    attempts: 2,
    cause,
    maxRetries: 1,
    retryAfterMs: 3000,
    retryable: true,
    status: 503,
    throttled: true,
    url: 'https://musicbrainz.test/ws/2/artist?fmt=json',
  };

  assert.deepEqual(classifyMusicBrainzDependencyError(error), {
    provider: 'musicbrainz',
    status: 'degraded',
    code: 'musicbrainz_unavailable',
    message: 'MusicBrainz is throttling requests',
    details: {
      attempts: 2,
      maxRetries: 1,
      retryAfterMs: 3000,
      retryable: true,
      status: 503,
      throttled: true,
    },
  });
});

test('classifyMusicBrainzDependencyError maps misconfiguration without unsafe details', () => {
  const error = new Error('MusicBrainz requests require HARMONIARR_CONTACT_URL or HARMONIARR_CONTACT_EMAIL');
  error.code = 'musicbrainz_misconfigured';
  error.details = {
    url: 'https://musicbrainz.test/ws/2',
  };

  assert.deepEqual(classifyMusicBrainzDependencyError(error), {
    provider: 'musicbrainz',
    status: 'misconfigured',
    code: 'musicbrainz_misconfigured',
    message: 'MusicBrainz requests require HARMONIARR_CONTACT_URL or HARMONIARR_CONTACT_EMAIL',
  });
});

test('classifyMusicBrainzDependencyError maps upstream request failures to degraded status', () => {
  const error = new Error('MusicBrainz release lookup request failed with status 400');
  error.code = 'musicbrainz_request_failed';
  error.details = {
    attempts: 1,
    maxRetries: 1,
    retryable: false,
    status: 400,
    throttled: false,
    url: 'https://musicbrainz.test/ws/2/release/bad-id?fmt=json',
  };

  assert.deepEqual(classifyMusicBrainzDependencyError(error), {
    provider: 'musicbrainz',
    status: 'degraded',
    code: 'musicbrainz_request_failed',
    message: 'MusicBrainz release lookup request failed with status 400',
    details: {
      attempts: 1,
      maxRetries: 1,
      retryable: false,
      status: 400,
      throttled: false,
    },
  });
});

test('classifyMusicBrainzDependencyError treats not-found lookups as healthy dependency responses', () => {
  const error = new Error('MusicBrainz artist lookup not found');
  error.code = 'musicbrainz_not_found';

  assert.deepEqual(classifyMusicBrainzDependencyError(error), {
    provider: 'musicbrainz',
    status: 'healthy',
  });
});

test('createDependencyHealthService returns healthy checks and classified provider failures', async () => {
  const throttled = new Error('MusicBrainz is throttled');
  throttled.code = 'musicbrainz_unavailable';
  throttled.details = {
    attempts: 2,
    maxRetries: 1,
    retryAfterMs: 2000,
    retryable: true,
    status: 429,
    throttled: true,
    url: 'https://musicbrainz.test/ws/2/artist?fmt=json',
  };

  const service = createDependencyHealthService({
    now: () => new Date('2026-04-30T10:30:00.000Z'),
    checks: [
      {
        provider: 'database',
        check: async () => ({
          status: 'healthy',
          details: {
            status: 200,
            url: 'postgres://harmoniarr@localhost/harmoniarr',
          },
        }),
      },
      {
        provider: 'musicbrainz',
        check: async () => {
          throw throttled;
        },
      },
    ],
  });

  assert.deepEqual(await service.getDependencyHealth(), [
    {
      provider: 'database',
      status: 'healthy',
      details: {
        status: 200,
      },
      observedAt: '2026-04-30T10:30:00.000Z',
    },
    {
      provider: 'musicbrainz',
      status: 'degraded',
      code: 'musicbrainz_unavailable',
      message: 'MusicBrainz is throttling requests',
      details: {
        attempts: 2,
        maxRetries: 1,
        retryAfterMs: 2000,
        retryable: true,
        status: 429,
        throttled: true,
      },
      observedAt: '2026-04-30T10:30:00.000Z',
    },
  ]);
});

test('createProviderHealthRecorder stores last observed safe provider status', () => {
  const observedTimes = [
    new Date('2026-04-30T10:00:00.000Z'),
    new Date('2026-04-30T10:05:00.000Z'),
  ];
  const recorder = createProviderHealthRecorder({
    now: () => observedTimes.shift(),
  });
  const error = new Error('MusicBrainz release lookup request failed with status 503');
  error.code = 'musicbrainz_unavailable';
  error.details = {
    attempts: 2,
    cause: new Error('network failed'),
    maxRetries: 1,
    retryAfterMs: 3000,
    retryable: true,
    status: 503,
    throttled: true,
    url: 'https://musicbrainz.test/ws/2/release/bad-id?fmt=json',
  };

  assert.deepEqual(recorder.recordError('musicbrainz', error), {
    provider: 'musicbrainz',
    status: 'degraded',
    code: 'musicbrainz_unavailable',
    message: 'MusicBrainz is throttling requests',
    details: {
      attempts: 2,
      maxRetries: 1,
      retryAfterMs: 3000,
      retryable: true,
      status: 503,
      throttled: true,
    },
    observedAt: '2026-04-30T10:00:00.000Z',
  });

  assert.deepEqual(recorder.recordSuccess('musicbrainz'), {
    provider: 'musicbrainz',
    status: 'healthy',
    observedAt: '2026-04-30T10:05:00.000Z',
  });
  assert.deepEqual(recorder.getSnapshots(), [{
    provider: 'musicbrainz',
    status: 'healthy',
    observedAt: '2026-04-30T10:05:00.000Z',
  }]);
});

test('createDependencyHealthService includes recorded provider health snapshots', async () => {
  const recorder = createProviderHealthRecorder({
    now: () => new Date('2026-04-30T11:00:00.000Z'),
  });
  recorder.recordStatus('musicbrainz', {
    status: 'degraded',
    code: 'musicbrainz_unavailable',
    details: {
      retryAfterMs: 5000,
      url: 'https://musicbrainz.test/ws/2/artist?fmt=json',
    },
  });
  const service = createDependencyHealthService({ recorder });

  assert.deepEqual(await service.getDependencyHealth(), [{
    provider: 'musicbrainz',
    status: 'degraded',
    code: 'musicbrainz_unavailable',
    details: {
      retryAfterMs: 5000,
    },
    observedAt: '2026-04-30T11:00:00.000Z',
  }]);
});

test('createDependencyHealthService lets live checks replace recorded snapshots for the same provider', async () => {
  const recorder = createProviderHealthRecorder({
    now: () => new Date('2026-04-30T12:00:00.000Z'),
  });
  recorder.recordStatus('slskd', {
    status: 'unavailable',
    message: 'slskd is not connected to Soulseek',
    details: {
      isConnected: false,
      isLoggedIn: false,
      isTransitioning: false,
      url: 'http://slskd.test:5030/api/v0/application',
    },
  });
  const service = createDependencyHealthService({
    now: () => new Date('2026-04-30T12:01:00.000Z'),
    recorder,
    checks: [{
      provider: 'slskd',
      check: async () => ({
        status: 'healthy',
        details: {
          isConnected: true,
          isLoggedIn: true,
          isTransitioning: false,
          url: 'http://slskd.test:5030/api/v0/application',
        },
      }),
    }],
  });

  assert.deepEqual(await service.getDependencyHealth(), [{
    provider: 'slskd',
    status: 'healthy',
    details: {
      isConnected: true,
      isLoggedIn: true,
      isTransitioning: false,
    },
    observedAt: '2026-04-30T12:01:00.000Z',
  }]);
});

test('createDependencyHealthService preserves safe slskd connection details from checks', async () => {
  const service = createDependencyHealthService({
    now: () => new Date('2026-04-30T13:00:00.000Z'),
    checks: [{
      provider: 'slskd',
      check: async () => ({
        status: 'degraded',
        message: 'slskd is connected but not logged in',
        details: {
          isConnected: true,
          isLoggedIn: false,
          isTransitioning: false,
          url: 'http://slskd.test:5030/api/v0/application',
        },
      }),
    }],
  });

  assert.deepEqual(await service.getDependencyHealth(), [{
    provider: 'slskd',
    status: 'degraded',
    message: 'slskd is connected but not logged in',
    details: {
      isConnected: true,
      isLoggedIn: false,
      isTransitioning: false,
    },
    observedAt: '2026-04-30T13:00:00.000Z',
  }]);
});

test('createDependencyHealthService can scope checks to specific providers', async () => {
  const service = createDependencyHealthService({
    now: () => new Date('2026-04-30T14:00:00.000Z'),
    checks: [{
      provider: 'slskd',
      check: async () => ({
        status: 'healthy',
      }),
    }],
    recorder: {
      getSnapshots: () => [{
        provider: 'musicbrainz',
        status: 'degraded',
        code: 'musicbrainz_unavailable',
        details: {
          retryAfterMs: 5000,
        },
      }],
    },
  });

  assert.deepEqual(await service.getDependencyHealth({ providers: ['musicbrainz'] }), [{
    provider: 'musicbrainz',
    status: 'degraded',
    code: 'musicbrainz_unavailable',
    details: {
      retryAfterMs: 5000,
    },
  }]);
});

test('createDependencyHealthService preserves safe media tooling flags and strips unsafe details', async () => {
  const service = createDependencyHealthService({
    now: () => new Date('2026-04-30T15:00:00.000Z'),
    checks: [{
      provider: 'media_tooling',
      check: async () => ({
        status: 'healthy',
        details: {
          ffmpegAvailable: true,
          ffprobeAvailable: true,
          version: 'ffmpeg 7.0',
        },
      }),
    }],
  });

  assert.deepEqual(await service.getDependencyHealth(), [{
    provider: 'media_tooling',
    status: 'healthy',
    details: {
      ffmpegAvailable: true,
      ffprobeAvailable: true,
    },
    observedAt: '2026-04-30T15:00:00.000Z',
  }]);
});

test('classifySlskdDependencyError maps authentication failures to safe misconfigured status', () => {
  const error = new Error('slskd session validation request was not authorized');
  error.code = 'slskd_unauthorized';
  error.details = {
    operation: 'session validation',
    retryable: false,
    status: 401,
    url: 'http://slskd.test:5030/api/v0/session',
  };

  assert.deepEqual(classifySlskdDependencyError(error), {
    provider: 'slskd',
    status: 'misconfigured',
    code: 'slskd_unauthorized',
    message: 'slskd authentication failed',
    details: {
      retryable: false,
      status: 401,
    },
  });
});

test('classifySlskdDependencyError maps unavailable failures without leaking provider URLs', () => {
  const error = new Error('slskd server state request failed with status 503');
  error.code = 'slskd_unavailable';
  error.details = {
    cause: new Error('connection refused'),
    operation: 'server state',
    retryable: true,
    status: 503,
    url: 'http://slskd.test:5030/api/v0/server',
  };

  assert.deepEqual(classifySlskdDependencyError(error), {
    provider: 'slskd',
    status: 'unavailable',
    code: 'slskd_unavailable',
    message: 'slskd is temporarily unavailable',
    details: {
      retryable: true,
      status: 503,
    },
  });
});

test('createDependencyHealthService classifies MusicBrainz active check errors', async () => {
  const error = new Error('MusicBrainz is unavailable');
  error.code = 'musicbrainz_unavailable';
  error.details = {
    status: 503,
    throttled: true,
    url: 'https://musicbrainz.org/ws/2/artist?fmt=json',
  };

  const service = createDependencyHealthService({
    now: () => new Date('2026-04-30T16:00:00.000Z'),
    checks: [{
      provider: 'musicbrainz',
      check: async () => { throw error; },
    }],
  });

  assert.deepEqual(await service.getDependencyHealth(), [{
    provider: 'musicbrainz',
    status: 'degraded',
    code: 'musicbrainz_unavailable',
    message: 'MusicBrainz is throttling requests',
    details: {
      status: 503,
      throttled: true,
    },
    observedAt: '2026-04-30T16:00:00.000Z',
  }]);
});
