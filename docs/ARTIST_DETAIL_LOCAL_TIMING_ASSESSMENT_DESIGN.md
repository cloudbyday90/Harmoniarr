# Artist Detail Local Timing Assessment Design

Status: Implemented
Date: 2026-08-30
Owner: Metadata architecture + quality engineering

## Decision

Add a local, offline assessment command for an already captured Artist Detail
timing artifact. It validates the existing strict schema, derives one fixed
next action from the observed route and presentation states, and prints only
fixed explanatory text. It does not capture another visit, alter caching,
change UI state, write application data, or add telemetry.

The command is an interpretation aid—not a substitute for the required
three-sample capture under the account that experiences the report.

## Why this is the next work

The existing timing command produces a deliberately private JSON artifact. It
correctly avoids retaining artist IDs, users, URLs, credentials, headers,
bodies, cache keys, and page text, but a household administrator still needs
to translate several bounded fields into one safe next investigation. That
translation should be deterministic and conservative instead of encouraging a
cache or SWR change from a healthy local baseline.

The previous local walkthrough showed three `ready` / `local_projection`
samples. It cannot represent an affected account. An offline interpreter now
makes the next real capture usable while keeping the distinction explicit:
healthy evidence means reproduce the original account and artist; a repeated
failure points to one specific client or provider investigation.

## Standards and research review

Reviewed on 2026-08-30 against current primary sources:

- [W3C User Timing](https://www.w3.org/TR/user-timing/) specifies high-
  precision monotonic performance timestamps. Harmoniarr already converts its
  browser observations to rounded, navigation-relative values. The assessor
  uses only the validated bounded artifact; it does not add marks, raw traces,
  absolute clocks, or a new performance collector.
- [WCAG 2.2 Understanding Success Criterion
  4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  explains that waiting-state information must be programmatically
  determinable without a focus change. The existing Artist Detail `role=status`
  and `aria-busy` lifecycle remains the product-facing communication. The
  command avoids adding another live region or operational status surface to a
  normal music-management view.
- [W3C Technique ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html)
  documents `role=status` as a polite status mechanism. The assessment maps
  the existing semantically observed `ready`, `still_loading`, and
  `unavailable` evidence rather than inferring state from visual copy.

## Design

Two small ES modules keep collection, interpretation, and command-line I/O
separate:

- `scripts/artist-detail-local-timing-assessment.js` owns the pure assessment
  contract and fixed presentation. It first validates the version-2 single or
  batch artifact with the existing strict validator, then produces one of the
  fixed action codes below.
- `scripts/assess-artist-detail-local-timing.js` owns argument parsing,
  workspace-confined file reading, JSON parsing, and raw output. It accepts
  only `--evidence-path`; it has no network target, credentials, cookies,
  browser, provider, or write path.

Assessment precedence is deliberately conservative:

| Evidence observed | Fixed next action | Why it is first |
| --- | --- | --- |
| Any `unavailable` presentation state | `inspect_discography_availability` | The named Discography region did not become available; cache is not yet a supported diagnosis. |
| Any `still_loading` presentation state | `inspect_client_loading_lifecycle` | The accessible loading state persisted and should be traced through the client render/request gate. |
| More than one route outcome in a batch | `reproduce_route_variation` | Local projection availability varies; explain that before changing fallback or caching. |
| A consistent provider Discography fallback | `inspect_provider_cache_path` | Compare existing provider `Server-Timing` cache evidence before changing SWR. |
| Ready local-projection evidence | `reproduce_affected_case` | The local baseline is healthy; obtain affected account/artist evidence before runtime changes. |

The assessment reports only fixed action and observation labels plus whether
the input was one sample or a repeated capture. It intentionally emits no
timing values, timestamps, endpoint details, user, artist, URL, or free-form
error content.

## Use

First capture the evidence with the existing local-only measurement command.
Then assess the saved workspace artifact with no password, browser, provider,
or network input:

```powershell
npm run assess:artist-detail-local-timing -- -- --evidence-path `
  .tmp\artist-detail-local-timing-batch.json
```

The command prints one fixed observation and its fixed next action. It does
not modify the artifact or any Harmoniarr state.

## Security and multi-user boundaries

- The CLI resolves the selected evidence path with the existing
  workspace-only resolver, then checks the canonical workspace and artifact
  paths. Paths outside the repository—including a path that reaches outside
  through a symlink—are rejected before any read.
- JSON is parsed and revalidated against the strict timing artifact contract
  before assessment. Unexpected properties—including identity or credential
  fields—are rejected, not copied or logged.
- The output is generated from fixed enumerations and fixed prose. It cannot
  echo raw file content, a username, artist identifier, URL, session, request
  data, or timing value.
- The command performs no browser navigation, provider request, database
  query, cache invalidation, setting write, or cross-user read. It therefore
  preserves the capture account's multi-user boundary.

## Options and trade-offs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Change SWR/cache from the walkthrough baseline | Immediate-looking response | The baseline was healthy and not the affected account; risks masking the cause | Reject |
| Add a production diagnostic dashboard | Convenient visual interpretation | Adds persistent operational data and an unnecessary home-hosted UI surface | Reject |
| Tell operators to interpret raw JSON manually | No code | Repeats complex reasoning and can lead to premature cache changes | Insufficient |
| Add a bounded offline assessment command | One clear, deterministic next action; no production data or network access | Requires an existing artifact | Adopt |

## Open pull request assessment

The current GitHub pull-request list has three open entries. None applies to
this local diagnostic improvement, so no pull request will be merged or copied
into this worktree:

| PR | Proposal | Assessment |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | Node `24.19.0-alpine` to `26.7.0-alpine` | Separate major runtime migration; `package.json` currently permits Node 24 only. |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `docker/build-push-action` 7.1 to 7.2 | Already superseded by the current pinned 7.3 workflow action. |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `docker/metadata-action` 6.0 to 6.1 | Already superseded by the current pinned 6.2 workflow action. |

## Final recommendation stack

1. Add the workspace-only assessment command for a captured timing artifact.
2. Run the existing three-sample capture under the affected account and artist,
   then assess that artifact locally.
3. Follow only the returned bounded investigation path; do not modify cache or
   SWR because of a healthy local-projection result.
4. Add a focused regression beside the confirmed slow or varying boundary
   before changing production behavior.
