# Canonical media rollout outcome

Date: 2026-10-15. Work performed directly on main; no release/tag.

## Reversed complete-cohort result

The unchanged pilot code completed the requested reverse order. Both six-case
cohorts passed with zero skips and identical work: eight generated files and
27 current ffprobe inspections, distributed 4/0/0/0/11/12. The API path created
one owner for each of the three media scenarios and none for the SQL-only cases.
All owners reported verified cleanup; transport observations had no failed,
pending, clipped or untimed records.

| Order | Mode | Command seconds | Four-inspection scenario seconds | Eleven-inspection scenario seconds | Twelve-inspection scenario seconds |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | Per-command | 119.027 | 9.262 | 13.452 | 16.274 |
| 2 | Owned API | 44.704 | 9.500 | 11.298 | 11.678 |

Initial host CPU load was 81%; a later point sample during the collection was
72%. These samples do not establish a quiet validation window or continuous
load profile. Command time contains setup outside the scenario windows and
varied substantially. Do not attribute the 74.323-second command difference
solely to media execution, or present it as a whole-CI improvement. The
inspection-heavy cases again favored API while the four-inspection case did not.
The [earlier pair](LIBRARY_ADD_MEDIA_PILOT_OUTCOME.md) remains separate evidence.

## Default decision and implementation

Keep per-command as the default and owned-api as an explicit option. The current
Ubuntu validation workflow does not configure an image-backed API canonical
media lane. The reviewed reader rejects unsupported Engine versions/endpoints;
a local Windows collection cannot establish those deployment capabilities.
Additional performance repetition alone would not close that platform gap.

Implemented the concrete modular improvement identified during review:

- `library-add-media-tools.js` contains the unchanged media tool/path helper and
  only Node built-ins. The SQL fixture retains compatible named exports.
- `library-add-media-options.js` contains the unchanged pure option policy;
  the scoped adapter retains its compatible named export.
- The adapter imports the narrow tools/policy modules directly. Its scenario,
  close, original Error/null and workspace safety logic is unchanged.

An actual fresh-process resolver probe went from 75 project modules/27 server
modules to 13 project modules/one server utility. That remaining utility is the
small shared task-cleanup helper. Pure policy/tool entrypoints need no production
server modules. A private extraction comparison confirmed both moved function
bodies unchanged. This reduces dependency coupling; it does not claim database
connections were previously opened by import or prove an end-to-end speedup.

## Validation boundaries

Ten focused tests passed on the final extracted code. A fresh Node process
registers a native resolution guard before importing tools, policy and adapter;
database/application imports fail at that boundary. Real local child commands
prove output/completion, exact owner delegation remains limited to ffprobe, and
an outside Docker fixture path refuses before native dispatch. Existing controls
retain held close, serial admission through the returned database tail, original
Error/null, strict predicates and sticky child/parent retention.

The unchanged-code timing collection and the later final-source validation are
separate. Existing native legacy-import consumers exercise the compatibility
exports. All original canonical test bodies remain unchanged, including CSRF,
ownership, replay, audit/queue rollback, current drift, exact delivered bytes and
collision/staging/reuse refusal. No production schema/service, resource bounds,
media commands, timeout, hash/receipt contract or other private comparator changes.

Final extracted-code native proof completed both six-case cohorts: owned API
41.350 seconds, per-command 43.399 seconds. These are validation durations, not
a matched import-performance experiment. Both retained eight generated files,
27 inspections and zero skips. All seven native owned-media controls passed in
31.890 seconds, including changed-file reinspection, write denial, nonzero
commands and actual CLI/API timeout retirement. Native and final source snapshots
are retained; their only later difference is removing final blank lines from the
two extracted modules. Focused controls passed again on that final formatting.

`npm run validate:fast` passed in 130.687 seconds: 5,259 server, 4,384 client
and 568 script tests, totaling 10,211, with zero failures/skips. Static policy,
lint and both builds passed. The production-only dependency audit reported zero
vulnerabilities. This is gate evidence, not a comparison with prior fast timings;
the full integration/scaling matrix was not repeated.

Both repository skills and the installed standards skill passed structural
validation; all four installed standards files matched their repository bytes.
The final staged source manifest covers five JavaScript files and verifies
80 earlier source baselines unchanged. Structural skill validation is separate
from the native boundary proof; no new blind skill trial is claimed.

Initial and final GitHub MCP collection reads returned zero open PRs. No random
applicable PR existed, so no PR patch, rebase, merge or comment was performed.

Private source freezes, import counts, extraction checks, native logs and gate
summaries remain ignored under `.tmp/library-add-media-rollout-2026-10-15/`.

## Recommendation stack, pros and cons

Keep pure policy → Node-only media tools → scoped media adapter → guarded app/
database/workspace runtime → reviewed local Engine reads plus CLI lifecycle →
unchanged canonical assertions. Maintain the existing practical standards/testing
skill evidence map rather than create a second overlapping checklist.

Advantages: fewer container starts for inspection-heavy scenarios, explicit
current-state ownership and media-only tests that avoid unrelated SQL imports.
Costs: two supported execution paths, extra focused modules, privileged trusted
daemon access and deliberate artifact retention after uncertain cleanup.
Removing inspections, increasing concurrency or switching defaults without native
platform proof would change the contract being measured.

Next implement an explicit Linux canonical media validation lane with an existing
immutable image and reviewed Engine capability, requiring six passing cases with
zero prerequisite skips and verified cleanup. Keep it selected rather than add a
large automatic scaling matrix. Use that result to decide cohort default adoption;
full Engine exec/lifecycle API migration remains a separate design. See the
[design](LIBRARY_ADD_MEDIA_ROLLOUT_DESIGN.md) and
[official research/options](LIBRARY_ADD_MEDIA_ROLLOUT_RESEARCH_2026_10.md).
