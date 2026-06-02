import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  assertIssue4EvidenceFileReferences,
  collectIssue4EvidenceTestPaths,
  issue4ReleaseEvidenceSteps,
  renderIssue4ReleaseEvidenceMap,
  validateIssue4ReleaseEvidenceMap,
  writeIssue4ReleaseEvidenceMap,
} from '../../scripts/issue-4-release-evidence-map.js';

test('validateIssue4ReleaseEvidenceMap requires every shipped Issue #4 step exactly once', () => {
  const result = validateIssue4ReleaseEvidenceMap(issue4ReleaseEvidenceSteps);

  assert.equal(result.stepCount, 28);
  assert.deepEqual(
    issue4ReleaseEvidenceSteps.map((step) => step.step).sort((left, right) => left - right),
    Array.from({ length: 28 }, (_value, index) => index + 1),
  );
});

test('validateIssue4ReleaseEvidenceMap rejects missing steps and empty evidence fields', () => {
  const incompleteSteps = issue4ReleaseEvidenceSteps
    .filter((step) => step.step !== 28)
    .map((step) => (step.step === 1 ? { ...step, focusedTests: [] } : step));

  assert.throws(
    () => validateIssue4ReleaseEvidenceMap(incompleteSteps),
    /Step 1 focusedTests must be a non-empty array[\s\S]*Step 28 is missing/,
  );
});

test('collectIssue4EvidenceTestPaths returns unique repository test paths', () => {
  const testPaths = collectIssue4EvidenceTestPaths();

  assert.ok(testPaths.length > 20);
  assert.equal(new Set(testPaths).size, testPaths.length);
  assert.ok(testPaths.includes('test/browser/operator-ui-smoke.test.js'));
  assert.ok(testPaths.includes('test/client/discover-graph.test.js'));
  assert.ok(testPaths.includes('test/server/library-release-radar-service.test.js'));
});

test('assertIssue4EvidenceFileReferences verifies referenced tests exist', async () => {
  const result = await assertIssue4EvidenceFileReferences();

  assert.ok(result.checkedFiles > 20);
});

test('renderIssue4ReleaseEvidenceMap includes sources, gates, and every step section', () => {
  const markdown = renderIssue4ReleaseEvidenceMap();

  assert.match(markdown, /^# Issue #4 Release Validation Evidence Map/);
  assert.match(markdown, /https:\/\/docs\.github\.com\/en\/actions\/tutorials\/store-and-share-data/);
  assert.match(markdown, /https:\/\/nodejs\.org\/api\/test\.html/);
  assert.match(markdown, /\| `npm test` \|/);
  assert.match(markdown, /## Step 1 - Navigation and shell/);
  assert.match(markdown, /## Step 28 - Release Radar and Coming Soon full page/);
});

test('writeIssue4ReleaseEvidenceMap writes the generated markdown artifact', async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'harmoniarr-issue-4-evidence-'));

  try {
    const result = await writeIssue4ReleaseEvidenceMap({
      outputPath: join(tempDirectory, 'ISSUE_4_RELEASE_VALIDATION_EVIDENCE.md'),
    });

    const markdown = await readFile(result.outputPath, 'utf8');
    assert.equal(result.stepCount, 28);
    assert.match(markdown, /Issue #4 Release Validation Evidence Map/);
    assert.match(markdown, /Focused tests:/);
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
});
