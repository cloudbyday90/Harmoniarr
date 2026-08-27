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
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const COMPONENT_PATH = new URL('../../src/client/components/missing-music/MissingMusicDecisionWorklist.vue', import.meta.url);
const INSPECTOR_PATH = new URL('../../src/client/components/missing-music/MissingMusicDecisionInspector.vue', import.meta.url);
const MISSING_VIEW_PATH = new URL('../../src/client/views/MissingView.vue', import.meta.url);
const ROUTER_PATH = new URL('../../src/client/router.js', import.meta.url);

test('Missing Music worklist groups filters and gives every control a visible label', async () => {
  const source = await readFile(COMPONENT_PATH, 'utf8');

  assert.match(source, /<fieldset class="missing-music-worklist__filters">/);
  assert.match(source, /<legend>Filter releases<\/legend>/);
  assert.match(source, /for="missing-music-user">User<\/label>/);
  assert.match(source, /for="missing-music-account-status">Account status<\/label>/);
  assert.match(source, /for="missing-music-work-state">Work state<\/label>/);
  assert.match(source, /for="missing-music-search">Search releases<\/label>/);
});

test('Missing Music worklist reports result changes and states the next step in every row', async () => {
  const source = await readFile(COMPONENT_PATH, 'utf8');

  assert.match(source, /role="status" aria-atomic="true"/);
  assert.match(source, /<strong>Next step:<\/strong>/);
  assert.match(source, /Disabled — history only/);
});

test('MissingView uses the authorized worklist instead of a parallel client-side decision grid', async () => {
  const source = await readFile(MISSING_VIEW_PATH, 'utf8');

  assert.match(source, /import MissingMusicDecisionWorklist/);
  assert.match(source, /<MissingMusicDecisionWorklist \/>/);
  assert.doesNotMatch(source, /MissingReleaseDecisionActions/);
  assert.doesNotMatch(source, /useLibraryWantedReleases/);
});

test('Missing Music links to a routable detail inspector with a labelled current status', async () => {
  const [worklistSource, inspectorSource, missingViewSource, routerSource] = await Promise.all([
    readFile(COMPONENT_PATH, 'utf8'),
    readFile(INSPECTOR_PATH, 'utf8'),
    readFile(MISSING_VIEW_PATH, 'utf8'),
    readFile(ROUTER_PATH, 'utf8'),
  ]);

  assert.match(worklistSource, /Open status details for/);
  assert.match(worklistSource, /name: 'missing-decision'/);
  assert.match(inspectorSource, /<p class="hx-eyebrow">Release status<\/p>/);
  assert.match(inspectorSource, /<h2 ref="headingElement" class="hx-card-title missing-music-inspector__heading" tabindex="-1">/);
  assert.match(inspectorSource, /\.missing-music-inspector__heading:focus/);
  assert.match(inspectorSource, /<h3 id="missing-music-inspector-current-status" ref="statusHeadingElement" tabindex="-1">Current status<\/h3>/);
  assert.match(inspectorSource, /aria-labelledby="missing-music-inspector-match-choices"/);
  assert.match(inspectorSource, /Use this match/);
  assert.match(inspectorSource, /Selecting a match does not start a download/);
  assert.match(inspectorSource, /Back to release decisions/);
  assert.match(missingViewSource, /<MissingMusicDecisionInspector v-if="selectedDecisionId"/);
  assert.match(missingViewSource, /ref="pageHeadingElement" class="hx-page-title missing-music-page-title" tabindex="-1"/);
  assert.match(missingViewSource, /\.missing-music-page-title:focus/);
  assert.match(routerSource, /path: 'missing\/:decisionId', name: 'missing-decision'/);
});
