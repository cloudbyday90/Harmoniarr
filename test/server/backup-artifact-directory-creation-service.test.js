/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { join, resolve, dirname } from 'node:path';
import test from 'node:test';
import { createBackupArtifactDirectoryCreationService } from '../../src/server/recovery/backup-artifact-directory-creation-service.js';

function fixture({ hook = async () => {} } = {}) {
  const anchor=resolve('creation-fixture'),root=join(anchor,'backups'),leaf=join(root,'year','month'),events=[];
  let nextInode=1n;
  const facts=()=>({dev:1n,ino:nextInode++,isDirectory:()=>true});
  const nodes=new Map([[anchor,facts()]]);
  const service=()=>createBackupArtifactDirectoryCreationService({backupsDirectory:root,
    assertOwnership:async()=>{await hook('owner',null);},
    lstatFn:async path=>{await hook('stat',path);if(!nodes.has(path))throw Object.assign(new Error('missing'),{code:'ENOENT'});return nodes.get(path);},
    mkdirFn:async(path,options)=>{
      events.push(['mkdir',path]);assert.deepEqual(options,{mode:0o700});assert.ok(nodes.get(dirname(path))?.isDirectory());await hook('mkdir',path);
      if(nodes.has(path))throw Object.assign(new Error('exists'),{code:'EEXIST'});nodes.set(path,facts());
    },
    directorySyncService:{syncDirectory:async({directory})=>{events.push(['sync',directory]);await hook('sync',directory);}},
  });
  return {anchor,root,leaf,events,nodes,service,facts,input:{storagePaths:[join(leaf,'backup.json')],createMissing:true}};
}

test('cold directory chain creates private parents in order then checkpoints leaf through anchor', async()=>{
  const f=fixture();await f.service().prepareArtifactDirectories(f.input);
  assert.deepEqual(f.events,[['mkdir',f.root],['mkdir',join(f.root,'year')],['mkdir',f.leaf],['sync',f.leaf],['sync',join(f.root,'year')],['sync',f.root],['sync',f.anchor]]);
});

test('fresh retry checkpoints the full existing chain after a partial sync Error or null', async()=>{
  for(const failure of [new Error('sync failed'),null]){
    let failed=false;const f=fixture({hook:async(kind,path)=>{if(kind==='sync'&&path===f.root&&!failed){failed=true;throw failure;}}});
    await assert.rejects(f.service().prepareArtifactDirectories(f.input),error=>error===failure);
    f.events.length=0;await f.service().prepareArtifactDirectories(f.input);
    assert.deepEqual(f.events.filter(([kind])=>kind==='sync').map(([,path])=>path),[f.leaf,join(f.root,'year'),f.root,f.anchor]);
  }
});

test('partial nonrecursive mkdir failure leaves created directories and a new attempt completes the chain', async()=>{
  const failure=Object.assign(new Error('denied'),{code:'EACCES'});let fail=true;
  const f=fixture({hook:async(kind,path)=>{if(fail&&kind==='mkdir'&&path===join(f.root,'year'))throw failure;}});
  await assert.rejects(f.service().prepareArtifactDirectories(f.input),error=>error===failure);
  assert.ok(f.nodes.has(f.root));assert.ok(!f.nodes.has(f.leaf));assert.ok(!f.events.some(([kind])=>kind==='sync'));
  fail=false;await f.service().prepareArtifactDirectories(f.input);assert.ok(f.nodes.has(f.leaf));
});

test('scope, component depth and creation-mode refusal happens before filesystem work', async()=>{
  let filesystemCalls=0;const f=fixture({hook:async()=>{filesystemCalls++;}});
  for(const storagePaths of [[],[join(f.anchor,'other','file')],[join(f.root+'-sibling','file')],[f.root],[join(f.root,...Array(32).fill('level'),'file')],[null],[''],['a','b','c']]){
    await assert.rejects(f.service().prepareArtifactDirectories({storagePaths,createMissing:true}),{code:'backup_artifact_directory_scope_invalid'});
  }
  await assert.rejects(f.service().prepareArtifactDirectories({...f.input,createMissing:'yes'}),{code:'backup_artifact_directory_scope_invalid'});
  assert.deepEqual(f.events,[]);
  assert.equal(filesystemCalls,0);
});

test('missing anchor and symlink or non-directory components cannot be created around', async()=>{
  const missing=fixture();missing.nodes.clear();
  await assert.rejects(missing.service().prepareArtifactDirectories(missing.input),{code:'ENOENT'});assert.deepEqual(missing.events,[]);
  for(const badPath of ['anchor','root']){
    const f=fixture();f.nodes.set(f[badPath],{...f.facts(),isDirectory:()=>false});
    await assert.rejects(f.service().prepareArtifactDirectories(f.input),{code:'backup_artifact_directory_scope_invalid'});
    assert.ok(!f.events.some(([kind])=>kind==='sync'));
  }
});

test('recovery performs no mkdir and checkpoints both recorded branches without duplicate ancestors', async()=>{
  const f=fixture();await f.service().prepareArtifactDirectories(f.input);const other=join(f.root,'other');f.nodes.set(other,f.facts());f.events.length=0;
  await f.service().prepareArtifactDirectories({storagePaths:[...f.input.storagePaths,join(other,'temporary.partial')]});
  assert.ok(f.events.every(([kind])=>kind==='sync'));
  assert.equal(f.events.filter(([,path])=>path===f.root).length,1);assert.equal(f.events.filter(([,path])=>path===f.anchor).length,1);
  assert.equal(f.events.at(-1)[1],f.anchor);
  f.nodes.delete(f.leaf);f.events.length=0;
  await assert.rejects(f.service().prepareArtifactDirectories({storagePaths:f.input.storagePaths}),{code:'ENOENT'});assert.deepEqual(f.events,[]);
});

test('replacement during checkpoints and ownership loss refuse directory acceptance', async()=>{
  let f;f=fixture({hook:async(kind,path)=>{if(kind==='sync'&&path===f.anchor)f.nodes.set(f.root,f.facts());}});
  await assert.rejects(f.service().prepareArtifactDirectories(f.input),{code:'backup_artifact_directory_scope_invalid'});
  const failure=new Error('owner lost');let lost=false;
  const owner=fixture({hook:async(kind)=>{if(kind==='sync')lost=true;if(kind==='owner'&&lost)throw failure;}});
  await assert.rejects(owner.service().prepareArtifactDirectories(owner.input),error=>error===failure);
  assert.equal(owner.events.filter(([kind])=>kind==='sync').length,1);
});
