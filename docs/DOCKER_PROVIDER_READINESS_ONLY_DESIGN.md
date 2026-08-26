# Docker provider readiness-only design

Status: Implemented

## Context

The provider-acceptance validator is intentionally strict by default: it
expects a configured provider, a saved download path mapping, and an Import
Review diagnostic. That is the right proof after an operator has started a
download run, but it makes a basic local setup check look like a failed
transfer proof.

The former workaround combined several `--no-require-*` flags. It was easy to
misread, could disable the very prerequisites an operator meant to verify, and
did not communicate that the run is read-only.

## Official guidance reviewed

As of August 2026:

- OWASP recommends secure defaults and reducing attack surface. A mode that
  preserves connection and path-mapping checks, rather than turning them all
  off, follows that principle:
  <https://cheatsheetseries.owasp.org/cheatsheets/Secure_Product_Design_Cheat_Sheet.html>
- Docker Compose uses health checks and `service_healthy` as its readiness
  model. Harmoniarr’s readiness proof therefore verifies application-level
  prerequisites only after the local stack is healthy:
  <https://docs.docker.com/compose/how-tos/startup-order/>
- Playwright recommends isolated contexts and user-facing, explicit contracts.
  The existing browser scenario remains a transient, authenticated, read-only
  browser context that uses labels and headings rather than implementation
  selectors: <https://playwright.dev/docs/best-practices>
- WCAG 2.2 requires clear labels, instructions, and error identification when
  an interface accepts input. Although this is a CLI mode rather than a new
  web control, the same model informs its one-purpose name and explicit
  conflict errors: <https://www.w3.org/TR/wcag/>

## Decision

Add a modular ESM requirement resolver,
`scripts/docker-provider-acceptance-requirements.js`, and expose one explicit
mode:

| Input | Result |
| --- | --- |
| `--readiness-only` | Checks provider configuration and one-or-more download path mappings. |
| `HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_READINESS_ONLY=true` | Environment equivalent for a local wrapper. |
| Default command | Retains the existing diagnostic-based provider-acceptance contract. |

Readiness-only forcibly uses these requirements:

```text
configured provider: required
download path mapping: required
Import Review diagnostic: not required
provider-accepted transfer: not required
Music Queue-linked transfer: not required
```

It fails fast when an invocation combines the mode with an explicit strict
execution requirement, or attempts to disable provider configuration or path
mapping. This prevents a command name from silently weakening a selected
proof.

The existing provider-acceptance browser scenario performs authenticated GET
requests and navigation only. The new mode changes its requirements—not its
request methods, provider configuration, Download run state, or peer-to-peer
activity.

## Pros and cons

| Option | Pros | Cons |
| --- | --- | --- |
| Explicit readiness-only mode (selected) | Clear purpose; validates meaningful prerequisites; no transfer required; fails on conflicting intent | Adds one small CLI mode and resolver module |
| Continue using several `--no-require-*` flags | No code change | Easy to disable meaningful checks and unclear to the operator |
| Create a synthetic transfer | Could exercise more stages | Changes provider state and cannot replace operator-authorized local acceptance |

## Final recommendation stack

1. Start the local Compose stack and wait for its health checks.
2. Run `validate:docker-provider-acceptance -- -- --readiness-only` after
   configuring the provider and path mapping.
3. Address the one returned setup action in its owning Settings screen.
4. Only after explicit operator approval, intentionally start a local
   Music Queue-origin provider transfer and use the strict acceptance flags.

## Non-goals

- No provider request, transfer, or queue mutation.
- No new Home, Music Queue, Downloader, or Settings page.
- No broad “disable all requirements” switch.
