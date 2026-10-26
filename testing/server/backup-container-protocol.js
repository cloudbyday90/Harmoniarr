/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import {getBackupSqlCrashCase} from './backup-sql-crash-plan.js';

export const backupContainerProtocolPrefix='BACKUP_CONTAINER_QUALIFICATION ';
export function parseBackupContainerMessage(line,{phase,checkpoint,containerId}){
  assert.ok(line.startsWith(backupContainerProtocolPrefix));assert.ok(Buffer.byteLength(line)<=4096);
  const value=JSON.parse(line.slice(backupContainerProtocolPrefix.length));getBackupSqlCrashCase(checkpoint);
  assert.equal(value.checkpoint,checkpoint);assert.equal(value.containerId,containerId);
  assert.match(value.clusterId,/^[0-9]{1,20}$/u);assert.match(value.snapshotSha256,/^[a-f0-9]{64}$/u);
  const expected=phase==='prepare'?'prepared':'verified';assert.ok(['prepare','verify'].includes(phase));assert.equal(value.event,expected);
  const keys=['event','checkpoint','containerId','clusterId','snapshotSha256',...(phase==='verify'?['repeatedRecovery','currentBytesAndCatalogVerified']:[])];
  assert.deepEqual(Object.keys(value).sort(),keys.sort());
  if(phase==='verify'){assert.equal(value.repeatedRecovery,true);assert.equal(value.currentBytesAndCatalogVerified,true);}
  return value;
}
