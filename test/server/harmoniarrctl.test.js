import assert from 'node:assert/strict';
import test from 'node:test';
import {
  armCommand,
  cancelCommand,
  statusCommand,
} from '../../src/server/cli/recovery-commands.js';
import {
  exitCodes,
  formatJsonError,
  formatJsonOutput,
  getRecoveryExitCode,
} from '../../src/server/cli/cli-runtime.js';

function createCaptureOutput() {
  const stdout = [];
  const stderr = [];
  let capturedExitCode = null;

  function writeOutput({ exitCode, jsonOutput, textOutput, textError }) {
    capturedExitCode = exitCode;
    if (textError) stderr.push(textError);
    else if (jsonOutput) stdout.push(jsonOutput);
    else if (textOutput) stdout.push(textOutput);
  }

  return {
    getExitCode: () => capturedExitCode,
    getStderr: () => stderr.join('\n'),
    getStdout: () => stdout.join('\n'),
    writeOutput,
  };
}

function createMockService(overrides = {}) {
  let armedResult = null;

  return {
    async armBootstrapAdminRecovery(input) {
      if (overrides.armError) {
        throw overrides.armError;
      }
      armedResult = {
        expiresAt: '2026-05-03T20:00:00.000Z',
        recoveryCode: 'HARM-TEST-CODE-1234',
        replacedExistingRun: false,
        runId: 'run-1',
        status: 'armed',
        ...overrides.armResult,
      };
      return armedResult;
    },
    async getBootstrapAdminRecoveryStatus() {
      if (overrides.statusError) {
        throw overrides.statusError;
      }
      return overrides.statusResult ?? { recoveryAvailable: false };
    },
    async cancelBootstrapAdminRecovery(input) {
      if (overrides.cancelError) {
        throw overrides.cancelError;
      }
      return overrides.cancelResult ?? {
        cancelledAt: '2026-05-03T19:05:00.000Z',
        runId: 'run-1',
        status: 'cancelled',
      };
    },
    getArmedResult: () => armedResult,
  };
}

test('exitCodes define stable exit code values', () => {
  assert.equal(exitCodes.success, 0);
  assert.equal(exitCodes.internalError, 1);
  assert.equal(exitCodes.invalidInput, 2);
  assert.equal(exitCodes.alreadyArmed, 3);
  assert.equal(exitCodes.prerequisiteFailed, 4);
});

test('getRecoveryExitCode maps known error codes', () => {
  assert.equal(getRecoveryExitCode('RECOVERY_ALREADY_ARMED'), exitCodes.alreadyArmed);
  assert.equal(getRecoveryExitCode('RECOVERY_NOT_ARMED'), exitCodes.invalidInput);
  assert.equal(getRecoveryExitCode('RECOVERY_LOCK_CONFLICT'), exitCodes.prerequisiteFailed);
  assert.equal(getRecoveryExitCode('RECOVERY_DB_UNAVAILABLE'), exitCodes.prerequisiteFailed);
  assert.equal(getRecoveryExitCode('RECOVERY_INVALID_ARGUMENT'), exitCodes.invalidInput);
  assert.equal(getRecoveryExitCode('RECOVERY_FORCE_REQUIRED'), exitCodes.invalidInput);
});

test('getRecoveryExitCode falls back to internalError for unknown codes', () => {
  assert.equal(getRecoveryExitCode('UNKNOWN_ERROR'), exitCodes.internalError);
});

test('formatJsonOutput produces pretty-printed JSON', () => {
  const result = formatJsonOutput({ success: true, status: 'armed' });
  assert.ok(result.includes('\n'));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.status, 'armed');
});

test('formatJsonError produces error envelope', () => {
  const result = formatJsonError({
    command: 'arm-bootstrap-admin',
    error: { code: 'RECOVERY_ALREADY_ARMED', message: 'Already armed' },
  });
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.command, 'arm-bootstrap-admin');
  assert.equal(parsed.error.code, 'RECOVERY_ALREADY_ARMED');
});

test('armCommand outputs human-readable result', async () => {
  const output = createCaptureOutput();
  const service = createMockService();

  await armCommand({
    args: [],
    recoveryService: service,
    writeOutput: output.writeOutput,
  });

  assert.equal(output.getExitCode(), exitCodes.success);
  const stdout = output.getStdout();
  assert.ok(stdout.includes('HARM-TEST-CODE-1234'));
  assert.ok(stdout.includes('armed'));
  assert.ok(stdout.includes('Expires at:'));
});

test('armCommand outputs JSON when --json flag is set', async () => {
  const output = createCaptureOutput();
  const service = createMockService();

  await armCommand({
    args: ['--json'],
    recoveryService: service,
    writeOutput: output.writeOutput,
  });

  assert.equal(output.getExitCode(), exitCodes.success);
  const parsed = JSON.parse(output.getStdout());
  assert.equal(parsed.success, true);
  assert.equal(parsed.command, 'arm-bootstrap-admin');
  assert.equal(parsed.recoveryCode, 'HARM-TEST-CODE-1234');
  assert.equal(parsed.recoveryPath, '/recover/bootstrap-admin');
  assert.equal(parsed.warnings.length, 0);
});

test('armCommand passes ttl-minutes option', async () => {
  const output = createCaptureOutput();
  const service = createMockService();

  await armCommand({
    args: ['--ttl-minutes', '10', '--json'],
    recoveryService: service,
    writeOutput: output.writeOutput,
  });

  assert.equal(output.getExitCode(), exitCodes.success);
});

test('armCommand passes force flag', async () => {
  const output = createCaptureOutput();
  const service = createMockService();

  await armCommand({
    args: ['--force', '--json'],
    recoveryService: service,
    writeOutput: output.writeOutput,
  });

  assert.equal(output.getExitCode(), exitCodes.success);
});

test('armCommand handles errors with correct exit code', async () => {
  const output = createCaptureOutput();
  const service = createMockService({
    armError: Object.assign(new Error('Already armed'), { code: 'RECOVERY_ALREADY_ARMED' }),
  });

  await armCommand({
    args: ['--json'],
    recoveryService: service,
    writeOutput: output.writeOutput,
  });

  assert.equal(output.getExitCode(), exitCodes.alreadyArmed);
  const parsed = JSON.parse(output.getStdout());
  assert.equal(parsed.success, false);
  assert.equal(parsed.error.code, 'RECOVERY_ALREADY_ARMED');
});

test('armCommand handles errors in human-readable mode', async () => {
  const output = createCaptureOutput();
  const service = createMockService({
    armError: Object.assign(new Error('Lock conflict'), { code: 'RECOVERY_LOCK_CONFLICT' }),
  });

  await armCommand({
    args: [],
    recoveryService: service,
    writeOutput: output.writeOutput,
  });

  assert.equal(output.getExitCode(), exitCodes.prerequisiteFailed);
  assert.ok(output.getStderr().includes('Lock conflict'));
});

test('armCommand warns about replaced run in human-readable output', async () => {
  const output = createCaptureOutput();
  const service = createMockService({
    armResult: { replacedExistingRun: true },
  });

  await armCommand({
    args: [],
    recoveryService: service,
    writeOutput: output.writeOutput,
  });

  assert.equal(output.getExitCode(), exitCodes.success);
  assert.ok(output.getStdout().includes('replaced'));
});

test('statusCommand outputs inactive status when no run exists', async () => {
  const output = createCaptureOutput();
  const service = createMockService();

  await statusCommand({
    args: [],
    recoveryService: service,
    writeOutput: output.writeOutput,
  });

  assert.equal(output.getExitCode(), exitCodes.success);
  assert.ok(output.getStdout().includes('No active recovery run'));
});

test('statusCommand outputs armed status in JSON', async () => {
  const output = createCaptureOutput();
  const service = createMockService({
    statusResult: {
      armedVia: 'harmoniarrctl',
      blockedByLock: false,
      expiresAt: '2026-05-03T20:00:00.000Z',
      maxAttempts: 5,
      recoveryAvailable: true,
      remainingAttempts: 5,
      runId: 'run-1',
      status: 'armed',
    },
  });

  await statusCommand({
    args: ['--json'],
    recoveryService: service,
    writeOutput: output.writeOutput,
  });

  assert.equal(output.getExitCode(), exitCodes.success);
  const parsed = JSON.parse(output.getStdout());
  assert.equal(parsed.success, true);
  assert.equal(parsed.command, 'bootstrap-admin-status');
  assert.equal(parsed.recoveryAvailable, true);
  assert.equal(parsed.remainingAttempts, 5);
  assert.equal(parsed.blockedByLock, false);
});

test('statusCommand outputs human-readable armed status', async () => {
  const output = createCaptureOutput();
  const service = createMockService({
    statusResult: {
      armedVia: 'harmoniarrctl',
      blockedByLock: true,
      expiresAt: '2026-05-03T20:00:00.000Z',
      maxAttempts: 5,
      recoveryAvailable: true,
      remainingAttempts: 3,
      runId: 'run-1',
      status: 'armed',
    },
  });

  await statusCommand({
    args: [],
    recoveryService: service,
    writeOutput: output.writeOutput,
  });

  assert.equal(output.getExitCode(), exitCodes.success);
  const stdout = output.getStdout();
  assert.ok(stdout.includes('armed'));
  assert.ok(stdout.includes('Remaining attempts: 3'));
  assert.ok(stdout.includes('Blocked by lock: yes'));
});

test('cancelCommand outputs cancellation result in JSON', async () => {
  const output = createCaptureOutput();
  const service = createMockService();

  await cancelCommand({
    args: ['--force', '--json'],
    recoveryService: service,
    writeOutput: output.writeOutput,
  });

  assert.equal(output.getExitCode(), exitCodes.success);
  const parsed = JSON.parse(output.getStdout());
  assert.equal(parsed.success, true);
  assert.equal(parsed.command, 'cancel-bootstrap-admin');
  assert.equal(parsed.status, 'cancelled');
  assert.ok(parsed.cancelledAt);
});

test('cancelCommand outputs human-readable cancellation', async () => {
  const output = createCaptureOutput();
  const service = createMockService();

  await cancelCommand({
    args: ['--force'],
    recoveryService: service,
    writeOutput: output.writeOutput,
  });

  assert.equal(output.getExitCode(), exitCodes.success);
  assert.ok(output.getStdout().includes('cancelled'));
});

test('cancelCommand handles RECOVERY_FORCE_REQUIRED error', async () => {
  const output = createCaptureOutput();
  const service = createMockService({
    cancelError: Object.assign(new Error('Force required'), { code: 'RECOVERY_FORCE_REQUIRED' }),
  });

  await cancelCommand({
    args: ['--json'],
    recoveryService: service,
    writeOutput: output.writeOutput,
  });

  assert.equal(output.getExitCode(), exitCodes.invalidInput);
  const parsed = JSON.parse(output.getStdout());
  assert.equal(parsed.error.code, 'RECOVERY_FORCE_REQUIRED');
});

test('cancelCommand handles RECOVERY_NOT_ARMED error', async () => {
  const output = createCaptureOutput();
  const service = createMockService({
    cancelError: Object.assign(new Error('Not armed'), { code: 'RECOVERY_NOT_ARMED' }),
  });

  await cancelCommand({
    args: ['--force', '--json'],
    recoveryService: service,
    writeOutput: output.writeOutput,
  });

  assert.equal(output.getExitCode(), exitCodes.invalidInput);
  const parsed = JSON.parse(output.getStdout());
  assert.equal(parsed.error.code, 'RECOVERY_NOT_ARMED');
});

test('statusCommand does not expose recovery code in output', async () => {
  const output = createCaptureOutput();
  const service = createMockService({
    statusResult: {
      armedVia: 'harmoniarrctl',
      blockedByLock: false,
      expiresAt: '2026-05-03T20:00:00.000Z',
      maxAttempts: 5,
      recoveryAvailable: true,
      remainingAttempts: 5,
      runId: 'run-1',
      status: 'armed',
    },
  });

  await statusCommand({
    args: ['--json'],
    recoveryService: service,
    writeOutput: output.writeOutput,
  });

  const stdout = output.getStdout();
  assert.ok(!stdout.includes('recoveryCode'), 'should not expose plaintext recovery code');
  assert.ok(!stdout.includes('recovery_code'), 'should not expose code fields');
  assert.ok(!stdout.includes('HARM-'), 'should not contain code prefix');
});
