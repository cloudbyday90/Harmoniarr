import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { useBootstrapStatus } from '../../src/client/composables/useBootstrapStatus.js';

let origDocument;

function stubDocument() {
  const listeners = new Map();
  origDocument = globalThis.document;

  globalThis.document = {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const arr = listeners.get(type);
      if (arr) {
        const idx = arr.indexOf(fn);
        if (idx >= 0) arr.splice(idx, 1);
      }
    },
    get visibilityState() {
      return this._vis ?? 'visible';
    },
    _vis: 'visible',
  };

  return listeners;
}

function restoreDocument() {
  globalThis.document = origDocument;
}

describe('useBootstrapStatus', () => {
  test('loads bootstrap preflight summary from the injected shared route client', async () => {
    const fetchBootstrapStatus = async () => ({
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
    });
    const workflow = useBootstrapStatus({ fetchBootstrapStatus });

    assert.equal(workflow.isLoading.value, true);

    await workflow.loadStatus();

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
    workflow.destroy();
  });

  test('clears stale state on bootstrap status failures', async () => {
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
    workflow.destroy();
  });

  test('ownerClaimSummary is null when ownerClaim is absent from response', async () => {
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
    workflow.destroy();
  });

  test('ownerClaimSummary reflects non-required owner claim installs', async () => {
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
    workflow.destroy();
  });

  test('pathValidationSummary status defaults to unavailable when summary is absent', async () => {
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
    workflow.destroy();
  });

  test('pathValidationSummary is null when pathValidation is absent from response', async () => {
    const workflow = useBootstrapStatus({
      fetchBootstrapStatus: async () => ({
        bootstrapRequired: true,
      }),
    });

    await workflow.loadStatus();

    assert.equal(workflow.pathValidationSummary.value, null);
    workflow.destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const workflow = useBootstrapStatus({
      fetchBootstrapStatus: async () => ({ bootstrapRequired: true }),
    });

    await workflow.loadStatus();
    assert.equal(workflow.isRevalidating.value, false);

    const p = workflow.revalidate();
    assert.equal(workflow.isRevalidating.value, true);
    await p;
    assert.equal(workflow.isRevalidating.value, false);
    workflow.destroy();
  });

  test('revalidate preserves stale data on error', async () => {
    let callCount = 0;
    const workflow = useBootstrapStatus({
      fetchBootstrapStatus: async () => {
        callCount += 1;
        if (callCount === 1) return { bootstrapRequired: true };
        throw new Error('refresh failed');
      },
    });

    await workflow.loadStatus();
    assert.equal(workflow.bootstrapStatus.value.bootstrapRequired, true);

    await workflow.revalidate();
    assert.equal(workflow.bootstrapStatus.value.bootstrapRequired, true, 'stale data preserved');
    assert.equal(workflow.isRevalidating.value, false);
    workflow.destroy();
  });

  test('revalidate is no-op after destroy', async () => {
    let fetchCount = 0;
    const workflow = useBootstrapStatus({
      fetchBootstrapStatus: async () => {
        fetchCount += 1;
        return { bootstrapRequired: true };
      },
    });

    await workflow.loadStatus();
    assert.equal(fetchCount, 1);
    workflow.destroy();

    await workflow.revalidate();
    assert.equal(fetchCount, 1, 'no fetch after destroy');
  });

  test('loadStatus is no-op after destroy', async () => {
    let fetchCount = 0;
    const workflow = useBootstrapStatus({
      fetchBootstrapStatus: async () => {
        fetchCount += 1;
        return { bootstrapRequired: true };
      },
    });

    await workflow.loadStatus();
    assert.equal(fetchCount, 1);
    workflow.destroy();

    await workflow.loadStatus();
    assert.equal(fetchCount, 1, 'no fetch after destroy');
  });

  test('destroy stops polling', async () => {
    let fetchCount = 0;
    const workflow = useBootstrapStatus({
      fetchBootstrapStatus: async () => {
        fetchCount += 1;
        return { bootstrapRequired: true };
      },
      pollIntervalMs: 50,
    });

    await workflow.loadStatus();
    assert.equal(fetchCount, 1);
    workflow.destroy();

    await new Promise((r) => { setTimeout(r, 120); });
    assert.equal(fetchCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    let fetchCount = 0;
    const workflow = useBootstrapStatus({
      fetchBootstrapStatus: async () => {
        fetchCount += 1;
        return { bootstrapRequired: true };
      },
      pollIntervalMs: 0,
    });

    await workflow.loadStatus();
    assert.equal(fetchCount, 1);

    await new Promise((r) => { setTimeout(r, 80); });
    assert.equal(fetchCount, 1, 'no polling when pollIntervalMs=0');
    workflow.destroy();
  });

  test('attachVisibilityListener triggers revalidate on visibility change', async () => {
    const listeners = stubDocument();
    let fetchCount = 0;
    const workflow = useBootstrapStatus({
      fetchBootstrapStatus: async () => {
        fetchCount += 1;
        return { bootstrapRequired: true };
      },
    });

    await workflow.loadStatus();
    const countBefore = fetchCount;

    workflow.attachVisibilityListener();
    assert.equal(listeners.get('visibilitychange').length, 1, 'handler registered');

    globalThis.document._vis = 'visible';
    await listeners.get('visibilitychange')[0]();
    assert.equal(fetchCount, countBefore + 1, 'revalidate called on visibility change');

    workflow.destroy();
    assert.equal(listeners.get('visibilitychange').length, 0, 'listener removed on destroy');
    restoreDocument();
  });
});
