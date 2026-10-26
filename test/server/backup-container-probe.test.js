/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import test from 'node:test';
import {backupContainerProtocolPrefix,parseBackupContainerMessage} from '../../testing/server/backup-container-protocol.js';
import {startBackupContainerProbe} from '../../testing/server/backup-container-probe.js';
import {assertBackupContainerRuntime,backupContainerCreateArgs} from '../../testing/server/backup-container-lifecycle.js';
const id='a'.repeat(64),hash='b'.repeat(64),checkpoint='publish-intent-wait-rollback';
const message={event:'prepared',checkpoint,containerId:id,clusterId:'12345',snapshotSha256:hash};
const line=value=>backupContainerProtocolPrefix+JSON.stringify(value)+'\n';
function fixture(){
  const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();let killed=false;
  child.kill=()=>{killed=true;};let arguments_,options;
  const probe=startBackupContainerProbe({phase:'prepare',checkpoint,containerId:id,spawnFn:(command,args,config)=>{assert.equal(command,'docker');arguments_=args;options=config;return child;}});
  return {child,probe,wasKilled:()=>killed,args:()=>arguments_,options:()=>options};
}
test('container protocol binds exact finite checkpoint, container and saved record identity',()=>{
  assert.deepEqual(parseBackupContainerMessage(line(message).trim(),{phase:'prepare',checkpoint,containerId:id}),message);
  for(const change of [{containerId:'c'.repeat(64)},{checkpoint:'delete-intent-lost-ack'},{event:'verified'},{clusterId:'remote'},{snapshotSha256:'short'},{extra:true}]){
    assert.throws(()=>parseBackupContainerMessage(line({...message,...change}).trim(),{phase:'prepare',checkpoint,containerId:id}));
  }
  assert.throws(()=>parseBackupContainerMessage(line({...message,extra:'x'.repeat(4096)}),{phase:'prepare',checkpoint,containerId:id}));
});
test('container probe handles split readiness and requires observed killed exec close',async()=>{
  const f=fixture(),text=line(message);f.child.stdout.emit('data',Buffer.from(text.slice(0,20)));f.child.stdout.emit('data',Buffer.from(text.slice(20)));
  assert.deepEqual(await f.probe.waitReady(),message);let finished=false;
  const completion=f.probe.complete(137).finally(()=>{finished=true;});await Promise.resolve();assert.equal(finished,false);
  f.child.emit('close',137,null);await completion;assert.equal(f.probe.isClosed(),true);
  assert.deepEqual(f.args().slice(0,4),['exec',id,'node','/app/testing/server/backup-container-stage.js']);assert.equal(f.options().shell,false);await f.probe.dispose();
});
test('probe protocol faults stay failed and oversized output refuses readiness',async()=>{
  for(const oversized of [false,true]){
    const f=fixture();
    if(oversized)f.child.stderr.emit('data',Buffer.alloc(32769));else f.child.stdout.emit('data',Buffer.from(line({...message,containerId:'c'.repeat(64)})));
    f.child.stdout.emit('data',Buffer.from(line(message)));
    await assert.rejects(f.probe.waitReady(),{code:oversized?'probe_output_budget':'probe_protocol_failed'});
    const cleanup=f.probe.dispose();assert.equal(f.wasKilled(),true);f.child.emit('close',137,null);await cleanup;
  }
});
test('probe refuses early success, wrong exit and spawn failure while cleanup waits for close',async()=>{
  const absent=fixture();absent.child.emit('close',0,null);await assert.rejects(absent.probe.complete(0),{code:'probe_close_unverified'});await absent.probe.dispose();
  const wrong=fixture();wrong.child.stdout.emit('data',Buffer.from(line(message)));await wrong.probe.waitReady();wrong.child.emit('close',0,null);
  await assert.rejects(wrong.probe.complete(137),{code:'probe_close_unverified'});await wrong.probe.dispose();
  const failed=fixture();failed.child.emit('error',new Error('spawn failed'));await assert.rejects(failed.probe.waitReady(),{code:'probe_spawn_failed'});
  let done=false;const cleanup=failed.probe.dispose().finally(()=>{done=true;});await Promise.resolve();assert.equal(done,false);failed.child.emit('close',-2,null);await cleanup;
});
test('invalid container/checkpoint/record input refuses launch',()=>{
  let launched=0;
  for(const change of [{containerId:'foreign'},{phase:'other'},{checkpoint:'untrusted'},{expected:['unexpected']}]){
    assert.throws(()=>startBackupContainerProbe({phase:'prepare',checkpoint,containerId:id,spawnFn:()=>{launched++;throw new Error('must not launch');},...change}));
  }
  assert.equal(launched,0);
});
test('replacement arguments retain production command, isolated volume and public fixture configuration',()=>{
  const args=backupContainerCreateArgs({volumeName:'owned',profileId:'fixture',evidenceDir:'.tmp/fixture',image:'sha256:'+hash});
  assert.equal(args.at(-1),'sha256:'+hash);assert.ok(!args.includes('--entrypoint'));assert.ok(!args.some(value=>value.includes('TEST_DISABLE_BACKGROUND_SERVICES')));
  assert.ok(args.includes('type=volume,source=owned,target=/app/data'));assert.ok(!args.includes('--publish'));
});
test('runtime inspection refuses command/entrypoint/background overrides',()=>{
  const profileId='fixture',volumeName='owned',image='sha256:'+hash;
  const create=()=>({Image:image,Path:'/usr/local/bin/harmoniarr-entrypoint',Config:{Labels:{'harmoniarr.backup-pg-crash':profileId},User:'1000:1000',
    Entrypoint:['/usr/local/bin/harmoniarr-entrypoint'],Cmd:['node','/app/server-dist/index.js'],Env:[]},
    HostConfig:{NetworkMode:'none',ReadonlyRootfs:true,Memory:3*1024**3,MemorySwap:3*1024**3,NanoCpus:2e9,PidsLimit:256,PortBindings:{}},
    Mounts:[{Destination:'/app/data',Type:'volume',Name:volumeName,Driver:'local',RW:true}]});
  assertBackupContainerRuntime(create(),volumeName,profileId,image);
  for(const mutate of [value=>{value.Config.Cmd=['node','fixture.js'];},value=>{value.Config.Entrypoint=['sh'];},value=>{value.Config.Env=['HARMONIARR_TEST_DISABLE_BACKGROUND_SERVICES=true'];}]){
    const value=create();mutate(value);assert.throws(()=>assertBackupContainerRuntime(value,volumeName,profileId,image));
  }
});
