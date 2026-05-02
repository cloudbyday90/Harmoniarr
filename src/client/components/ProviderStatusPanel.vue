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
const props = defineProps({
  providerStatus: {
    type: Object,
    default: null,
  },
});

defineEmits(['refresh']);

function providerLabel(provider) {
  switch (provider) {
    case 'apple_music':
      return 'Apple Music';
    case 'spotify':
      return 'Spotify';
    case 'youtube':
      return 'YouTube';
    default:
      return provider;
  }
}

function oAuthProviderStatus(provider) {
  if (!provider) {
    return 'Unavailable';
  }

  return provider.linked ? 'Linked' : 'Not linked';
}

function oAuthProviderStatusClass(provider) {
  if (!provider) {
    return 'review-status-failed';
  }

  return provider.linked ? 'review-status-selected' : 'review-status-held';
}

function appleMusicStatusClass(provider) {
  if (!provider) {
    return 'review-status-failed';
  }

  return provider.configured ? 'review-status-selected' : 'review-status-held';
}

function appleMusicStatusLabel(provider) {
  if (!provider) {
    return 'Unavailable';
  }

  return provider.configured ? 'Configured' : 'Not configured';
}

function formatTokenExpiry(provider) {
  if (!provider?.linked || !provider.tokenExpiresAt) {
    return null;
  }

  return new Date(provider.tokenExpiresAt).toLocaleString();
}

const providers = (() => {
  const { providerStatus: ps } = props;
  if (!ps) {
    return [];
  }

  const result = [];

  if (ps.spotify) {
    result.push({ key: 'spotify', label: providerLabel('spotify'), ...ps.spotify, type: 'oauth' });
  }

  if (ps.youtube) {
    result.push({ key: 'youtube', label: providerLabel('youtube'), ...ps.youtube, type: 'oauth' });
  }

  if (ps.appleMusic) {
    result.push({ key: 'apple_music', label: providerLabel('apple_music'), ...ps.appleMusic, type: 'credentials' });
  }

  return result;
})();
</script>

<template>
  <article class="panel-light dependency-panel">
    <div class="section-header">
      <div>
        <p class="eyebrow">Providers</p>
        <h3>Provider authorization</h3>
      </div>
      <button type="button" @click="$emit('refresh')">Refresh</button>
    </div>

    <div class="dependency-grid" v-if="providers.length" role="status" aria-live="polite">
      <article
        class="dependency-card"
        v-for="provider in providers"
        :key="provider.key"
        :class="provider.type === 'oauth'
          ? oAuthProviderStatusClass(provider)
          : appleMusicStatusClass(provider)"
      >
        <div class="dependency-card-header">
          <div>
            <p>{{ provider.label }}</p>
            <strong>{{ provider.type === 'oauth' ? oAuthProviderStatus(provider) : appleMusicStatusLabel(provider) }}</strong>
          </div>
          <span class="dependency-status-dot" aria-hidden="true"></span>
        </div>

        <dl v-if="provider.type === 'oauth' && provider.linked">
          <div v-if="provider.scope">
            <dt>Scope</dt>
            <dd>{{ provider.scope }}</dd>
          </div>
          <div v-if="formatTokenExpiry(provider)">
            <dt>Token expires</dt>
            <dd>{{ formatTokenExpiry(provider) }}</dd>
          </div>
          <div v-if="provider.updatedAt">
            <dt>Last updated</dt>
            <dd>{{ new Date(provider.updatedAt).toLocaleString() }}</dd>
          </div>
        </dl>

        <dl v-if="provider.type === 'credentials'">
          <div>
            <dt>Team ID</dt>
            <dd>{{ provider.teamIdConfigured ? 'Configured' : 'Missing' }}</dd>
          </div>
          <div>
            <dt>Key ID</dt>
            <dd>{{ provider.keyIdConfigured ? 'Configured' : 'Missing' }}</dd>
          </div>
          <div>
            <dt>Private key</dt>
            <dd>{{ provider.privateKeyConfigured ? 'Configured' : 'Missing' }}</dd>
          </div>
          <div v-if="provider.storefront">
            <dt>Storefront</dt>
            <dd>{{ provider.storefront }}</dd>
          </div>
        </dl>
      </article>
    </div>

    <p class="dependency-empty" v-else>No provider status available.</p>
  </article>
</template>
