import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAuditActivityLinkTarget } from '../../src/client/lib/audit-activity-links.js';

test('buildAuditActivityLinkTarget links artwork cleanup audit events into the dashboard run detail state', () => {
  assert.deepEqual(buildAuditActivityLinkTarget({
    entityId: 'run-22',
    entityType: 'operation_run',
    eventType: 'artwork_cleanup_started',
  }), {
    label: 'View artwork cleanup',
    to: {
      hash: '#artwork-maintenance-panel',
      name: 'dashboard-panel',
      query: {
        artworkRunId: 'run-22',
      },
    },
  });
});

test('buildAuditActivityLinkTarget links import execution and apply audit events into import review run detail state', () => {
  assert.deepEqual(buildAuditActivityLinkTarget({
    entityId: 'execution-run-22',
    entityType: 'operation_run',
    eventType: 'import_candidate_execution_started',
  }), {
    label: 'View download run',
    to: {
      hash: '#import-execution-run-panel',
      name: 'review-queue',
      query: {
        executionRunId: 'execution-run-22',
      },
    },
  });

  assert.deepEqual(buildAuditActivityLinkTarget({
    entityId: 'apply-run-9',
    entityType: 'operation_run',
    eventType: 'import_candidate_apply_started',
  }), {
    label: 'View library import',
    to: {
      hash: '#import-apply-run-panel',
      name: 'review-queue',
      query: {
        applyRunId: 'apply-run-9',
      },
    },
  });
});

test('buildAuditActivityLinkTarget links library scan and discovery audit events into dashboard run detail state', () => {
  assert.deepEqual(buildAuditActivityLinkTarget({
    entityId: 'scan-run-8',
    entityType: 'operation_run',
    eventType: 'library_scan_started',
  }), {
    label: 'View library scan',
    to: {
      hash: '#library-scan-panel',
      name: 'dashboard-panel',
      query: {
        libraryScanRunId: 'scan-run-8',
      },
    },
  });

  assert.deepEqual(buildAuditActivityLinkTarget({
    entityId: 'discovery-run-5',
    entityType: 'operation_run',
    eventType: 'library_discovery_dispatch_started',
  }), {
    label: 'View library discovery',
    to: {
      hash: '#library-discovery-panel',
      name: 'dashboard-panel',
      query: {
        libraryDiscoveryRunId: 'discovery-run-5',
      },
    },
  });
});

test('buildAuditActivityLinkTarget links backup restore audit events into jobs run detail state', () => {
  assert.deepEqual(buildAuditActivityLinkTarget({
    entityId: 'restore-run-1',
    entityType: 'operation_run',
    eventType: 'backup_restore_failed',
  }), {
    label: 'View backup restore',
    to: {
      name: 'jobs',
      query: {
        runId: 'restore-run-1',
      },
    },
  });
});

test('buildAuditActivityLinkTarget ignores unsupported audit events', () => {
  assert.equal(buildAuditActivityLinkTarget({
    entityId: 'run-9',
    entityType: 'operation_run',
    eventType: 'library_reconciliation_started',
  }), null);
});
