<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

<script setup>
import { RouterLink } from 'vue-router';
</script>

<template>
  <section class="hx-empty" aria-labelledby="music-queue-release-unavailable-title">
    <h2 id="music-queue-release-unavailable-title" class="hx-empty-title">Release not available</h2>
    <p class="hx-empty-copy">This Music Queue release is unavailable. Open your queue to continue.</p>
    <RouterLink class="hx-btn" data-variant="primary" :to="{ name: 'music-queue' }">
      Open Music Queue
    </RouterLink>
  </section>
</template>
