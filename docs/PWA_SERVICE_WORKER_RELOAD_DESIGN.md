# Service worker reload ownership

Date: 2026-10-19. Packaged dependency-closure validation exposed a first-install
login failure: direct login returned 200, but the browser never submitted the
form. Two document loads and a native required-field refusal showed that the
username had been cleared between filling the username and password. The
registration module reloaded on every controllerchange, including the first
clients.claim(). Preserve those failed collections rather than retrying the form.

## Official sources and alternatives

Discovered and opened through MCP search/navigation on October 19:

| Source and status | Application |
| --- | --- |
| [W3C Service Workers](https://www.w3.org/TR/service-workers/), September 17, 2026 Candidate Recommendation Draft | claim and activation notify controller changes. That event alone does not establish a request to reload this document. The draft is work in progress, not W3C certification. |
| [Chrome service worker lifecycle guidance](https://web.dev/articles/service-worker-lifecycle?authuser=0), informative browser guidance | Immediate activation can mix old page code with a new worker. User-triggered skipWaiting via postMessage supports a deliberate update flow. |

The decision to preserve a sibling tab is project policy inferred from the
existing user-confirmed update design, rather than a specification requirement.

| Option | Pros | Cons |
| --- | --- | --- |
| Reload only after this registration handle requests an update | Preserves first-install and sibling-tab drafts; retains the existing Reload control | A sibling can keep old page code under a new worker; future incompatible worker changes require a compatibility plan |
| Skip only the first claim | Small first-install fix | An unrelated tab can still erase a draft by activating an update |
| Disable service workers or wait for readiness before typing in tests | Avoids the observed timing | Hides the production race and discards lifecycle coverage |
| Remove clients.claim | Avoids initial takeover | Changes worker availability and does not establish local reload intent |

## Implementation and verification

Keep the existing small ESM registration factory and injected browser APIs.
Arm reload before posting SKIP_WAITING to an actual waiting worker; disarm on
dispatch failure, preserving that failure. Ignore duplicate requests while
pending. Controller changes reload at most once only with local intent.
Unsupported browsers and failed registration retain their nonfatal behavior.
Leave API caching, authentication, CSRF and worker scripts unchanged.

Unit cases cover initial claim, sibling activation, later explicit update, absent
waiting worker, duplicate controller events and failed dispatch/recovery. A native
Chromium case serves the real registration module and service worker from an
owned loopback server, holding shell precaching until text/focus are present.
Then exercise a real worker update with two tabs. This is module-boundary proof;
the packaged application must separately pass its actual login and lazy routes.

Recommend retaining Vue's static build, current service worker/cache policy and
explicit per-page update intent. Do not add timers, credential persistence or
forced form retries. See the [outcome](PWA_SERVICE_WORKER_RELOAD_OUTCOME.md).
