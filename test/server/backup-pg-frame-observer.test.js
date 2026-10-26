/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackupPgFrameObserver } from '../../testing/server/backup-pg-frame-observer.js';
import { backupSqlCrashPlan,getBackupSqlCrashCase } from '../../testing/server/backup-sql-crash-plan.js';
const frame=(type,payload)=>{const result=Buffer.alloc(payload.length+5);result.write(type);result.writeInt32BE(payload.length+4,1);payload.copy(result,5);return result;};
test('SQL crash plan covers nine mutation targets with both rollback and withheld acknowledgement',()=>{
  assert.equal(backupSqlCrashPlan.length,18);assert.equal(new Set(backupSqlCrashPlan.map(row=>row.checkpoint)).size,18);
  for(const row of backupSqlCrashPlan)assert.equal(getBackupSqlCrashCase(row.checkpoint),row);
  assert.throws(()=>getBackupSqlCrashCase('untrusted'));
});
test('PostgreSQL observer handles split and coalesced frames without exposing cancellation keys',()=>{
  const observer=createBackupPgFrameObserver(),key=Buffer.alloc(36,0xab);key.writeInt32BE(1234);
  const packet=Buffer.concat([frame('K',key),frame('C',Buffer.from('INSERT 0 1\0')),frame('Z',Buffer.from('I'))]);
  for(const byte of packet)observer.push(Buffer.from([byte]));
  assert.deepEqual(observer.state(),{backendPid:1234,ready:'I',command:'INSERT',error:false,partialBytes:0});
  observer.reset();assert.equal(observer.state().command,undefined);assert.equal(observer.state().backendPid,1234);
});
test('observer distinguishes transaction failure and nonmutation completion',()=>{
  const observer=createBackupPgFrameObserver();
  observer.push(Buffer.concat([frame('E',Buffer.from('sensitive details')),frame('C',Buffer.from('SELECT 1\0')),frame('Z',Buffer.from('E'))]));
  assert.equal(observer.state().error,true);assert.equal(observer.state().command,null);assert.equal(observer.state().ready,'E');
});
test('observer bounds retained frames and rejects malformed completion, status and key data',()=>{
  for(const packet of [Buffer.from([90,0,0,0,3]),frame('Z',Buffer.from('II')),frame('Z',Buffer.from('X')),frame('K',Buffer.alloc(7)),frame('C',Buffer.from('UPDATE 1')),Buffer.alloc(1_048_577)]){
    assert.throws(()=>createBackupPgFrameObserver().push(packet));
  }
  const observer=createBackupPgFrameObserver();observer.push(Buffer.from([90]));assert.throws(()=>observer.reset());
});
