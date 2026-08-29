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
defineProps({
  artistName: {
    type: String,
    required: true,
  },
});
</script>

<template>
  <div class="artist-detail-discography-loading" role="status" aria-atomic="true">
    <p class="artist-detail-discography-loading__title">
      Loading releases for {{ artistName }}…
    </p>
    <p class="artist-detail-discography-loading__body">
      The artist profile is available while the release catalog loads.
    </p>
    <div class="artist-detail-discography-loading__skeletons" aria-hidden="true">
      <span class="hx-skeleton" data-size="lg" />
      <span class="hx-skeleton" />
      <span class="hx-skeleton" />
    </div>
  </div>
</template>

<style scoped>
.artist-detail-discography-loading {
  display: grid;
  gap: var(--hx-space-2);
}

.artist-detail-discography-loading__title,
.artist-detail-discography-loading__body {
  margin: 0;
}

.artist-detail-discography-loading__title {
  color: var(--hx-text-strong);
  font-weight: 700;
}

.artist-detail-discography-loading__body {
  color: var(--hx-text-muted);
}

.artist-detail-discography-loading__skeletons {
  display: grid;
  gap: var(--hx-space-2);
  margin-top: var(--hx-space-2);
  max-width: 36rem;
}

.artist-detail-discography-loading__skeletons > :nth-child(2) {
  inline-size: 82%;
}

.artist-detail-discography-loading__skeletons > :nth-child(3) {
  inline-size: 64%;
}
</style>
