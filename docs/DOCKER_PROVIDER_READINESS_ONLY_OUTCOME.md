# Docker provider readiness-only outcome

Status: Implemented

## Delivered outcome

- Added the ESM-only
  `scripts/docker-provider-acceptance-requirements.js` module.
- Added `--readiness-only` and
  `HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_READINESS_ONLY=true` to the existing
  provider-acceptance command.
- The mode requires the provider connection and a download path mapping while
  intentionally omitting Import Review diagnostics, accepted-transfer proof,
  and Music Queue-link proof.
- Conflicting strict requirements and disabled setup prerequisites fail before
  a browser is opened.
- Success output says **provider readiness evidence** when that mode passes,
  so it does not imply a transfer has been accepted.

## Security and operator outcome

The mode preserves existing local-only, transient-browser behavior. It makes
authenticated read requests and navigation only; it does not update Settings,
create a Download run, choose a match, enqueue files, or contact a peer.
Generated evidence remains bounded to counts, statuses, configuration booleans,
and one actionable readiness result.

## Documentation outcome

- Updated the local Docker walkthrough with the readiness command and its
  safe boundary.
- Updated the provider-acceptance evidence design with the explicit first step.
- Added the separate design record in
  `DOCKER_PROVIDER_READINESS_ONLY_DESIGN.md`.

## Validation outcome

Focused resolver, CLI, evidence, artifact, readiness, and smoke-evidence tests
cover the new requirement matrix, conflicts, redaction, persistence boundary,
and browser cleanup. The following checks passed:

- `node --test test/scripts/docker-provider-acceptance-requirements.test.js test/scripts/docker-provider-acceptance-evidence.test.js test/scripts/docker-provider-acceptance-readiness.test.js test/scripts/docker-provider-acceptance-artifact.test.js test/scripts/docker-smoke-evidence.test.js`
- `npm run lint:scripts`
- `npm run lint:test`
- `npm run check:esm`
- `npm run validate`
- `npm run validate:security` (including npm audit with 0 reported
  vulnerabilities)

## Open pull-request review

No open dependency PR applies locally: Node 26 is outside the current Node 24
support policy, and the open Docker GitHub Actions version bumps are already
superseded by the pinned versions on `main`.

## Next recommended work

After an operator explicitly authorizes it, intentionally start one controlled
local Music Queue-origin provider transfer and run:

```powershell
npm run validate:docker-provider-acceptance -- -- --require-accepted-transfer --require-music-queue-link
```

That remains a manual acceptance action because it changes provider state. The
new readiness-only mode is the safe prerequisite check, not a substitute for
that evidence.
