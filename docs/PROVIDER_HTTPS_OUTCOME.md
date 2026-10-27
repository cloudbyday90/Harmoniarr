# Provider HTTPS qualification outcome

Implemented October 21, 2026 on main, following the
[design](PROVIDER_HTTPS_DESIGN.md) and [official research](PROVIDER_HTTPS_RESEARCH_2026_10.md).

October 27 follow-up: default Spotify/YouTube requests now use the application-owned
[native HTTP boundary](PROVIDER_HTTP_OUTCOME.md). The original bundled-fetch/proxy
cohort explicitly injects the retained fetch seam for those providers; Apple
Music remains on that original implementation. Earlier fetch evidence does not
establish the new native socket/codec/DNS lifetime. Current qualification and
compatibility limits belong to the linked follow-up documents.

## Result

The shared Spotify/YouTube/Apple Music request service now normalizes malformed
URL parser failures to its existing bounded `request_rejected` diagnostic. The
baseline probe returned `ERR_INVALID_URL` with a raw `input` field containing a
synthetic private sentinel. The corrected service retains neither parser input
nor cause and performs no network dispatch. This is an internal diagnostic
containment fix; no externally exploitable route was demonstrated.

Existing allowlisted origins, default TLS verification, redirect refusal,
decoded-byte caps, HTTP classification, deadlines and OAuth behavior remain.
No package resolution, runtime pin, API, UI, database, project version or release
configuration changed. All added first-party code is ESM, split between fixture
ownership, child execution, consumer scenarios and native tests.

MCP GitHub queries at selection and completion found zero open PRs. None was
available to select, implement, rebase, close or merge. Work stayed on main;
no separate branch, release or tag was created.

## Native evidence

`test/server/provider-https.test.js` exercises bundled fetch through a temporary
child-scoped proxy and public test CA. The proxy opens only owned loopback
sockets and preserves production URL/Host/SNI identity. No remote provider,
public DNS, operator credential or production trust override is required.

| Boundary | Observed result |
| --- | --- |
| Real Spotify client | Token form/Basic credentials, one cached token request, two Bearer API requests and normal gzip/Brotli decoding |
| Real YouTube and Apple Music clients | Synthetic API-key and signed-token requests reached their actual hostname identities and decoded responses |
| Shared Google OAuth request | Actual form POST and compressed token JSON at the fifth approved origin; not an OAuth database-flow claim |
| Certificate identity and chain | Matched DNS and IPv4 succeed; mismatched DNS/IP and absent trust refuse before HTTP delivery |
| Origin admission | IP URL, userinfo, fragment, deceptive suffix, HTTP, alternate port and malformed input produce no tunnel or TLS connection |
| Redirects | 301/302/303/307/308 refuse both same-origin and cross-origin destinations; no redirect-target tunnel/request, later healthy request succeeds |
| JSON bounds and errors | Gzip/Brotli bodies smaller than 128 encoded bytes but larger than 128 decoded bytes refuse; chunked overflow, malformed compression/JSON/UTF-8 also refuse |
| HTTP diagnostics | Known quota reason remains distinct, Retry-After clamps to 86,400 seconds, oversized 401 retains status classification; private response fields/headers are absent |
| Deadline retirement | Stalled and continuously trickling bodies time out; both sockets must actually close before the still-running child's healthy response completes |
| Adverse fixture lifetime | Active child cancellation and a callback's original null rejection both drain process/stdio before socket/listener/file retirement |

IP fetches are separate runtime controls. They do not expand the production
provider origin allowlist. The TLS verifier is not replaced or disabled. Test CA
trust exists only in the fresh child's startup environment; fixture leaf keys
are intentionally public, and the signing key is not committed.

## Validation

Final source fingerprint: **3,259 files**:

```text
be88db618a8f29a787017aed95508f6ef88dcf0bf1955b2cefde1f6c1e5bc57a
```

Seven changed code/configuration hashes remain unchanged through qualification.

| Gate | Result |
| --- | --- |
| Focused native/policy/client/resolver/access-check/OAuth/cancellation selection | 72 passed, zero failed/cancelled/skipped |
| `npm run validate:fast` | 10,817 passed: 5,650 server, 4,470 client, 697 scripts |
| Fast gate static/lint/copyright/ESM/migration/snapshot checks and both builds | Passed |
| Same eight native tests in pinned Node Linux amd64 container | 8 passed, zero failed/cancelled/skipped; network none, read-only, explicit resource limits, exact container removal/absence verified |
| Client build | All 155 artifact hashes unchanged |
| Updated validation skill | `quick_validate.py` passed; conditional reference points to the executed fixture |

The focused 72-test command completed in about 3.80 seconds on this host. This
is selected local evidence, not a matched whole-suite or hosted-CI speed claim.
The automatic server lane includes the eight native checks without requiring
Docker or PostgreSQL. No SQL, session or browser behavior changed, so unrelated
database/browser matrices were not repeated.

The first candidate had two failures: malformed input exposed the actual parser
gap; a quota case incorrectly expected `rate_limited` despite its known
`QUOTA_EXCEEDED` reason. The latter test expectation was corrected to preserve
the existing contract. Initial lint findings were corrected before the stable
fast gate. The first private Linux collector expected TAP while Node emitted
spec output: all eight tests and native exit status passed, but its collector
assertion failed. That container retired; the corrected explicit TAP run passed
on the same source. Original logs remain private under
`.tmp/provider-https-2026-10-21`.

The [Docker outcome](LOCAL_DOCKER_PROVIDER_HTTPS_OUTCOME.md) records the separate
preserved installation rebuild and readiness proof.

## Recommendation and next work

Retain Node 24.22.1/npm 12.0.2, pinned Alpine images, built-in fetch, modular ESM
services, exact provider origins, default TLS and bounded decoded JSON. The main
benefits are real consumer coverage and no additional transport dependency. Costs
are a small maintained fixture and selected proxy-path coverage.

Live provider infrastructure, public DNS, proxy authentication, IPv6, TLS session
resumption, arm64 execution and other HTTP clients remain unqualified here. This
does not establish whole-application SSRF resistance, every vendor security fix,
Trace Context conformance, accessibility acceptance or a release qualification.

Next, qualify and bound **metadata-provider JSON responses and transport error
projection**, beginning with Last.fm. Current Last.fm and MusicBrainz success
paths still call `response.json()` directly; Last.fm request failures retain URL
and cause in internal details. Trace downstream disclosure before claiming a
vulnerability, preserve provider retry/queue semantics, and add owned native
oversize/deadline/diagnostic controls before choosing a shared-reader adoption.
