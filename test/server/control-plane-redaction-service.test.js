import assert from 'node:assert/strict';
import test from 'node:test';
import { createControlPlaneRedactionService } from '../../src/server/control-plane-redaction-service.js';

test('control plane redaction service redacts sensitive keys recursively', () => {
  const service = createControlPlaneRedactionService();

  const redacted = service.redactAuditDetails({
    metadataArtistId: 'artist-1',
    nested: {
      accessToken: 'token-123',
      recovery_code_hash: 'abc123',
    },
    password: 'secret-password',
    recoveryCode: 'HARM-ABCD-EFGH-JKLM',
  });

  assert.deepEqual(redacted, {
    metadataArtistId: 'artist-1',
    nested: {
      accessToken: '[REDACTED]',
      recovery_code_hash: '[REDACTED]',
    },
    password: '[REDACTED]',
    recoveryCode: '[REDACTED]',
  });
});

test('control plane redaction service redacts path-like summary fields and sanitizes free-text messages', () => {
  const service = createControlPlaneRedactionService();

  const summary = service.redactOperationSummary({
    currentStep: 'Scanning /mnt/music/library for imported files owned by admin@example.com',
    libraryRoot: '/mnt/music/library',
    nested: {
      destinationPath: 'C:\\Music\\User\\Artist\\Album',
      notes: 'Moved from /app/data/staging/tmp-22',
    },
  });

  assert.deepEqual(summary, {
    currentStep: 'Scanning [REDACTED_PATH] for imported files owned by [REDACTED_EMAIL]',
    libraryRoot: '[REDACTED_PATH]',
    nested: {
      destinationPath: '[REDACTED_PATH]',
      notes: 'Moved from [REDACTED_PATH]',
    },
  });
  assert.equal(
    service.redactErrorMessage('Worker failed while reading /app/data/backups/backup-1.json for admin@example.com'),
    'Worker failed while reading [REDACTED_PATH] for [REDACTED_EMAIL]',
  );
});

test('control plane redaction service sanitizes maintenance lock reasons without destroying safe metadata', () => {
  const service = createControlPlaneRedactionService();

  const lock = service.redactMaintenanceLock({
    acquiredAt: '2026-05-03T12:00:00.000Z',
    id: 'lock-1',
    lockType: 'maintenance',
    reason: 'Investigate /var/lib/harmoniarr and contact ops@example.com with Bearer abc123',
    status: 'active',
  });

  assert.deepEqual(lock, {
    acquiredAt: '2026-05-03T12:00:00.000Z',
    id: 'lock-1',
    lockType: 'maintenance',
    reason: 'Investigate [REDACTED_PATH] and contact [REDACTED_EMAIL] with Bearer [REDACTED]',
    status: 'active',
  });
});

test('control plane redaction service redacts sensitive parameter values inside log-style strings', () => {
  const service = createControlPlaneRedactionService();

  assert.equal(
    service.redactLogMessage('/api/v1/recovery/bootstrap-admin/complete?recovery_code=HARM-ABCD-EFGH&token=abc123&email=ops@example.com'),
    '/api/v1/recovery/bootstrap-admin/complete?recovery_code=[REDACTED]&token=[REDACTED]&email=[REDACTED_EMAIL]',
  );
});
