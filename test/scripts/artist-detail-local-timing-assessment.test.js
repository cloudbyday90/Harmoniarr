/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessArtistDetailLocalTimingEvidence,
  renderArtistDetailLocalTimingAssessment,
} from '../../scripts/artist-detail-local-timing-assessment.js';
import {
  parseArtistDetailLocalTimingEvidence,
  readArtistDetailLocalTimingEvidence,
  resolveArtistDetailLocalTimingEvidencePath,
  resolveArtistDetailLocalTimingAssessmentInputs,
  runArtistDetailLocalTimingAssessment,
} from '../../scripts/assess-artist-detail-local-timing.js';
import { createArtistDetailLocalTimingBatchEvidence } from '../../scripts/artist-detail-local-timing-batch-evidence.js';
import { createArtistDetailLocalTimingEvidence } from '../../scripts/artist-detail-local-timing-evidence.js';

function createRequest(endpoint) {
  return {
    endpoint,
    statusFamily: '2xx',
    timing: {
      clientRequestDurationMs: 12,
      responseEndMs: 12,
      startTimeMs: 0,
    },
  };
}

function createSample({
  outcome = 'local_projection',
  presentationState = 'ready',
} = {}) {
  const requests = outcome === 'local_projection'
    ? [createRequest('local_metadata'), createRequest('operator_projection')]
    : outcome === 'provider_fallback_after_local_lookup'
      ? [createRequest('local_metadata'), createRequest('discography')]
      : [
        createRequest('local_metadata'),
        createRequest('operator_projection'),
        createRequest('discography'),
      ];

  return createArtistDetailLocalTimingEvidence({
    capturedAt: '2026-08-30T12:00:00.000Z',
    outcome,
    presentation: { observedAtMs: 40, state: presentationState },
    requests,
  });
}

test('Artist Detail timing assessment selects the most conservative supported action', () => {
  const cases = [
    {
      evidence: createSample(),
      expected: {
        captureScope: 'single_capture',
        nextAction: 'reproduce_affected_case',
        observation: 'discography_ready_with_local_projection',
      },
    },
    {
      evidence: createSample({
        outcome: 'provider_fallback_after_local_lookup',
        presentationState: 'still_loading',
      }),
      expected: {
        captureScope: 'single_capture',
        nextAction: 'inspect_client_loading_lifecycle',
        observation: 'discography_still_loading',
      },
    },
    {
      evidence: createSample({ presentationState: 'unavailable' }),
      expected: {
        captureScope: 'single_capture',
        nextAction: 'inspect_discography_availability',
        observation: 'discography_unavailable',
      },
    },
    {
      evidence: createArtistDetailLocalTimingBatchEvidence({
        capturedAt: '2026-08-30T12:05:00.000Z',
        samples: [
          createSample(),
          createSample({ outcome: 'provider_fallback_after_local_lookup' }),
        ],
      }),
      expected: {
        captureScope: 'repeated_capture',
        nextAction: 'reproduce_route_variation',
        observation: 'artist_detail_route_varies',
      },
    },
    {
      evidence: createArtistDetailLocalTimingBatchEvidence({
        capturedAt: '2026-08-30T12:05:00.000Z',
        samples: [
          createSample({ outcome: 'provider_fallback_after_local_lookup' }),
          createSample({ outcome: 'provider_fallback_after_local_lookup' }),
        ],
      }),
      expected: {
        captureScope: 'repeated_capture',
        nextAction: 'inspect_provider_cache_path',
        observation: 'provider_discography_fallback',
      },
    },
  ];

  for (const { evidence, expected } of cases) {
    assert.deepEqual(assessArtistDetailLocalTimingEvidence(evidence), expected);
  }
});

test('Artist Detail timing assessment renders fixed guidance without evidence values', () => {
  const output = renderArtistDetailLocalTimingAssessment(createSample());

  assert.match(output, /Discography settled with the local projection path/u);
  assert.match(output, /Reproduce the reported account and artist/u);
  assert.equal(output.includes('2026-08-30'), false);
  assert.equal(output.includes('local_metadata'), false);
  assert.equal(output.includes('40'), false);
});

test('Artist Detail timing assessment rejects unbounded evidence before selecting an action', () => {
  assert.throws(
    () => assessArtistDetailLocalTimingEvidence({
      ...createSample(),
      username: 'local-admin',
    }),
    /username is not allowed/u,
  );
});

test('Artist Detail timing assessment CLI accepts only a workspace-local evidence path', async () => {
  const sample = createSample();
  const inputs = resolveArtistDetailLocalTimingAssessmentInputs({
    args: ['--evidence-path', 'artifacts/artist-detail-timing.json'],
  });

  assert.deepEqual(inputs, { evidencePath: 'artifacts/artist-detail-timing.json' });
  const assessment = await runArtistDetailLocalTimingAssessment({
    args: ['--evidence-path', 'artifacts/artist-detail-timing.json'],
    cwd: process.cwd(),
    readFileFn: async (filePath, encoding) => {
      assert.match(filePath, /artifacts[\\/]artist-detail-timing\.json$/u);
      assert.equal(encoding, 'utf8');
      return JSON.stringify(sample);
    },
    realpathFn: async (filePath) => filePath,
  });
  assert.equal(assessment.nextAction, 'reproduce_affected_case');

  await assert.rejects(
    readArtistDetailLocalTimingEvidence({
      cwd: process.cwd(),
      evidencePath: '../outside-workspace.json',
      readFileFn: async () => JSON.stringify(sample),
      realpathFn: async (filePath) => filePath,
    }),
    /must remain within the working directory/u,
  );
  await assert.rejects(
    readArtistDetailLocalTimingEvidence({
      evidencePath: 'artifacts/missing.json',
      readFileFn: async () => {
        throw new Error('ENOENT: C:/private-path');
      },
      realpathFn: async (filePath) => filePath,
    }),
    (error) => error.message === 'Artist Detail timing evidence could not be read',
  );
  await assert.rejects(
    resolveArtistDetailLocalTimingEvidencePath({
      cwd: 'C:\\workspace',
      evidencePath: 'artifacts/linked-evidence.json',
      realpathFn: async (filePath) => filePath.endsWith('linked-evidence.json')
        ? 'C:\\outside\\evidence.json'
        : 'C:\\workspace',
    }),
    /must remain within the working directory/u,
  );
  assert.throws(
    () => parseArtistDetailLocalTimingEvidence('{not-json'),
    /must be valid JSON/u,
  );
  assert.throws(
    () => resolveArtistDetailLocalTimingAssessmentInputs({ args: [] }),
    /evidence-path is required/u,
  );
});
