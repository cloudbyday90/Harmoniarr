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

const NEXT_ACTION_PATH = new URL('../../src/client/components/settings/SettingsSetupNextAction.vue', import.meta.url);
const TASK_LIST_PATH = new URL('../../src/client/components/settings/SettingsSetupTaskList.vue', import.meta.url);
const VIEW_PATH = new URL('../../src/client/views/SettingsSetupView.vue', import.meta.url);

test('Settings setup task list gives each task one semantic whole-row destination', async () => {
  const source = await readFile(TASK_LIST_PATH, 'utf8');

  assert.match(source, /<ol class="settings-setup-task-list" :aria-label="label">/);
  assert.match(source, /<RouterLink/);
  assert.match(source, /:aria-describedby=/);
  assert.match(source, /<span :id="buildStepId\(step, 'status'\)" class="hx-pill"/);
  assert.match(source, /aria-hidden="true">\{\{ step\.label \}\}/);
  assert.doesNotMatch(source, /<button/);
});

test('Settings setup uses one elevated next action only when a required task remains', async () => {
  const [nextAction, view] = await Promise.all([
    readFile(NEXT_ACTION_PATH, 'utf8'),
    readFile(VIEW_PATH, 'utf8'),
  ]);

  assert.match(nextAction, />Your next step</);
  assert.match(nextAction, /data-variant="primary"/);
  assert.match(nextAction, /:to="\{ name: step\.routeName \}"/);
  assert.match(view, /<SettingsSetupNextAction v-if="setupOverview\.nextStep" :step="setupOverview\.nextStep" \/>/);
  assert.match(view, /v-else class="settings-setup__complete"/);
  assert.match(view, /class="settings-setup__status" role="status"/);
  assert.doesNotMatch(view, /settings-setup__readiness/);
  assert.match(view, /@click="refreshSetup"/);
});
