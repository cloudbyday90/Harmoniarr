/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const issue4ReleaseEvidenceMapOutputPath = 'docs/ISSUE_4_RELEASE_VALIDATION_EVIDENCE.md';
export const issue4ImplementationPlanPath = 'docs/issue-4-implementation-plan.md';
export const issue4ReleaseValidationPlanPath = 'docs/RELEASE_VALIDATION_TASK_LIST.md';

export const issue4OfficialEvidenceSources = Object.freeze([
  {
    label: 'GitHub Actions workflow artifacts',
    notes: 'Release evidence should be archived as workflow artifacts so test, smoke, and deployment proof survives the job log.',
    url: 'https://docs.github.com/en/actions/tutorials/store-and-share-data',
  },
  {
    label: 'Node.js test runner',
    notes: 'Focused script validation uses ESM-compatible node:test suites invoked with node --test.',
    url: 'https://nodejs.org/api/test.html',
  },
  {
    label: 'Playwright visual comparisons',
    notes: 'High-risk visual surfaces should use committed screenshots from a stable runner environment when visual drift matters.',
    url: 'https://playwright.dev/docs/test-snapshots',
  },
  {
    label: 'Docker build attestations',
    notes: 'Packaged-runtime release evidence should retain image provenance and SBOM context with the release artifact set.',
    url: 'https://docs.docker.com/build/metadata/attestations/',
  },
]);

export const issue4ReleaseEvidenceGates = Object.freeze([
  {
    command: 'npm test',
    purpose: 'Repository-wide lint, hygiene, server, client, script, and integration confidence.',
  },
  {
    command: 'npm run build',
    purpose: 'Client and server build confidence before packaging or release evidence capture.',
  },
  {
    command: 'npm run db:check-schema',
    purpose: 'Authoritative schema snapshot and fresh-install schema agreement.',
  },
  {
    command: 'npm run test:browser',
    purpose: 'Native Playwright browser coverage for requester and operator paths.',
  },
  {
    command: 'npm run validate:release-evidence-pack',
    purpose: 'Packaged-runtime Docker evidence pack, with optional released-image, upgrade, and browser-smoke proof.',
  },
]);

export const issue4ReleaseEvidenceSteps = Object.freeze([
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/app-shell-presentation.test.js',
      'test/server/route-inventory.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture role-specific navigation proof in the browser evidence pack.',
      'Confirm requester-restricted route inventory remains fail-closed.',
    ],
    releaseGap: 'Add visual screenshot proof for mobile requester navigation before final release sign-off.',
    schemaEvidence: ['No schema change; covered by migration and schema gates.'],
    step: 1,
    title: 'Navigation and shell',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/useMonitoredArtistSummaries.test.js',
      'test/client/useRequesterHome-swr.test.js',
      'test/client/app-shell-presentation.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture requester Home cold-start and populated grid paths in packaged browser evidence.',
      'Archive Home smoke evidence with the release evidence pack.',
    ],
    releaseGap: 'Add artwork-grid visual evidence for requester Home.',
    schemaEvidence: ['No schema change; projection behavior is covered by service and client tests.'],
    step: 2,
    title: 'Requester home page',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/discover-graph.test.js',
      'test/client/discover-presentation.test.js',
      'test/client/useDiscoverGraph.test.js',
      'test/client/useDiscoverSearch.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture Discover search, add-to-monitored-artists, and recommendation states in browser evidence.',
      'Confirm recommendation empty/error states remain readable on mobile.',
    ],
    releaseGap: 'Add visual screenshot proof for Discover recommendation cards and selected artist chips.',
    schemaEvidence: ['No schema change; monitored-artist persistence is covered by existing metadata gates.'],
    step: 3,
    title: 'Discover screen',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/server/similar-artists-service.test.js',
      'test/server/similar-artists-fallback-service.test.js',
      'test/server/listenbrainz-client.test.js',
      'test/server/musicbrainz-client.test.js',
      'test/server/metadata-routes.test.js',
    ],
    releaseEvidenceTasks: [
      'Verify graceful empty recommendations when external providers return unavailable or sparse data.',
      'Retain provider behavior evidence in route and service tests.',
    ],
    releaseGap: 'Add one packaged-runtime provider-degraded smoke note if external provider behavior changes near release.',
    schemaEvidence: ['No schema change.'],
    step: 4,
    title: 'External similarity service integration',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/release-artwork-resolve.test.js',
      'test/server/artwork-fetch-service.test.js',
      'test/server/artwork-ingestion-service.test.js',
      'test/server/artwork-routes.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture artwork fallback behavior in browser evidence for artist and release cards.',
      'Preserve artwork route and ingestion tests as focused release proof.',
    ],
    releaseGap: 'Add visual evidence for placeholder, remote CAA, and local artwork card states.',
    schemaEvidence: ['Artwork asset schema is covered by migration replay and schema snapshot gates.'],
    step: 5,
    title: 'Artwork infrastructure',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/my-requests-presentation.test.js',
      'test/client/request-status.test.js',
      'test/client/useMyRequests.test.js',
      'test/integration/library-media-requests.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture requester My Requests list, empty state, and cancellation visibility.',
      'Include delegated request visibility in packaged-runtime smoke evidence.',
    ],
    releaseGap: 'Add packaged browser proof for requester-only My Requests navigation.',
    schemaEvidence: ['Media request schema is covered by migration replay and schema snapshot gates.'],
    step: 6,
    title: 'My Requests screen',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/search-api.test.js',
      'test/client/search-presentation.test.js',
      'test/client/useGlobalSearch.test.js',
      'test/client/useSearchMusicWorkflow.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture MusicBrainz and network search mode behavior in browser evidence.',
      'Confirm release request modal opens from search results.',
    ],
    releaseGap: 'Add visual evidence for search result cards across both modes.',
    schemaEvidence: ['No schema change.'],
    step: 7,
    title: 'Search screen',
  },
  {
    browserTests: ['test/browser/library-grid-state.test.js'],
    focusedTests: [
      'test/client/wanted-release-normalization.test.js',
      'test/client/useLibraryWantedReleases.test.js',
      'test/server/library-wanted-release-service.test.js',
      'test/server/library-wanted-release-store.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture Missing/Wanted filter states and request action behavior in browser evidence.',
      'Retain wanted status normalization tests as focused proof.',
    ],
    releaseGap: 'Add visual proof for Needs Attention and wanted release actions.',
    schemaEvidence: ['Wanted release joins are covered by schema snapshot and migration replay gates.'],
    step: 8,
    title: 'Missing and wanted screen',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/media-request-api.test.js',
      'test/client/useRequestUsers.test.js',
      'test/integration/library-media-requests.test.js',
      'test/server/library-media-request-service.test.js',
    ],
    releaseEvidenceTasks: [
      'Keep delegated request journey in packaged-runtime evidence.',
      'Verify requester and operator scoped reads through native integration coverage.',
    ],
    releaseGap: 'Add release-pack evidence that links one delegated request from creation through fulfillment projection.',
    schemaEvidence: ['requested_for_user_id lineage is covered by migration replay and schema snapshot gates.'],
    step: 9,
    title: 'Multi-user awareness pass',
  },
  {
    browserTests: [
      'test/browser/operator-ui-smoke.test.js',
      'test/browser/library-grid-state.test.js',
    ],
    focusedTests: [
      'test/client/app-shell-presentation.test.js',
      'test/client/useTabbarOverflow.test.js',
      'test/client/grid-controls-contract.test.js',
    ],
    releaseEvidenceTasks: [
      'Run browser smoke at desktop and mobile viewport sizes before release sign-off.',
      'Capture responsive navigation and grid behavior in visual evidence.',
    ],
    releaseGap: 'This remains a high-priority visual-evidence gap for mobile navigation and media grids.',
    schemaEvidence: ['No schema change.'],
    step: 10,
    title: 'Responsive and mobile',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/release-radar-normalization.test.js',
      'test/client/useReleaseRadar.test.js',
      'test/server/library-release-radar-service.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture Release Radar strip and full-page states in browser evidence.',
      'Confirm recent/upcoming split with deterministic service tests.',
    ],
    releaseGap: 'Add browser visual proof for Release Radar empty, recent, and upcoming states.',
    schemaEvidence: ['Release radar read model is covered by schema snapshot and migration replay gates.'],
    step: 11,
    title: 'Release Radar',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/activity-event-normalization.test.js',
      'test/client/activity-feed-presentation.test.js',
      'test/client/useActivityFeed.test.js',
      'test/integration/activity-feed-drillthrough.test.js',
      'test/server/activity-event-service.test.js',
      'test/server/activity-routes.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture Activity feed rendering and link drillthrough in browser evidence.',
      'Keep activity event creation and route tests as focused proof.',
    ],
    releaseGap: 'Add packaged browser proof for requester Home recent Activity panel.',
    schemaEvidence: ['activity_events migration is covered by migration replay and schema snapshot gates.'],
    step: 12,
    title: 'Activity feed',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/server/media-request-dedup.test.js',
      'test/server/library-media-request-service.test.js',
      'test/server/library-media-request-fulfillment-service.test.js',
      'test/integration/library-media-requests.test.js',
    ],
    releaseEvidenceTasks: [
      'Retain cross-user duplicate request coverage in native integration tests.',
      'Capture linked request visibility in packaged-runtime evidence.',
    ],
    releaseGap: 'Add release-pack proof that a linked request fulfills from the primary request evidence.',
    schemaEvidence: ['Cross-user dedup migration is covered by migration replay and schema snapshot gates.'],
    step: 13,
    title: 'Cross-user deduplication',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/release-normalization.test.js',
      'test/client/request-status.test.js',
      'test/server/library-media-request-service.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture Coming Soon request pills in My Requests evidence.',
      'Verify future-date request payload handling through server service tests.',
    ],
    releaseGap: 'Add a deterministic browser scenario for an upcoming release card.',
    schemaEvidence: ['expected_release_date migration is covered by migration replay and schema snapshot gates.'],
    step: 14,
    title: 'Coming Soon pre-request date-gating',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/account-preferences-api.test.js',
      'test/client/useAccountPreferences.test.js',
      'test/server/format-preference-scoring.test.js',
      'test/server/app-user-preferences-routes.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture account preference controls in browser evidence.',
      'Confirm format preference scoring remains deterministic.',
    ],
    releaseGap: 'Add packaged-runtime proof that saved preferences influence a queued request search.',
    schemaEvidence: ['user_preferences JSONB persistence is covered by migration and schema gates.'],
    step: 15,
    title: 'Per-user format and quality preferences',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/server/download-result-scoring.test.js',
      'test/server/import-candidate-service.test.js',
      'test/server/import-candidate-repository.test.js',
    ],
    releaseEvidenceTasks: [
      'Keep candidate ordering tests as focused proof for scored results.',
      'Capture import review best-candidate ordering in operator browser evidence.',
    ],
    releaseGap: 'Add release evidence that records scored import candidates from a packaged runtime smoke.',
    schemaEvidence: ['Candidate normalized payload ordering is covered by schema snapshot and migration gates.'],
    step: 16,
    title: 'Download result scoring',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/scripts/pwa-manifest.test.js',
      'test/client/pwa-cache-policy.test.js',
      'test/client/pwa-registration.test.js',
      'test/client/usePushNotifications.test.js',
      'test/server/push-notification-service.test.js',
      'test/server/push-routes.test.js',
    ],
    releaseEvidenceTasks: [
      'Verify manifest and service worker assets are present in built client output.',
      'Capture push subscription route behavior through focused route tests.',
    ],
    releaseGap: 'Add manual release note evidence for mobile install and notification permission flow.',
    schemaEvidence: ['push_subscriptions migration is covered by migration replay and schema snapshot gates.'],
    step: 17,
    title: 'PWA and push notifications',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/artist-detail-route.test.js',
      'test/client/artist-detail-presentation.test.js',
      'test/client/useArtistDetail.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture artist detail navigation from Home, Discover, and Search in browser evidence.',
      'Verify discography grouping and related artist behavior with focused client tests.',
    ],
    releaseGap: 'Add visual evidence for artist detail header, discography, and related artists strip.',
    schemaEvidence: ['No new schema beyond monitored metadata tables already covered by schema gates.'],
    step: 18,
    title: 'Artist detail page',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/useActiveUsers.test.js',
      'test/client/useReleaseDetail.test.js',
      'test/server/metadata/canonical-release-service.test.js',
      'test/server/metadata/release-group-tracklist-service.test.js',
      'test/server/metadata-routes.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture release detail modal open, edition switching, and request action flow.',
      'Retain canonical edition route coverage as focused proof.',
    ],
    releaseGap: 'Add visual evidence for release detail modal on mobile and desktop.',
    schemaEvidence: ['is_canonical migration and unique index are covered by schema snapshot gates.'],
    step: 19,
    title: 'Rich release detail modal',
  },
  {
    browserTests: ['test/browser/library-grid-state.test.js'],
    focusedTests: [
      'test/client/library-api.test.js',
      'test/client/library-display-preference.test.js',
      'test/client/library-release-normalization.test.js',
      'test/client/useLibraryReleases.test.js',
      'test/server/library-releases-service.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture Library grid/list mode, dynamic filters, and clear-all behavior in browser evidence.',
      'Archive Library display-mode proof in packaged-runtime visual evidence.',
    ],
    releaseGap: 'This remains a high-priority visual-evidence gap for grid/list media surfaces.',
    schemaEvidence: ['Library reconciliation schema is covered by schema snapshot and migration replay gates.'],
    step: 20,
    title: 'Library view',
  },
  {
    browserTests: ['test/browser/library-grid-state.test.js'],
    focusedTests: [
      'test/client/artwork-color-worker-client.test.js',
      'test/client/useArtworkColor.test.js',
      'test/server/artwork-dominant-color-service.test.js',
      'test/server/artwork-ingestion-service.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture card accent behavior in visual evidence where artwork is present.',
      'Verify dominant-color writeback route remains CSRF-protected.',
    ],
    releaseGap: 'Add visual evidence that accent color remains subtle in both themes.',
    schemaEvidence: ['Artwork dominant color storage is covered by schema snapshot gates.'],
    step: 21,
    title: 'Album art color extraction',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/discover-presentation.test.js',
      'test/client/my-requests-presentation.test.js',
      'test/client/search-presentation.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture empty states for Discover, Search, Home, and My Requests.',
      'Confirm CTAs route to the intended requester surfaces.',
    ],
    releaseGap: 'Add visual screenshot proof for cold-start requester flows.',
    schemaEvidence: ['No schema change.'],
    step: 22,
    title: 'Rich empty states',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/useArtistMonitoring.test.js',
      'test/client/useReleaseRequest.test.js',
      'test/client/app-shell-presentation.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture success, info, and error toast placement in browser evidence.',
      'Verify action composables still emit toasts without promising acquisition.',
    ],
    releaseGap: 'Add explicit browser proof for toast stacking near mobile bottom navigation.',
    schemaEvidence: ['No schema change.'],
    step: 23,
    title: 'Global toast system',
  },
  {
    browserTests: ['test/browser/library-grid-state.test.js'],
    focusedTests: [
      'test/client/grid-controls-contract.test.js',
      'test/client/useGridState.test.js',
      'test/client/useLibraryFilterOptions.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture deep-link filter and sort persistence in browser evidence.',
      'Verify clear-all preserves unrelated query params.',
    ],
    releaseGap: 'Add visual proof for filter panel overflow and touch behavior.',
    schemaEvidence: ['No schema change.'],
    step: 24,
    title: 'Filter and sort controls on card grids',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/theme-preference.test.js',
      'test/client/useTheme.test.js',
      'test/server/app-user-preferences-routes.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture dark, light, and system theme behavior in browser evidence.',
      'Verify persisted preference contract through user preferences routes.',
    ],
    releaseGap: 'Add visual evidence for theme contrast on artwork-heavy views.',
    schemaEvidence: ['Theme preference storage uses user_preferences covered by schema gates.'],
    step: 25,
    title: 'System-aware dark and light theme',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/operator-notifications-presentation.test.js',
      'test/client/useOperatorDashboard-swr.test.js',
      'test/server/operator-notification-service.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture operator dashboard request queue and notification strip in browser evidence.',
      'Verify requester/operator dashboard split remains role-scoped.',
    ],
    releaseGap: 'Add packaged-runtime proof for operator dashboard after delegated request creation.',
    schemaEvidence: ['Operator projection and notification schema is covered by migration and schema gates.'],
    step: 26,
    title: 'Operator dashboard',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/media-request-api.test.js',
      'test/client/useMyRequestNotifications.test.js',
      'test/integration/library-media-requests.test.js',
      'test/server/library-media-request-notification-service.test.js',
    ],
    releaseEvidenceTasks: [
      'Keep target-user inbox summary covered in native integration tests.',
      'Capture My Requests nav badge and notification panel in browser evidence.',
    ],
    releaseGap: 'Add packaged-runtime browser proof for requester notification badge behavior.',
    schemaEvidence: ['Uses existing media request and notification state covered by schema gates.'],
    step: 27,
    title: 'Target-user inbox and notification visibility',
  },
  {
    browserTests: ['test/browser/operator-ui-smoke.test.js'],
    focusedTests: [
      'test/client/release-radar-normalization.test.js',
      'test/client/useReleaseRadar.test.js',
      'test/server/library-release-radar-service.test.js',
      'test/server/library-routes.test.js',
    ],
    releaseEvidenceTasks: [
      'Capture full Release Radar page recent and upcoming sections in browser evidence.',
      'Retain route tests for recent/upcoming payload shape.',
    ],
    releaseGap: 'Add visual evidence for the full-page Release Radar and Coming Soon state.',
    schemaEvidence: ['No new schema beyond existing metadata release groups and monitoring tables.'],
    step: 28,
    title: 'Release Radar and Coming Soon full page',
  },
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmptyStringArray(value, label, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label} must be a non-empty array`);
    return;
  }

  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) {
      errors.push(`${label}[${index}] must be a non-empty string`);
    }
  });
}

function renderBulletList(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function renderCommandTable(commands) {
  const lines = [
    '| Command | Purpose |',
    '| --- | --- |',
  ];

  for (const gate of commands) {
    lines.push(`| \`${gate.command}\` | ${gate.purpose} |`);
  }

  return lines.join('\n');
}

function renderSourceList(sources) {
  return sources
    .map((source) => `- [${source.label}](${source.url}) - ${source.notes}`)
    .join('\n');
}

function renderStepSection(step) {
  return [
    `## Step ${step.step} - ${step.title}`,
    '',
    'Focused tests:',
    renderBulletList(step.focusedTests.map((testPath) => `\`${testPath}\``)),
    '',
    'Browser scenarios:',
    renderBulletList(step.browserTests.map((testPath) => `\`${testPath}\``)),
    '',
    'Schema evidence:',
    renderBulletList(step.schemaEvidence),
    '',
    'Release evidence tasks:',
    renderBulletList(step.releaseEvidenceTasks),
    '',
    `Remaining release gap: ${step.releaseGap}`,
    '',
  ].join('\n');
}

export function validateIssue4ReleaseEvidenceMap(steps = issue4ReleaseEvidenceSteps) {
  const errors = [];

  if (!Array.isArray(steps)) {
    throw new Error('Issue #4 release evidence steps must be an array');
  }

  const seenSteps = new Set();
  for (const step of steps) {
    if (!Number.isInteger(step?.step)) {
      errors.push('Each evidence row must include an integer step number');
      continue;
    }

    if (seenSteps.has(step.step)) {
      errors.push(`Step ${step.step} appears more than once`);
    }
    seenSteps.add(step.step);

    if (!isNonEmptyString(step.title)) {
      errors.push(`Step ${step.step} title must be a non-empty string`);
    }

    assertNonEmptyStringArray(step.focusedTests, `Step ${step.step} focusedTests`, errors);
    assertNonEmptyStringArray(step.browserTests, `Step ${step.step} browserTests`, errors);
    assertNonEmptyStringArray(step.schemaEvidence, `Step ${step.step} schemaEvidence`, errors);
    assertNonEmptyStringArray(step.releaseEvidenceTasks, `Step ${step.step} releaseEvidenceTasks`, errors);

    if (!isNonEmptyString(step.releaseGap)) {
      errors.push(`Step ${step.step} releaseGap must be a non-empty string`);
    }
  }

  for (let stepNumber = 1; stepNumber <= 28; stepNumber += 1) {
    if (!seenSteps.has(stepNumber)) {
      errors.push(`Step ${stepNumber} is missing from the release evidence map`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  return {
    stepCount: steps.length,
  };
}

export function collectIssue4EvidenceTestPaths(steps = issue4ReleaseEvidenceSteps) {
  validateIssue4ReleaseEvidenceMap(steps);

  return [...new Set(steps.flatMap((step) => [
    ...step.focusedTests,
    ...step.browserTests,
  ]))].sort();
}

export async function assertIssue4EvidenceFileReferences({
  rootDir = process.cwd(),
  steps = issue4ReleaseEvidenceSteps,
} = {}) {
  const testPaths = collectIssue4EvidenceTestPaths(steps);
  const missingPaths = [];

  for (const testPath of testPaths) {
    try {
      await access(resolve(rootDir, testPath));
    } catch (_error) {
      missingPaths.push(testPath);
    }
  }

  if (missingPaths.length > 0) {
    throw new Error(`Issue #4 release evidence references missing test files:\n${missingPaths.join('\n')}`);
  }

  return {
    checkedFiles: testPaths.length,
  };
}

export function renderIssue4ReleaseEvidenceMap({
  gates = issue4ReleaseEvidenceGates,
  sources = issue4OfficialEvidenceSources,
  steps = issue4ReleaseEvidenceSteps,
} = {}) {
  validateIssue4ReleaseEvidenceMap(steps);

  const lines = [
    '# Issue #4 Release Validation Evidence Map',
    '',
    `Source plan: [${issue4ImplementationPlanPath}](issue-4-implementation-plan.md)`,
    '',
    'This generated map links every shipped Issue #4 platform step to focused automated tests, browser scenarios, schema evidence, and remaining release evidence work. It is intentionally release-facing: use it to decide what proof must be archived before Issue #4 is closed for a packaged runtime.',
    '',
    '## Validation Gates',
    '',
    renderCommandTable(gates),
    '',
    '## Official Sources Used',
    '',
    renderSourceList(sources),
    '',
    '## Evidence By Step',
    '',
    ...[...steps].sort((left, right) => left.step - right.step).map(renderStepSection),
    '',
  ];

  return `${lines.join('\n').trimEnd()}\n`;
}

export async function writeIssue4ReleaseEvidenceMap({
  outputPath = issue4ReleaseEvidenceMapOutputPath,
  rootDir = process.cwd(),
} = {}) {
  await assertIssue4EvidenceFileReferences({ rootDir });

  const resolvedOutputPath = resolve(rootDir, outputPath);
  const markdown = renderIssue4ReleaseEvidenceMap();
  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, markdown, 'utf8');

  return {
    checkedFiles: collectIssue4EvidenceTestPaths().length,
    outputPath: resolvedOutputPath,
    stepCount: issue4ReleaseEvidenceSteps.length,
  };
}
