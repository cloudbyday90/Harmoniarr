/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const browserRuntimeDiagnosticEnabledEnvVar = 'HARMONIARR_BROWSER_RUNTIME_DIAGNOSTIC';
export const browserRuntimeDiagnosticMarker = '[harmoniarr-browser-runtime-diagnostic]';

const maxDiagnosticDurationMs = 3_600_000;
const diagnosticScenarioCategories = [
  'acquisition',
  'artist_detail',
  'discover',
  'home',
  'import_review',
  'metadata',
  'missing_music',
  'onboarding',
  'operator',
  'other',
  'request_detail',
  'settings',
  'system_overview',
];

function toBoundedNonNegativeInteger(value) {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.min(maxDiagnosticDurationMs, Math.round(value));
}

function isApiRequest(request) {
  try {
    return new URL(request.url()).pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

function toResponseStatusFamily(status) {
  if (!Number.isSafeInteger(status) || status < 100 || status > 599) {
    return 'other';
  }

  return `${Math.floor(status / 100)}xx`;
}

function toDocumentReadyState(value) {
  return ['complete', 'interactive', 'loading'].includes(value) ? value : 'unknown';
}

function toRouteCategory(url) {
  try {
    const { pathname } = new URL(url);

    if (pathname.startsWith('/app/artists/')) {
      return 'artist_detail';
    }

    if (pathname.startsWith('/app/requests/')) {
      return 'request_detail';
    }

    if (pathname.startsWith('/app/discover')) {
      return 'discover';
    }

    if (pathname.startsWith('/app/missing')) {
      return 'missing_music';
    }

    if (pathname.startsWith('/app/downloader')) {
      return 'acquisition';
    }

    if (pathname.startsWith('/app/settings')) {
      return 'settings';
    }

    if (pathname.startsWith('/app/import-review')) {
      return 'import_review';
    }

    if (pathname === '/app' || pathname === '/app/') {
      return 'home';
    }
  } catch {
    return 'unknown';
  }

  return 'other';
}

function toScenarioCategory(scenarioName) {
  const normalizedName = String(scenarioName ?? '').toLowerCase();

  if (normalizedName.includes('artist_detail')) {
    return 'artist_detail';
  }

  if (normalizedName.includes('request_detail')) {
    return 'request_detail';
  }

  if (normalizedName.includes('missing_music')) {
    return 'missing_music';
  }

  if (normalizedName.includes('downloader') || normalizedName.includes('acquisition')) {
    return 'acquisition';
  }

  if (normalizedName.includes('discover') || normalizedName.includes('discovery')) {
    return 'discover';
  }

  if (normalizedName.includes('import_review')) {
    return 'import_review';
  }

  if (normalizedName.includes('metadata')) {
    return 'metadata';
  }

  if (normalizedName.includes('settings')) {
    return 'settings';
  }

  if (normalizedName.includes('onboarding')) {
    return 'onboarding';
  }

  if (normalizedName.includes('system_overview')) {
    return 'system_overview';
  }

  if (normalizedName.includes('operator')) {
    return 'operator';
  }

  if (normalizedName.includes('home')) {
    return 'home';
  }

  return 'other';
}

function toErrorCategory(error) {
  const message = String(error?.message ?? '');

  if (/timeout|timed out/iu.test(message)) {
    return 'timeout';
  }

  if (/assert|expect/iu.test(message)) {
    return 'assertion';
  }

  if (/navigation|net::|connection|network/iu.test(message)) {
    return 'navigation';
  }

  return 'other';
}

function toReadinessTargetCategory(error) {
  const message = String(error?.message ?? '');

  if (/getByRole\(['"]heading/iu.test(message)) {
    return 'heading';
  }

  if (/getByRole\(['"]button/iu.test(message)) {
    return 'button';
  }

  if (/getByText\(/iu.test(message)) {
    return 'text';
  }

  if (/waitForURL|toHaveURL/iu.test(message)) {
    return 'client_navigation';
  }

  return 'other';
}

function createResponseStatusCounts() {
  return {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
    other: 0,
  };
}

async function readPageSnapshot(page) {
  try {
    const value = await page.evaluate(() => {
      const navigation = globalThis.performance.getEntriesByType('navigation')[0];

      return {
        documentReadyState: globalThis.document.readyState,
        domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
        loadMs: navigation?.loadEventEnd ?? null,
      };
    });

    return {
      documentReadyState: toDocumentReadyState(value?.documentReadyState),
      domContentLoadedMs: toBoundedNonNegativeInteger(value?.domContentLoadedMs),
      loadMs: toBoundedNonNegativeInteger(value?.loadMs),
    };
  } catch {
    return {
      documentReadyState: 'unknown',
      domContentLoadedMs: null,
      loadMs: null,
    };
  }
}

export function isBrowserRuntimeDiagnosticEnabled(env = process.env) {
  return env?.[browserRuntimeDiagnosticEnabledEnvVar] === '1';
}

export function createBrowserRuntimeDiagnosticObserver(page, {
  now = Date.now,
} = {}) {
  const startedAtMs = now();
  const responseStatusCounts = createResponseStatusCounts();
  const counts = {
    apiRequestCount: 0,
    apiRequestFailureCount: 0,
    apiResponseCount: 0,
    consoleErrorCount: 0,
    pageErrorCount: 0,
  };

  page.on?.('request', (request) => {
    if (isApiRequest(request)) {
      counts.apiRequestCount += 1;
    }
  });
  page.on?.('requestfailed', (request) => {
    if (isApiRequest(request)) {
      counts.apiRequestFailureCount += 1;
    }
  });
  page.on?.('response', (response) => {
    if (isApiRequest(response.request())) {
      counts.apiResponseCount += 1;
      responseStatusCounts[toResponseStatusFamily(response.status())] += 1;
    }
  });
  page.on?.('console', (message) => {
    if (message.type() === 'error') {
      counts.consoleErrorCount += 1;
    }
  });
  page.on?.('pageerror', () => {
    counts.pageErrorCount += 1;
  });

  return {
    async snapshot() {
      const pageSnapshot = await readPageSnapshot(page);

      return {
        ...counts,
        elapsedMs: toBoundedNonNegativeInteger(now() - startedAtMs) ?? 0,
        page: {
          ...pageSnapshot,
          routeCategory: toRouteCategory(page.url()),
        },
        responseStatusCounts: { ...responseStatusCounts },
      };
    },
  };
}

export async function createBrowserRuntimeDiagnostic({
  error,
  observer,
  scenarioName,
} = {}) {
  if (!observer || typeof observer.snapshot !== 'function') {
    throw new Error('browser runtime diagnostic observer is required');
  }

  const snapshot = await observer.snapshot();

  return {
    error: {
      category: toErrorCategory(error),
      readinessTarget: toReadinessTargetCategory(error),
    },
    network: {
      apiRequestCount: snapshot.apiRequestCount,
      apiRequestFailureCount: snapshot.apiRequestFailureCount,
      apiResponseCount: snapshot.apiResponseCount,
      responseStatusCounts: snapshot.responseStatusCounts,
    },
    page: {
      consoleErrorCount: snapshot.consoleErrorCount,
      documentReadyState: snapshot.page.documentReadyState,
      pageErrorCount: snapshot.pageErrorCount,
      routeCategory: snapshot.page.routeCategory,
    },
    scenarioCategory: toScenarioCategory(scenarioName),
    timing: {
      domContentLoadedMs: snapshot.page.domContentLoadedMs,
      elapsedMs: snapshot.elapsedMs,
      loadMs: snapshot.page.loadMs,
    },
  };
}

export function emitBrowserRuntimeDiagnostic(record, {
  write = (content) => process.stderr.write(content),
} = {}) {
  write(`${browserRuntimeDiagnosticMarker}${JSON.stringify(record)}\n`);
}

export const browserRuntimeDiagnosticContract = {
  diagnosticScenarioCategories,
};
