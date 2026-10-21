# Metadata browser command authority outcome

Date: 2026-10-21. See the [command design/matrix](METADATA_COMMAND_AUTHORITY_DESIGN.md)
and [official research, options and recommendation stack](METADATA_COMMAND_AUTHORITY_RESEARCH_2026_10.md).

## Result

Artist refresh and provider release-group/release imports now require the exact
admin role in the browser's presentation and workflow dispatch. A small ESM
policy supplies live capabilities; omitted predicates deny dispatch before busy
state or service calls. The parent forwards the current decision into both
workflow factories and three default-false component props.

Operator browsing retains imported-group Open and local-release Open actions.
Authenticated artist import keeps its separate existing contract. The admin-only
cache panel remains unchanged. No API authorization, schema, dependency or worker
contract changes. Fresh server session/role and CSRF checks remain authoritative
when a cached browser role still advertises a revoked command.

The first browser candidate exposed loss of focus after a refused refresh:
temporarily disabling its button left focus on the page body. A small composable
now reuses the existing interaction tracker, waits for error rendering/busy reset,
and restores the connected, enabled invoker only while it still owns focus. A
held native refusal proves that a user's move to another input is preserved.

The project [web standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
now routes Metadata command work to this matrix and records mixed Open/Import
ownership, default denial, focus ownership and the limits of controlled owners.
Its structural validator passed; this narrow reference update required no new
skill framework or global installation.

## Executed evidence and limits

- Focused workflow, policy, route-state and API selection: 50 passed. The four
  new policy/workflow cases cover exact roles, omitted/non-Boolean predicate
  results, live revocation, forwarded release authority and preserved artist import.
- Selected browser cohort: 13 unique cases passed in about 60 seconds. Three
  new native-guard cases exercise admin dispatch for all three commands, missing
  CSRF refusal, anonymous/operator/requester refusal, operator reads and artist
  import, cached-role revocation and owned focus. Ten existing cases retain cache
  baseline capture and Settings authority consumers. The new fixture uses actual
  PostgreSQL users/sessions, HTTP handlers and CSRF; only catalog and command
  services are controlled. It proves actor/guard/dispatch ordering, not persisted
  MusicBrainz imports, durable refresh queue creation or worker execution.
- Full final `npm run validate:fast`: 10,711 passed, zero failed/cancelled/skipped:
  server 5,592; client 4,422; scripts 697. Node baseline, copyright, migrations,
  schema, ESM, image/topology, lint, hygiene and both production builds passed.
  The 225 existing Vue lifecycle warnings remain; the gate is not warning-free.
- The first fast run passed all server tests and 4,421 of 4,422 client tests.
  One old source-contract assertion required the inline role-check text. Removed
  that implementation-specific assertion and renamed its wiring test; the exact
  policy and real admin/operator visibility are tested behaviorally. Its focused
  rerun and the complete final fast gate passed. No production behavior changed
  after the passing browser cohort, so that unchanged cohort was not repeated.
- Inspected the operator's 390-pixel light and 1280-pixel dark captures. They
  show the application shell and artist-import surface; native DOM/keyboard
  assertions establish the command/read behavior. No assistive-technology or full
  WCAG conformance claim, complete browser/database/provider matrix, or matched
  whole-suite performance claim is made. No timeout, worker limit or skip changed.

The initial browser run retained two passes and one focus failure; the final
13-case cohort supersedes it without counting repeats as new coverage. Browser
source was 3,188 files,
`306e88b15ec08102282011cc5400ffd6015a169d149618f95d6540ef5d90a291`.
The final source, including only the subsequent wiring-test correction, is 3,188
files, `e9b90180286965f015bdec7b1d4fdd58a71e1631b464d4b4bc8d871fb1e4662e`.
All 13 earlier resulting code/test files retain identical bytes; the final 14-file
set is verified for validation and staging. Private failed and passing evidence
remains under `.tmp/metadata-command-authority-2026-10-21/`. See the separate
[preserved Docker outcome](LOCAL_DOCKER_METADATA_COMMAND_AUTHORITY_OUTCOME.md).

## PR applicability and next item

MCP returned zero open PRs; no random candidate was available to implement
locally. No PR merge, rebase or stale-PR closure was applicable. Work stays on
main with no branch, release, tag or version bump.

Completed by the [selection ownership outcome](METADATA_COMMAND_SELECTION_OUTCOME.md):
controlled races reproduce stale results/errors and delayed imports, then verify
generation-owned publication and cleanup while preserving accepted server work.
That outcome records the next remaining asynchronous reader to qualify.
