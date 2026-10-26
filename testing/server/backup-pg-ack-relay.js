/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createConnection, createServer } from 'node:net';
import { createBackupPgFrameObserver } from './backup-pg-frame-observer.js';

// Disposable loopback fixture only: consume a target response without delivering any bytes.
export async function createBackupPgAckRelay({port=5432}={}){
  assert.ok(Number.isInteger(port)&&port>0&&port<=65535);
  const connections=new Set();let failure,selected,withheldBytes=0;
  const fail=()=>{failure??=new Error('Backup acknowledgement relay failed');};
  const server=createServer(front=>{
    if(connections.size>=4){fail();front.destroy();return;}
    const back=createConnection({host:'127.0.0.1',port}),observer=createBackupPgFrameObserver();
    const row={front,back,observer,armed:false,closed:[]};connections.add(row);
    for(const socket of [front,back]){
      row.closed.push(new Promise(resolve=>{socket.once('close',resolve);}));
      socket.on('error',fail);
    }
    front.pipe(back,{end:false});
    front.on('close',()=>{if(!row.armed)back.destroy();});
    back.on('close',()=>{if(!row.armed)front.destroy();});
    back.on('data',chunk=>{
      try{
        observer.push(chunk);
        if(row.armed){withheldBytes+=chunk.length;if(withheldBytes>2_097_152)throw new Error('Relay budget');}
        else if(!front.write(chunk)){back.pause();front.once('drain',()=>back.resume());}
      }catch{fail();front.destroy();back.destroy();}
    });
  });
  server.on('error',fail);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});});
  return {
    port:server.address().port,
    arm(pid){
      if(failure)throw failure;
      assert.equal(selected,undefined);selected=[...connections].find(row=>row.observer.state().backendPid===pid);assert.ok(selected);
      assert.equal(selected.observer.state().ready,'I');selected.observer.reset();selected.armed=true;
    },
    state(){
      if(failure)throw failure;
      return {...selected?.observer.state(),withheldBytes};
    },
    async close(){
      const stopped=new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());});
      for(const row of connections){row.front.destroy();row.back.destroy();}
      await Promise.all([...connections].flatMap(row=>row.closed));await stopped;
    },
  };
}
