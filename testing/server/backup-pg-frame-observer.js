/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
// Inspect framing only. Never retain authentication data, row payloads or cancellation keys.
export function createBackupPgFrameObserver(){
  let pending=Buffer.alloc(0),backendPid,ready,command,error=false;
  const invalid=()=>{throw new Error('Invalid fixture PostgreSQL frame');};
  return {
    push(chunk){
      if(!Buffer.isBuffer(chunk)||pending.length+chunk.length>1_048_576)invalid();
      pending=Buffer.concat([pending,chunk]);
      while(pending.length>=5){
        const length=pending.readInt32BE(1);if(length<4||length>1_048_575)invalid();
        if(pending.length<length+1)break;
        const type=pending[0],payload=pending.subarray(5,length+1);
        if(type===75){
          if(payload.length<8||payload.length>260)invalid();
          backendPid=payload.readInt32BE(0);if(backendPid<=1)invalid();
        }else if(type===67){
          if(payload.length<2||payload.length>64||payload.at(-1)!==0)invalid();
          const tag=payload.toString('ascii',0,payload.length-1);
          command=/^(INSERT|UPDATE|DELETE)(?: [0-9]+){1,2}$/u.exec(tag)?.[1]??null;ready=undefined;
        }else if(type===90){
          if(payload.length!==1||!['I','T','E'].includes(String.fromCharCode(payload[0])))invalid();
          ready=String.fromCharCode(payload[0]);
        }else if(type===69)error=true;
        pending=pending.subarray(length+1);
      }
      // Copy partial frames so a tiny remainder cannot retain a large sensitive packet.
      pending=Buffer.from(pending);
    },
    reset(){if(pending.length)invalid();ready=undefined;command=undefined;error=false;},
    state:()=>({backendPid,ready,command,error,partialBytes:pending.length}),
  };
}
