import assert from 'node:assert/strict';
import test from 'node:test';
import { useBootstrapStatus } from '../../src/client/composables/useBootstrapStatus.js';

test('useBootstrapStatus loads bootstrap preflight summary from the injected shared route client', async (t) => {
  const fetchBootstrapStatus = t.mock.fn(async () => ({
    bootstrapRequired: true,
    ownerClaim: {
      required: true,
      authMethods: ['local'],
      usernameHint: 'owner-admin',
      emailHint: 'o***@e***.com',
      emailRequired: true,
    },
    pathValidation: {
      checkedAt: '2026-04-30T21:00:00.000Z',
      configuredDownloadMappings: 2,
      summary: {
        status: 'degraded',
        message: 'Validation needs attention',
      },
    },
  }));
  const workflow = useBootstrapStatus({ fetchBootstrapStatus });

  assert.equal(workflow.isLoading.value, true);

  await workflow.loadStatus();

  assert.equal(fetchBootstrapStatus.mock.callCount(), 1);
  assert.equal(workflow.errorMessage.value, '');
  assert.deepEqual(workflow.pathValidationSummary.value, {
    checkedAt: '2026-04-30T21:00:00.000Z',
    configuredDownloadMappings: 2,
    message: 'Validation needs attention',
    status: 'degraded',
  });
  assert.deepEqual(workflow.ownerClaimSummary.value, {
    required: true,
    authMethods: ['local'],
    usernameHint: 'owner-admin',
    emailHint: 'o***@e***.com',
    emailRequired: true,
  });
  assert.equal(workflow.isLoading.value, false);
});

test('useBootstrapStatus clears stale state on bootstrap status failures', async () => {
  const workflow = useBootstrapStatus({
    fetchBootstrapStatus: async () => {
      throw new Error('bootstrap status unavailable');
    },
  });

  await workflow.loadStatus();

  assert.equal(workflow.bootstrapStatus.value, null);
  assert.equal(workflow.errorMessage.value, 'bootstrap status unavailable');
  assert.equal(workflow.pathValidationSummary.value, null);
  assert.equal(workflow.ownerClaimSummary.value, null);
  assert.equal(workflow.isLoading.value, false);
});

test('useBootstrapStatus ownerClaimSummary is null when ownerClaim is absent from response', async () => {
  const workflow = useBootstrapStatus({
    fetchBootstrapStatus: async () => ({
      bootstrapRequired: true,
      pathValidation: {
        checkedAt: '2026-05-01T10:00:00.000Z',
        configuredDownloadMappings: 1,
        summary: { status: 'healthy', message: 'All paths accessible' },
      },
    }),
  });

  await workflow.loadStatus();

  assert.equal(workflow.ownerClaimSummary.value, null);
});

test('useBootstrapStatus ownerClaimSummary reflects non-required owner claim installs', async () => {
  const workflow = useBootstrapStatus({
    fetchBootstrapStatus: async () => ({
      bootstrapRequired: true,
      ownerClaim: {
        required: false,
        authMethods: ['local'],
        usernameHint: null,
        emailHint: null,
        emailRequired: false,
      },
    }),
  });

  await workflow.loadStatus();

  assert.deepEqual(workflow.ownerClaimSummary.value, {
    required: false,
    authMethods: ['local'],
    usernameHint: null,
    emailHint: null,
    emailRequired: false,
  });
});

test('useBootstrapStatus pathValidationSummary status defaults to unavailable when summary is absent', async () => {
  const workflow = useBootstrapStatus({
    fetchBootstrapStatus: async () => ({
      bootstrapRequired: true,
      pathValidation: {
        checkedAt: null,
        configuredDownloadMappings: 0,
      },
    }),
  });

  await workflow.loadStatus();

  assert.equal(workflow.pathValidationSummary.value.status, 'unavailable');
  assert.equal(workflow.pathValidationSummary.value.message, '');
});

test('useBootstrapStatus pathValidationSummary is null when pathValidation is absent from response', async () => {
  const workflow = useBootstrapStatus({
    fetchBootstrapStatus: async () => ({
      bootstrapRequired: true,
    }),
  });

  await workflow.loadStatus();

  assert.equal(workflow.pathValidationSummary.value, null);
});
