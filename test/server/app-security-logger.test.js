import assert from 'node:assert/strict';
import test from 'node:test';
import { createSecurityEventLogger } from '../../src/server/app.js';

test('createSecurityEventLogger redacts sensitive query parameters before writing security logs', () => {
  const stderrWrites = [];
  const logSecurityEvent = createSecurityEventLogger({
    stderr: {
      write(message) {
        stderrWrites.push(message);
      },
    },
  });

  logSecurityEvent({
    bucketName: 'auth-login',
    request: {
      headers: {
        'x-forwarded-for': '198.51.100.44',
      },
      method: 'POST',
      originalUrl: '/api/v1/recovery/bootstrap-admin/complete?recovery_code=HARM-ABCD-EFGH&token=abc123&email=ops@example.com',
      socket: {
        remoteAddress: '127.0.0.1',
      },
      url: '/api/v1/recovery/bootstrap-admin/complete?recovery_code=HARM-ABCD-EFGH&token=abc123&email=ops@example.com',
    },
    retryAfterSeconds: 60,
  });

  assert.deepEqual(stderrWrites, [
    '[harmoniarr-security] rate_limited bucket=auth-login method=POST path=/api/v1/recovery/bootstrap-admin/complete?recovery_code=[REDACTED]&token=[REDACTED]&email=[REDACTED_EMAIL] ip=198.51.100.44 retry_after_s=60\n',
  ]);
});
