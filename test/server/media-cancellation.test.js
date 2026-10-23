import assert from 'node:assert/strict';
import test from 'node:test';
import { createMediaInspectionService } from '../../src/server/media/media-inspection-service.js';
import { createMediaTranscodeExecutionService } from '../../src/server/media/media-transcode-execution-service.js';
import { createMediaToolingStatusService } from '../../src/server/media/media-tooling-status-service.js';
import { createFfmpegSpectralAnalyzer } from '../../src/server/media/ffmpeg-spectral-analyzer.js';
import { createImportCandidateApplyPreviewService } from '../../src/server/import-candidates/import-candidate-apply-preview-service.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });
const input = { sourcePath: '/fixture/owned.wav', filePath: '/fixture/owned.wav', transcodePlan: { recommendedAction: 'transcode_candidate' } };
const ready = async () => ({ details: { ffmpegAvailable: true, ffprobeAvailable: true } });
const consumers = [
  service => createMediaInspectionService({ mediaCommandService: service, getMediaToolingStatus: ready }).inspectSourceFile,
  service => createMediaTranscodeExecutionService({ mediaCommandService: service, getMediaToolingStatus: ready }).executeCandidate,
  service => createFfmpegSpectralAnalyzer({ mediaCommandService: service }).analyzeSpectralCutoff,
];

test('all media consumers refuse an already-aborted signal before native dispatch', async () => {
  const controller = new AbortController(); controller.abort(null);
  const service = { runCommand: async () => assert.fail('Cancelled input must not dispatch') };
  for (const build of consumers) await assert.rejects(build(service)({ ...input, signal: controller.signal }), reason => reason === null);
  await assert.rejects(createMediaToolingStatusService({ mediaCommandService: service }).getStatus({ signal: controller.signal }), reason => reason === null);
});

test('active consumer abort retains Error/null instead of publishing normal failed/unavailable results', async () => {
  for (const build of consumers) for (const reason of [new Error('owned abort'), null]) {
    const controller = new AbortController(); const entered = Promise.withResolvers(); const gate = Promise.withResolvers();
    const run = build({ runCommand: async ({ signal }) => { assert.equal(signal, controller.signal); entered.resolve(); return gate.promise; } });
    const task = run({ ...input, signal: controller.signal }); const refused = assert.rejects(task, error => error === reason);
    await entered.promise; controller.abort(reason); gate.reject(Object.assign(new Error('native abort'), { code: 'ABORT_ERR' })); await refused;
  }
});

test('tooling waits for both binary checks to settle after cancellation', async () => {
  const controller = new AbortController(); const gates = []; let settled = false;
  const tooling = createMediaToolingStatusService({ mediaCommandService: { runCommand: async ({ signal }) => {
    assert.equal(signal, controller.signal); const gate = Promise.withResolvers(); gates.push(gate); return gate.promise;
  } } });
  const task = tooling.getStatus({ signal: controller.signal }); const refused = assert.rejects(task, error => error === null);
  void task.then(() => { settled = true; }, () => { settled = true; }); controller.abort(null);
  gates[0].reject(new Error('first')); await flush(); assert.equal(settled, false); gates[1].reject(new Error('second')); await refused;
});

test('cancellation during readiness prevents later probe or encoder dispatch', async () => {
  for (const kind of ['inspection', 'preflight']) {
    const controller = new AbortController(); const gate = Promise.withResolvers();
    const options = { getMediaToolingStatus: async ({ signal }) => { assert.equal(signal, controller.signal); return gate.promise; },
      mediaCommandService: { runCommand: async () => assert.fail('Readiness cancellation fences native dispatch') } };
    const service = kind === 'inspection' ? createMediaInspectionService(options).inspectSourceFile : createMediaTranscodeExecutionService(options).executeCandidate;
    const task = service({ ...input, signal: controller.signal }); const refused = assert.rejects(task, error => error === null);
    controller.abort(null); gate.resolve(await ready()); await refused;
  }
});

test('preview drains every admitted sibling before propagating the first Error/null', async () => {
  for (const original of [new Error('first sibling'), null]) {
    const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let calls = 0; let settled = false;
    const preview = createImportCandidateApplyPreviewService({ previewImportCandidate: async () => ({ naming: { filePreviews: [1, 2].map(id => ({ fileId: String(id), sourcePath: `/fixture/${id}.wav` })) } }),
      statFn: async () => ({ isDirectory: () => false, size: 12 }), mediaInspectionService: { inspectSourceFile: async () => {
        if (++calls === 1) throw original; entered.resolve(); await gate.promise; return { metadata: null, warnings: [] };
      } } });
    const task = preview.previewImportCandidateApply({ importCandidateId: 'owned' }); const refused = assert.rejects(task, error => error === original);
    void task.then(() => { settled = true; }, () => { settled = true; }); await entered.promise; await flush(); assert.equal(settled, false);
    gate.resolve(); await refused;
  }
});
