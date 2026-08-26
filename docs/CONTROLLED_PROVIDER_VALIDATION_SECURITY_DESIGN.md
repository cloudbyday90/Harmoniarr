# Controlled Provider Validation Security Design

## Status

Implemented on 2026-08-26. This design hardens the disposable Docker
controlled-provider proof without changing the self-hosted product workflow.

## Problem

The controlled-provider pipeline intentionally uses a short-lived API key,
temporary directories, and synthetic provider data. Its successful result is
already aggregate-only, but two failure paths were broader than that contract:

- the large validation script serialized its complete verifier payload when an
  assertion failed; and
- Compose command output and service logs could be appended without a shared
  redaction boundary.

Those details are disposable, but they are not useful in normal terminal,
continuous-integration, or shared support output. The same boundary also used
an environment variable for the fixture key, making it more visible to process
and container-inspection tooling than necessary.

## Official Sources Reviewed

| Source | Current guidance | Decision |
| --- | --- | --- |
| [Docker Compose secrets](https://docs.docker.com/reference/compose-file/secrets/) | A service accesses a secret only when it is explicitly granted one. Compose supports a file-backed secret source. | Write one 0600 temporary key file and grant it only to the Harmoniarr and controlled-provider services. |
| [Docker Compose networking](https://docs.docker.com/compose/how-tos/networking/) | Compose services use an isolated project network by default; host ports are only needed for outside access. | Keep the provider internal and continue publishing only Harmoniarr's ephemeral localhost port. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Secrets, session values, paths, and internal addresses should be removed, masked, sanitized, hashed, or encrypted before logs are retained or displayed. | Redact disposable keys and workspace paths from command failures and appended Compose logs. Do not preserve the unredacted error as an error cause. |
| [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html) | Results, progress, and errors should be programmatically determinable without an unnecessary focus change. | Return named failed checks instead of a raw JSON dump. The existing visible Music Queue and Downloader status controls remain unchanged. |

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep raw verifier JSON and Compose logs | Fastest diagnosis while developing locally | Can expose temporary identities, paths, and secrets in terminal or CI output | Rejected |
| Suppress all failure output | Lowest disclosure risk | Removes the actionable check that failed | Rejected |
| Use only an environment variable for the fixture key | Smallest Compose change | Exposes a secret in container environment inspection | Rejected |
| Modular aggregate evidence, redacted diagnostics, and a file-backed Compose secret | Concise, actionable output; key is service-scoped; policy can be reused by Docker checks | Adds small policy modules and focused tests | Chosen |

## Design

### 1. Aggregate-only verifier policy

`scripts/controlled-provider-pipeline-evidence.js` owns the eleven evidence
checks. It returns only stable check names such as `shared_recovery`; it never
serializes the verifier's provider, release, operator, transfer, or run IDs.

### 2. Disposable provider secret

`scripts/controlled-provider-validation-secret.js` creates a 0600
`controlled_provider_api_key` file in the validation's 0700 temporary
workspace. `compose.controlled-provider-fixture.yaml` mounts that secret only
into the two services that require it. The fixture server and packaged verifier
read `/run/secrets/controlled_provider_api_key`; no provider key is passed as a
container environment variable.

### 3. Shared Docker failure redaction

`scripts/docker-validation-redaction.js` masks known disposable secrets and
temporary workspace paths in both a command error and appended service logs.
It creates a new bounded error rather than retaining the original, unredacted
error as `cause`. The managed slskd smoke validation uses the same module,
removing a duplicated local redaction implementation.

### 4. Deterministic cleanup

The controlled-provider runner now records a primary validation failure,
collects logs before teardown, and attempts Compose teardown and workspace
removal before it reports the bounded error. A cleanup-only failure is also
redacted. A cleanup failure never replaces an earlier validation failure.

## Security Boundary

- The key is random, process-local, file-backed, and removed with the temporary
  Compose workspace.
- Only Harmoniarr and the internal fixture receive that secret mount; the
  provider still has no host-published port, drops all Linux capabilities, uses
  `no-new-privileges`, and is read-only except for the temporary downloads
  mount.
- Failure output contains stable check names and redacted service logs, never
  intentionally retained keys, VAPID values, or temporary host paths.
- This changes validation infrastructure only. It does not add a route, UI
  control, stored provider setting, or a real Soulseek request.

## Final Recommendation Stack

1. Use `npm run validate:docker-controlled-provider-pipeline -- --no-cache`
   as the credential-free regression proof for Music Queue-to-Downloader
   pipeline behavior.
2. Use the owner-configured strict provider probe only when an operator has an
   accepted Music Queue-origin transfer; it complements but does not replace
   the disposable proof.
3. Keep Docker validation evidence aggregate-only and centralize any future
   Docker log redaction in `docker-validation-redaction.js`.
4. Do not combine Music Queue and Downloader merely to surface provider
   mechanics; retain the existing release-to-transfer handoff.

## Validation Plan

1. Unit-test complete and incomplete aggregate pipeline evidence.
2. Unit-test secret-file mode and Docker error/log redaction.
3. Assert the Compose and fixture contracts use a secret mount rather than the
   provider-key environment variable.
4. Run the focused script suite, script/test linting, ESM consistency check,
   full Docker controlled-provider pipeline, security validation, and the
   repository validation gate.

## Next Item

The next product-facing evidence should be a real owner-configured strict
provider probe after an accepted Music Queue-origin transfer exists. That needs
operator provider configuration and must not be synthesized from a personal
library or credentials. Until then, the hardened controlled-provider pipeline
is the appropriate automated regression gate.
