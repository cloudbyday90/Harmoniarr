import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTick, reactive, ref, watch } from 'vue';
import { useConnections as createConnections } from '../../src/client/composables/useConnections.js';

function useConnections(options) {
  const session = { authenticated: true, user: { id: 'admin', role: 'admin', mustChangePassword: false }, csrfToken: 'fixture' };
  return createConnections({ getSession: () => session, fetchSessionFn: async () => session,
    fetchStatusFn: async () => ({ spotify: { linked: true }, youtube: { linked: true }, statusSummary: { state: 'complete', unavailableProviders: [] } }), ...options });
}

function createSettingsFormStub() {
  return ({ extraApply } = {}) => ({
    errorMessage: ref(''),
    form: { providers: {}, slskd: {} },
    isLoading: ref(false),
    isSaving: ref(false),
    loadSettings: async () => {
      extraApply?.({
        secretStatus: {
          providers: {
            spotifyOAuth: { linked: true },
            youtubeOAuth: { linked: true },
          },
        },
      });
    },
    saveSettings: async () => {},
    successMessage: ref(''),
  });
}

test('useConnections loads secretStatus through useSettingsForm extraApply', async () => {
  const connections = useConnections({
    useSettingsFormFn: createSettingsFormStub(),
  });

  assert.equal(connections.secretStatus.value, null);

  await connections.loadSettings();

  assert.equal(connections.secretStatus.value.providers.spotifyOAuth.linked, true);
  assert.equal(connections.secretStatus.value.providers.youtubeOAuth.linked, true);
});

test('useConnections connectSpotifyOAuth redirects to authorization url', async () => {
  let redirectedTo = null;
  const connections = useConnections({
    redirectToUrl: (url) => { redirectedTo = url; },
    startSpotifyOAuthFn: async () => ({ authorizationUrl: 'https://spotify.example/auth' }),
    useSettingsFormFn: createSettingsFormStub(),
  });

  await connections.connectSpotifyOAuth();

  assert.equal(redirectedTo, 'https://spotify.example/auth');
  assert.equal(connections.errorMessage.value, '');
  assert.equal(connections.isStartingSpotifyOAuth.value, true);
});

test('useConnections connectSpotifyOAuth resets state and surfaces error on failure', async () => {
  const connections = useConnections({
    startSpotifyOAuthFn: async () => { throw new Error('spotify start failed'); },
    useSettingsFormFn: createSettingsFormStub(),
  });

  await connections.connectSpotifyOAuth();

  assert.equal(connections.errorMessage.value, 'Spotify authorization start could not be confirmed. Review Connections before trying again.');
  assert.deepEqual(connections.connectionActionFeedback.value, {
    message: 'Spotify authorization start could not be confirmed. Review Connections before trying again.',
    tone: 'danger',
  });
  assert.equal(connections.isStartingSpotifyOAuth.value, false);
});

test('useConnections disconnectSpotifyOAuth updates secretStatus and success message', async () => {
  const connections = useConnections({
    clearSpotifyOAuthFn: async () => ({ status: { linked: false } }),
    useSettingsFormFn: createSettingsFormStub(),
  });

  await connections.loadSettings();
  await connections.disconnectSpotifyOAuth();

  assert.equal(connections.secretStatus.value.providers.spotifyOAuth.linked, false);
  assert.equal(connections.successMessage.value, 'Spotify authorization cleared.');
  assert.deepEqual(connections.connectionActionFeedback.value, {
    message: 'Spotify authorization cleared.',
    tone: 'success',
  });
  assert.equal(connections.isClearingSpotifyOAuth.value, false);
});

test('useConnections connectYouTubeOAuth redirects to authorization url', async () => {
  let redirectedTo = null;
  const connections = useConnections({
    redirectToUrl: (url) => { redirectedTo = url; },
    startYouTubeOAuthFn: async () => ({ authorizationUrl: 'https://youtube.example/auth' }),
    useSettingsFormFn: createSettingsFormStub(),
  });

  await connections.connectYouTubeOAuth();

  assert.equal(redirectedTo, 'https://youtube.example/auth');
  assert.equal(connections.isStartingYouTubeOAuth.value, true);
});

test('useConnections disconnectYouTubeOAuth updates secretStatus and surfaces clear failure', async () => {
  const connections = useConnections({
    clearYouTubeOAuthFn: async () => { throw new Error('youtube clear failed'); },
    useSettingsFormFn: createSettingsFormStub(),
  });

  await connections.loadSettings();
  await connections.disconnectYouTubeOAuth();

  assert.equal(connections.secretStatus.value.providers.youtubeOAuth.linked, true);
  assert.equal(connections.errorMessage.value, 'YouTube authorization clear could not be confirmed. Review Connections before trying again.');
  assert.deepEqual(connections.connectionActionFeedback.value, {
    message: 'YouTube authorization clear could not be confirmed. Review Connections before trying again.',
    tone: 'danger',
  });
  assert.equal(connections.isClearingYouTubeOAuth.value, false);
});

test('useConnections clears stale connection action feedback before another settings action', async () => {
  const connections = useConnections({
    startSpotifyOAuthFn: async () => { throw new Error('not rendered'); },
    useSettingsFormFn: createSettingsFormStub(),
  });

  await connections.connectSpotifyOAuth();
  assert.notEqual(connections.connectionActionFeedback.value, null);
  connections.clearConnectionActionFeedback();

  assert.equal(connections.connectionActionFeedback.value, null);
});

test('useConnections coordinates settings and authorization admission and requires saved clear eligibility', async () => {
  let starts = 0, clears = 0, loads = 0, saves = 0;
  const held = Promise.withResolvers();
  const connections = useConnections({
    startSpotifyOAuthFn: () => { starts++; return held.promise; },
    clearSpotifyOAuthFn: async () => { clears++; return { status: { linked: false } }; },
    useSettingsFormFn: options => {
      const form = createSettingsFormStub()(options);
      const load = form.loadSettings;
      return { ...form, loadSettings: async () => { loads++; await load(); }, saveSettings: async () => { saves++; return { ok: true }; } };
    },
  });
  await connections.disconnectSpotifyOAuth(); assert.equal(clears, 0);
  connections.isLoading.value = true; await connections.connectSpotifyOAuth(); assert.equal(starts, 0);
  connections.isLoading.value = false; connections.isSaving.value = true;
  await connections.connectSpotifyOAuth(); assert.equal(starts, 0); connections.isSaving.value = false;
  await connections.loadSettings(); assert.equal(loads, 1);
  const work = connections.connectSpotifyOAuth();
  await connections.loadSettings(); assert.deepEqual(await connections.saveSettings(), { ok: false });
  const feedback = connections.connectionActionFeedback.value; connections.clearConnectionActionFeedback(); assert.deepEqual(connections.connectionActionFeedback.value, feedback);
  assert.equal(loads, 1); assert.equal(saves, 0);
  held.reject(new Error('PRIVATE')); await work; assert.equal(starts, 1); assert.equal(connections.isProviderAuthorizationPending.value, false);
  await connections.disconnectSpotifyOAuth(); assert.equal(clears, 1); assert.equal(connections.secretStatus.value.providers.spotifyOAuth.linked, false);
  await connections.disconnectSpotifyOAuth(); assert.equal(clears, 1); assert.deepEqual(await connections.saveSettings(), { ok: true }); assert.equal(saves, 1);
});

test('uncertain commands reconcile only the saved link without loading or saving drafts', { timeout: 1_000 }, async t => {
  const held = Promise.withResolvers(); let reads = 0;
  const connections = useConnections({ startSpotifyOAuthFn: async () => { throw new Error('PRIVATE'); },
    fetchStatusFn: async () => { reads++; return held.promise; }, useSettingsFormFn: createSettingsFormStub() });
  await connections.loadSettings(); connections.form.providers.spotifyClientId = 'unsaved';
  await connections.connectSpotifyOAuth(); await nextTick();
  assert.equal(reads, 1); assert.equal(connections.isCheckingProviderAuthorization.value, true);
  const observed = Promise.withResolvers();
  t.after(watch(() => connections.secretStatus.value.providers.spotifyOAuth.linked, observed.resolve, { flush: 'sync', once: true }));
  held.resolve({ spotify: { linked: false, token: 'PRIVATE' }, statusSummary: { state: 'complete', unavailableProviders: [] } }); await observed.promise; await nextTick();
  assert.deepEqual(connections.secretStatus.value.providers.spotifyOAuth, { linked: false });
  assert.equal(connections.form.providers.spotifyClientId, 'unsaved'); assert.match(connections.connectionActionFeedback.value.message, /could not be confirmed/u);
  assert.match(connections.providerAuthorizationStatusFeedback.value.message, /no saved Spotify/u);
});

test('settings save and newer command invalidate older saved-status reads', async () => {
  const pending = [], session = reactive({ authenticated: true, user: { id: 'admin', role: 'admin', mustChangePassword: false }, csrfToken: 'fixture' });
  let clears = 0;
  const connections = useConnections({ getSession: () => session, fetchSessionFn: async () => session,
    startSpotifyOAuthFn: async () => { throw new Error('PRIVATE'); },
    clearYouTubeOAuthFn: async () => { clears++; return { status: { linked: false } }; },
    fetchStatusFn: ({ signal }) => { const held = Promise.withResolvers(); pending.push({ ...held, signal }); return held.promise; },
    useSettingsFormFn: createSettingsFormStub() });
  await connections.loadSettings(); await connections.connectSpotifyOAuth(); await nextTick();
  await connections.saveSettings(); assert.equal(pending[0].signal.aborted, true);
  pending[0].resolve({ spotify: { linked: false }, statusSummary: { state: 'complete', unavailableProviders: [] } }); await nextTick(); await nextTick();
  assert.equal(connections.secretStatus.value.providers.spotifyOAuth.linked, true);
  await connections.connectSpotifyOAuth(); await nextTick(); await connections.disconnectYouTubeOAuth(); assert.equal(pending[1].signal.aborted, true);
  pending[1].resolve({ spotify: { linked: false }, statusSummary: { state: 'complete', unavailableProviders: [] } }); await nextTick(); await nextTick();
  assert.equal(clears, 1); assert.equal(connections.secretStatus.value.providers.spotifyOAuth.linked, true);
  assert.equal(connections.secretStatus.value.providers.youtubeOAuth.linked, false);
});

test('unconfirmed session blocks commands until explicit saved-status recovery', async () => {
  let valid = false, starts = 0;
  const session = { authenticated: true, user: { id: 'admin', role: 'admin', mustChangePassword: false }, csrfToken: 'fixture' };
  const connections = useConnections({ getSession: () => session, fetchSessionFn: async () => valid ? session : { user: null },
    startSpotifyOAuthFn: async () => { starts++; throw new Error('PRIVATE'); }, useSettingsFormFn: createSettingsFormStub() });
  await connections.connectSpotifyOAuth(); await nextTick(); assert.equal(connections.isProviderAuthorizationSessionBlocked.value, true);
  await connections.connectSpotifyOAuth(); assert.equal(starts, 1);
  valid = true; await connections.checkProviderAuthorizationStatus(); assert.equal(connections.isProviderAuthorizationSessionBlocked.value, false);
  assert.match(connections.providerAuthorizationStatusFeedback.value.message, /saved Spotify link/u);
});

test('only a persisted acknowledged handoff requests saved-status reconciliation', { timeout: 1_000 }, async t => {
  const page = new EventTarget(); let reads = 0;
  const connections = useConnections({ pageTarget: page, redirectToUrl: () => {},
    startSpotifyOAuthFn: async () => ({ authorizationUrl: 'https://provider.example' }),
    fetchStatusFn: async () => { reads++; return { spotify: { linked: false }, statusSummary: { state: 'complete', unavailableProviders: [] } }; },
    useSettingsFormFn: createSettingsFormStub() });
  await connections.loadSettings(); connections.form.providers.spotifyClientId = 'unsaved';
  await connections.connectSpotifyOAuth(); assert.equal(reads, 0); assert.equal(connections.isProviderAuthorizationPending.value, true);
  page.dispatchEvent(new Event('pageshow')); assert.equal(reads, 0); assert.equal(connections.isProviderAuthorizationPending.value, true);
  const completed = Promise.withResolvers();
  t.after(watch(connections.providerAuthorizationStatusFeedback, feedback => { if (feedback?.message.startsWith('Last check')) completed.resolve(); }, { flush: 'sync' }));
  const restored = new Event('pageshow'); Object.defineProperty(restored, 'persisted', { value: true }); page.dispatchEvent(restored);
  await completed.promise; assert.equal(reads, 1); assert.equal(connections.isProviderAuthorizationPending.value, false);
  assert.equal(connections.form.providers.spotifyClientId, 'unsaved'); page.dispatchEvent(restored); assert.equal(reads, 1);
});
