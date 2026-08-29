import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { buildIntegrationBackupEnvironment } from '../../testing/integration/app-runtime.js';

test('integration runtime assigns backups to its scenario workspace', () => {
  const workspaceDir = join('temporary', 'harmoniarr-scenario');

  assert.deepEqual(buildIntegrationBackupEnvironment(workspaceDir), {
    HARMONIARR_BACKUPS: join(workspaceDir, 'backups'),
  });
});
