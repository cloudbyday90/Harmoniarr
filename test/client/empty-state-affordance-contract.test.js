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

const EMPTY_STATE_PATH = new URL('../../src/client/components/EmptyState.vue', import.meta.url);

// Every empty state that wires an action CTA via `@cta-click` must now resolve
// to a real button, because `EmptyState` supports the action affordance.
const ACTION_CTA_SITES = [
  '../../src/client/components/home/OperatorHomePanel.vue',
  '../../src/client/views/LibraryView.vue',
  '../../src/client/views/MyRequestsView.vue',
];

test('EmptyState declares the cta-click action affordance', async () => {
  const source = await readFile(EMPTY_STATE_PATH, 'utf8');
  assert.match(source, /defineEmits\(\['cta-click'\]\)/, 'must declare the cta-click emit');
  assert.match(source, /ctaVariant:\s*\{/, 'must expose a ctaVariant prop for the action button');
});

test('EmptyState renders the action block for ctaTo OR ctaLabel OR slot', async () => {
  const source = await readFile(EMPTY_STATE_PATH, 'utf8');
  assert.match(
    source,
    /v-if="ctaTo \|\| ctaLabel \|\| \$slots\.cta"/,
    'action block should render whenever any CTA affordance is provided',
  );
});

test('EmptyState renders a button that emits cta-click when ctaLabel has no ctaTo', async () => {
  const source = await readFile(EMPTY_STATE_PATH, 'utf8');
  assert.match(source, /v-else-if="ctaLabel"/);
  assert.match(source, /@click="\$emit\('cta-click'\)"/);
  assert.match(source, /:data-variant="ctaVariant"/);
});

test('EmptyState keeps the navigational RouterLink CTA for ctaTo', async () => {
  const source = await readFile(EMPTY_STATE_PATH, 'utf8');
  assert.match(source, /<RouterLink\s+v-if="ctaTo"/);
});

test('all @cta-click empty-state call sites now resolve to a working button', async () => {
  for (const relativePath of ACTION_CTA_SITES) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
    assert.match(source, /@cta-click=/, `${relativePath} should still wire an action handler`);
    assert.match(source, /cta-label=/, `${relativePath} should provide a button label`);
  }
});
