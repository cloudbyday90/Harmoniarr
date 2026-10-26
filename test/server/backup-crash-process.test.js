/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { backupCrashPlan } from '../../testing/server/backup-crash-plan.js';
import { startBackupCrashProcess } from '../../testing/server/backup-crash-process.js';

const checkpoint='intent-recorded';
const counts={completedCount:0,deferredCount:0,awaitingConfirmationCount:0,abandonedCount:0};
function fixture({mode='crash'}={}){
  const child=new EventEmitter();child.pid=123;child.stdout=new EventEmitter();child.stderr=new EventEmitter();const kills=[];let options;
  child.kill=signal=>{kills.push(signal);return true;};
  const runner=startBackupCrashProcess({mode,checkpoint,root:'/fixture/backups',spawnFn:(_command,_args,value)=>{options=value;return child;}});
  const acknowledge=()=>child.emit('message',mode==='crash'?{event:'checkpoint',checkpoint,processPid:123,backendPid:456}
    :{event:'recovered',checkpoint,processPid:123,first:counts,second:counts});
  return {child,kills,runner,acknowledge,options};
}

test('finite crash plan covers unique publication, deletion and held-prefix outcomes',()=>{
  assert.equal(backupCrashPlan.length,19);assert.equal(new Set(backupCrashPlan.map(row=>row.checkpoint)).size,19);
  assert.equal(backupCrashPlan.filter(row=>row.operation==='delete').length,6);
  assert.equal(backupCrashPlan.at(-1).recovery,'confirmation');assert.ok(backupCrashPlan.every(Object.isFrozen));
});

test('SIGKILL request does not settle crash until actual child close is observed',async()=>{
  const f=fixture();f.acknowledge();await f.runner.waitReady();let settled=false;
  const task=f.runner.crash().finally(()=>{settled=true;});await Promise.resolve();
  assert.deepEqual(f.kills,['SIGKILL']);assert.equal(settled,false);assert.equal(f.runner.isClosed(),false);
  f.child.emit('close',null,'SIGKILL');assert.deepEqual(await task,{code:null,signal:'SIGKILL'});await f.runner.dispose();
});

test('unacknowledged crash and foreign reported child identity cannot authorize termination',async()=>{
  const f=fixture();await assert.rejects(f.runner.crash(),{code:'fixture_crash_not_acknowledged'});assert.deepEqual(f.kills,[]);
  f.child.emit('message',{event:'checkpoint',checkpoint,processPid:999,backendPid:456});
  await assert.rejects(f.runner.waitReady(),{code:'fixture_protocol_failed'});
  const cleanup=f.runner.dispose();assert.deepEqual(f.kills,['SIGKILL']);f.child.emit('close',null,'SIGKILL');await cleanup;
});

test('protocol failure stays failed even if a later valid acknowledgement arrives',async()=>{
  const f=fixture();f.child.emit('message',{unexpected:true});f.acknowledge();
  await assert.rejects(f.runner.waitReady(),{code:'fixture_protocol_failed'});
  const cleanup=f.runner.dispose();f.child.emit('close',null,'SIGKILL');await cleanup;
});

test('output budget and early close refuse checkpoint acceptance',async()=>{
  const oversized=fixture();oversized.child.stdout.emit('data',Buffer.alloc(32769));
  await assert.rejects(oversized.runner.waitReady(),{code:'fixture_output_budget'});
  const cleanup=oversized.runner.dispose();oversized.child.emit('close',null,'SIGKILL');await cleanup;
  const early=fixture();early.child.emit('close',1,null);await assert.rejects(early.runner.waitReady(),{code:'fixture_closed_before_ack'});await early.runner.dispose();
});

test('fresh recovery requires valid counts and normal process/stdio close',async()=>{
  const f=fixture({mode:'recover'});f.acknowledge();let settled=false;
  const task=f.runner.complete().finally(()=>{settled=true;});await Promise.resolve();assert.equal(settled,false);
  f.child.emit('close',0,null);assert.equal((await task).event,'recovered');await f.runner.dispose();
  assert.equal(f.options.shell,false);assert.ok(!Object.hasOwn(f.options.env,'NODE_OPTIONS'));assert.ok(!Object.hasOwn(f.options.env,'NODE_TEST_CONTEXT'));
});

test('abort refuses progress while owned child cleanup still waits for close',async()=>{
  const controller=new AbortController(),child=new EventEmitter();child.pid=124;child.stdout=new EventEmitter();child.stderr=new EventEmitter();let killed=false;
  child.kill=()=>{killed=true;return true;};
  const runner=startBackupCrashProcess({mode:'crash',checkpoint,root:'/fixture',signal:controller.signal,spawnFn:()=>child});
  controller.abort();await assert.rejects(runner.waitReady(),{code:'fixture_aborted'});
  const cleanup=runner.dispose();assert.equal(killed,true);child.emit('close',null,'SIGKILL');await cleanup;
});

test('a normal exit after a kill request cannot pass abrupt-termination qualification',async()=>{
  const f=fixture();f.acknowledge();await f.runner.waitReady();
  const task=f.runner.crash();f.child.emit('close',0,null);
  await assert.rejects(task,{code:'fixture_abrupt_exit_unverified'});await f.runner.dispose();
});

test('spawn error without a child identity still requires close before cleanup completes',async()=>{
  const f=fixture();f.child.pid=undefined;f.child.emit('error',new Error('spawn failed'));
  await assert.rejects(f.runner.waitReady(),{code:'fixture_spawn_failed'});let settled=false;
  const cleanup=f.runner.dispose().finally(()=>{settled=true;});await Promise.resolve();
  assert.equal(settled,false);assert.deepEqual(f.kills,[]);f.child.emit('close',-2,null);await cleanup;
});
