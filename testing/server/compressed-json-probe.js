/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);

/** Own the complete child lifetime so a decoder crash cannot kill the test runner. */
export async function runCompressedJsonProbe({ parserModuleUrl = new URL('../../src/server/http-hardening.js', import.meta.url) } = {}) {
  const program = `
    import assert from 'node:assert/strict';
    import express from 'express';
    import { createServer, request } from 'node:http';
    import { once } from 'node:events';
    import { deflateSync, gzipSync } from 'node:zlib';
    const { createApiJsonBodyParser } = await import(${JSON.stringify(parserModuleUrl.href)});
    const app = express();
    let activeRequest;
    app.use(createApiJsonBodyParser());
    app.post('/probe', (req, res) => {
      assert.deepEqual(req.body, { probe: 'ok' });
      if (req.headers['x-probe-split'] === 'yes') {
        assert.equal(req.complete, false);
        req.once('end', () => { res.json(req.body); });
        activeRequest.end(Buffer.alloc(1024, 0x58));
      } else res.json(req.body);
    });
    app.get('/healthz', (_req, res) => { res.end('healthy'); });
    const server = createServer(app);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    async function send(encoding, split, trailing) {
      const compressed = (encoding === 'deflate' ? deflateSync : gzipSync)(JSON.stringify({ probe: 'ok' }));
      const first = trailing ? Buffer.concat([compressed, Buffer.from([0]), ...(split ? [] : [Buffer.alloc(100*1024, 0x58)])]) : compressed;
      return new Promise((resolve, reject) => {
        activeRequest = request({ host:'127.0.0.1', port, method:'POST', path:'/probe', agent:false,
          headers:{'content-type':'application/json','content-encoding':encoding,'content-length':first.length+(split?1024:0),'x-probe-split':split?'yes':'no'} }, res => {
          let body=''; res.setEncoding('utf8'); res.on('data', chunk => { body+=chunk; });
          res.on('error',reject); res.on('end',()=>{ try { assert.equal(res.statusCode,200); assert.deepEqual(JSON.parse(body),{probe:'ok'}); resolve(res.statusCode); } catch(error){reject(error);} });
        });
        activeRequest.on('error',reject);
        activeRequest.setTimeout(5000,()=>{activeRequest.destroy(new Error('compressed probe request timeout'));});
        if(split)activeRequest.write(first);else activeRequest.end(first);
      });
    }
    let result;
    try {
      const deflateTrailing=await send('deflate',true,true);
      const gzipTrailing=await send('gzip',false,true);
      const gzipValid=await send('gzip',false,false);
      const response=await fetch('http://127.0.0.1:'+port+'/healthz');
      assert.equal(response.status,200); assert.equal(await response.text(),'healthy');
      result={deflateTrailing,gzipTrailing,gzipValid,health:response.status};
    } finally { await new Promise((resolve,reject)=>{server.close(error=>{if(error)reject(error);else resolve();});server.closeIdleConnections();}); }
    console.log(JSON.stringify(result));
  `;
  const { stdout } = await execute(process.execPath, ['--input-type=module', '-e', program], {
    windowsHide: true, timeout: 15_000, maxBuffer: 128*1024,
  });
  return JSON.parse(stdout.trim());
}
