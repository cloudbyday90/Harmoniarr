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

<template>
  <section class="music-queue-empty-state" aria-labelledby="music-queue-empty-heading">
    <div>
      <p class="hx-eyebrow">Queue is clear</p>
      <h2 id="music-queue-empty-heading">Nothing needs your attention</h2>
      <p>
        Harmoniarr has no releases to search for, download, check, or add right now.
        Monitored artists and requested music will appear here automatically.
      </p>
    </div>
    <RouterLink class="hx-btn" data-variant="ghost" :to="{ name: 'discover' }">
      Discover artists
    </RouterLink>
  </section>
</template>

<style scoped>
.music-queue-empty-state {
  display: flex;
  gap: var(--hx-space-4);
  align-items: center;
  justify-content: space-between;
  padding: var(--hx-space-6);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface);
}

.music-queue-empty-state h2,
.music-queue-empty-state p {
  margin: 0;
}

.music-queue-empty-state h2 {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-lg);
}

.music-queue-empty-state p:not(.hx-eyebrow) {
  max-width: 62ch;
  margin-top: var(--hx-space-1);
  color: var(--hx-text-muted);
}

@media (max-width: 640px) {
  .music-queue-empty-state {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
