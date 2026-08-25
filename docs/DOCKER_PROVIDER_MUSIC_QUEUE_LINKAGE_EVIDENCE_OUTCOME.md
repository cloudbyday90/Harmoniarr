# Docker Provider Music Queue Linkage Evidence Outcome

## Delivered

The Docker provider-acceptance validator now supports
`--require-music-queue-link`.

In strict mode it proves the operator-visible Music Queue handoff after an
authenticated Downloader refresh:

- at least one transfer is linked to Music Queue;
- the labelled native checkbox filters the native transfer table to that count;
- the polite result status reports the same count; and
- each previously linked transfer remains linked in the refreshed provider
  response.

The saved evidence contains bounded Music Queue totals only:
`linkedTransferCount` and `totalTransferCount`. Transfer IDs, names, paths,
provider payloads, and credentials stay out of the artifact.

The validator now follows the active `Match diagnostics` route instead of the
retired `Download candidates` heading. Its Import Review UI assertion is
skipped when diagnostics are deliberately optional, so the documented
unconfigured local probe works as intended.

## Local result

The running local walkthrough completed the intentionally non-strict probe:

```powershell
npm run validate:docker-provider-acceptance -- -- --no-require-configured-provider --no-require-path-mapping --no-require-diagnostic
```

It authenticated successfully and collected bounded queue/diagnostic state
without requiring an external provider setup. It did not claim strict Music
Queue evidence, because that requires an actual configured Music Queue-origin
provider transfer.

The requested walkthrough Compose rebuild also passed: the image built, the
application became healthy, and the bootstrap helper completed idempotently.
The separate packaged browser smoke correctly stopped at its fresh-state
guard because this preserved walkthrough has an already-running Discovery
heartbeat. Its contract requires an unconfigured provider and
`setup_required` heartbeat; the walkthrough now documents that prerequisite
instead of suggesting that an existing local state should be deleted.

The isolated controlled-provider pipeline was attempted but could not start
because Docker Desktop could not resolve Docker Hub's BuildKit frontend
(`registry-1.docker.io`). This is an external DNS/connectivity failure before
the application image or test scenario ran, not a product validation result.

## Recommendation stack

1. Use the default provider-acceptance command for configured walkthrough
   diagnostics and path-mapping evidence.
2. Add `--require-accepted-transfer --require-music-queue-link` for a real
   Music Queue-origin acceptance run.
3. Keep the native Downloader filter and its status announcement as the one
   operator interaction; do not add a second queue or stored filter setting.
4. Keep transfer identities transient and evidence aggregate-only.

## Open pull-request assessment

No open pull request was applied locally:

- PR #40 upgrades the Node image to 26.7.0, outside the project’s supported
  Node 24 engine range.
- PRs #24 and #23 update Docker Actions to versions already exceeded on
  `main`.

## Next recommended item

Run the strict command once slskd has accepted a transfer selected from Music
Queue and a download path mapping is present. If that evidence is clean, the
next product work should be observed operator recovery friction, not another
Downloader navigation or control surface.
