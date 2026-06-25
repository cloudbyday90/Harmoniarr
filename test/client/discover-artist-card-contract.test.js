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

const COMPONENT_PATH = new URL('../../src/client/components/media/DiscoverArtistCard.vue', import.meta.url);

test('DiscoverArtistCard resolves add-action state through the presentation helper', async () => {
  const source = await readFile(COMPONENT_PATH, 'utf8');

  assert.match(source, /import \{ computed, ref, watch \} from 'vue'/);
  assert.match(
    source,
    /import \{ resolveDiscoverArtistCardActionState \} from '\.\.\/\.\.\/lib\/discover-artist-card-presentation\.js'/,
  );
  assert.match(source, /const actionState = computed\(\(\) =>/);
  assert.match(source, /resolveDiscoverArtistCardActionState\(\{/);
  assert.match(source, /artistName: props\.artist\?\.name/);
  assert.match(source, /monitored: props\.monitored/);
  assert.match(source, /monitoring: props\.monitoring/);
  assert.match(source, /disabled: props\.disabled/);
});

test('DiscoverArtistCard binds button rendering to resolved action state', async () => {
  const source = await readFile(COMPONENT_PATH, 'utf8');

  assert.match(source, /:data-state="actionState\.state"/);
  assert.match(source, /:data-variant="actionState\.buttonVariant"/);
  assert.match(source, /:disabled="actionState\.buttonDisabled"/);
  assert.match(source, /:aria-busy="actionState\.ariaBusy"/);
  assert.match(source, /:aria-label="actionState\.ariaLabel"/);
  assert.match(source, /v-if="actionState\.iconOnly"/);
  assert.match(source, /\{\{ actionState\.visibleLabel \}\}/);
});
