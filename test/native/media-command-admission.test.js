import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createMediaCommandAdmission } from '../../src/server/media/media-command-admission.js';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';
import { createMediaInspectionService } from '../../src/server/media/media-inspection-service.js';
import { createMediaTranscodeExecutionService } from '../../src/server/media/media-transcode-execution-service.js';
import { createMediaToolingStatusService } from '../../src/server/media/media-tooling-status-service.js';
import { createFfmpegSpectralAnalyzer } from '../../src/server/media/ffmpeg-spectral-analyzer.js';

assert.equal(process.platform, 'linux', 'Explicit Linux native lane');

test('native Linux exit retains admission until descendant-held stdio closes', { timeout: 15_000 }, async () => {
  const root = await mkdtemp('/tmp/harmoniarr-media-stdio-'); const release = join(root, 'release');
  const exited = Promise.withResolvers(); const records = [];
  const service = createMediaCommandService({ allowedBinaries: [process.execPath],
    admission: createMediaCommandAdmission({ concurrency: 1 }), spawnFn: (...args) => {
      assert.ok(records.every(row => row.closed)); const child = spawn(...args); const row = { child, closed: false }; records.push(row);
      child.once('exit', () => exited.resolve()); child.once('close', () => { row.closed = true; }); return child;
    } });
  const descendant = `import { existsSync } from 'node:fs'; const timer = setInterval(() => { if (existsSync(${JSON.stringify(release)})) { clearInterval(timer); process.stdout.write('drained'); } }, 10);`;
  const source = `import { spawn } from 'node:child_process'; spawn(process.execPath, ['--input-type=module', '-e', ${JSON.stringify(descendant)}], { stdio: ['ignore', 1, 2] }).unref();`;
  const first = service.runCommand({ binary: process.execPath, args: ['--input-type=module', '-e', source] });
  const second = service.runCommand({ binary: process.execPath, args: ['-e', "process.stdout.write('next')"] });
  try {
    await exited.promise; assert.equal(records[0].closed, false); assert.equal(records.length, 1);
    assert.deepEqual(service.getAdmissionState(), { active: 1, queued: 1 });
    await writeFile(release, 'release');
    assert.equal((await first).stdout, 'drained'); assert.equal((await second).stdout, 'next');
    assert.ok(records.every(row => row.closed)); assert.deepEqual(service.getAdmissionState(), { active: 0, queued: 0 });
  } finally { await writeFile(release, 'release'); await Promise.allSettled([first, second]); await rm(root, { recursive: true, force: true }); }
});

test('one shared FIFO executes actual tooling, inspection, encoding and spectral consumers', { timeout: 30_000 }, async () => {
  const root = await mkdtemp('/tmp/harmoniarr-media-admission-'); const source = join(root, 'source.wav');
  const ready = Promise.withResolvers(); const records = []; const tasks = []; let holdChild;
  const service = createMediaCommandService({ allowedBinaries: ['ffmpeg', 'ffprobe', process.execPath],
    admission: createMediaCommandAdmission({ concurrency: 1 }), defaultTimeoutMs: 10_000,
    spawnFn: (binary, args, options) => {
      assert.ok(records.every(row => row.closed)); assert.equal(options.shell, false);
      const child = spawn(binary, args, binary === process.execPath ? { ...options, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] } : options);
      const row = { binary, child, closed: false, code: null }; records.push(row);
      child.once('close', code => { row.closed = true; row.code = code; });
      if (binary === process.execPath) { holdChild = child; child.once('message', () => ready.resolve()); }
      return child;
    } });
  const digest = async () => createHash('sha256').update(await readFile(source)).digest('hex');
  try {
    await service.runCommand({ binary: 'ffmpeg', args: ['-v', 'error', '-nostdin', '-f', 'lavfi', '-i', 'sine=frequency=997:sample_rate=48000:duration=1',
      '-ac', '2', '-c:a', 'pcm_s16le', source] });
    const original = await digest();
    const hold = service.runCommand({ binary: process.execPath, args: ['-e', "process.send('ready'); process.on('message', () => process.disconnect());"] });
    tasks.push(hold); await ready.promise;
    const getMediaToolingStatus = async () => ({ details: { ffmpegAvailable: true, ffprobeAvailable: true } });
    const tooling = createMediaToolingStatusService({ mediaCommandService: service });
    const inspection = createMediaInspectionService({ mediaCommandService: service, getMediaToolingStatus });
    const encoding = createMediaTranscodeExecutionService({ mediaCommandService: service, getMediaToolingStatus, ffmpegThreads: 2 });
    const spectral = createFfmpegSpectralAnalyzer({ mediaCommandService: service });
    tasks.push(tooling.getStatus(), inspection.inspectSourceFile({ sourcePath: source }),
      encoding.executeCandidate({ sourcePath: source, transcodePlan: { recommendedAction: 'transcode_candidate', target: { audioCodec: 'opus' } } }),
      spectral.analyzeSpectralCutoff({ filePath: source }));
    await new Promise(resolve => { setImmediate(resolve); });
    assert.deepEqual(service.getAdmissionState(), { active: 1, queued: 5 }); assert.equal(records.length, 2);
    holdChild.send('finish');
    const [, toolingResult, inspectionResult, encodingResult, spectralResult] = await Promise.all(tasks);
    assert.equal(toolingResult.status, 'healthy'); assert.deepEqual(inspectionResult.metadata.audioCodecs, ['pcm_s16le']);
    assert.equal(encodingResult.status, 'preflight_passed'); assert.equal(encodingResult.mode, 'preflight_only');
    assert.ok(spectralResult.frameCount > 0); assert.ok(spectralResult.cutoffHz > 0); assert.equal(await digest(), original);
    assert.equal(records.length, 7); assert.ok(records.every(row => row.closed && row.code === 0));
    assert.deepEqual(service.getAdmissionState(), { active: 0, queued: 0 });
  } finally {
    if (holdChild?.connected) holdChild.send('finish');
    await Promise.allSettled(tasks); await rm(root, { recursive: true, force: true });
  }
});
