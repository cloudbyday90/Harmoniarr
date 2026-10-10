# Catalogue fixture lifetime and schema preparation

October 10, 2026. Baseline main: `ed25034`. The separate research document
records official source discovery; the outcome records executed evidence.

## Problem and selected design

The catalogue suite has eight native cases and thirteen isolated database
variants. Its bare pause gates and lease-finally completion do not establish
worker settlement before workspace removal or database teardown. Readiness can
wait forever after a refused acquisition or an earlier callback failure. An
untracked organize transaction and success-only lease cleanup create another
ownership gap. Realpath failure precedes the existing workspace cleanup block.

Reuse the existing ESM lifecycle, workspace, rollback-client and observed native
scan-worker helpers. Extract a small catalogue scenario and worker adapter so
original and adverse cases share the actual fixture boundary. Register worker
and direct-task completion before launch. Race readiness against completion and
cancellation. Drain held work before workspace removal, pool closure and exact
captured manual lease finalizers; preserve original failures, including null.

Observe PostgreSQL waits through a known idle holder when the worker and holder
occupy the two-client pool. For a paused scan transaction, fence new observer
reads on cancellation and drain its current query before rollback. Refresh the
monitoring snapshot separately before each activity read; preserve the original
100 iterations, 10ms polling, 700ms expiry and 0.8s expiry wait.

Only after lifetime proof, assess catalogue's repeated schema cost using the
existing verified migration-only template owner. Keep a fresh clone, pool,
workspace and seeds for each variant, with an actual per-case migration check.
Add a strict independent catalogue mode override; begin with empty as its caller
default. Promote only after unchanged native cases, failed-clone independence
and pre-seed refusal controls pass. Global and dedicated adverse/bootstrap/
migration/recovery defaults remain empty. No new template cache is needed.

## Options and recommendation stack

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Scoped existing fixture ownership | Fixes held-work and cleanup races | More explicit scope and observation | Implement first |
| Verified per-file migration source with fresh clones | Avoids thirteen repeated schema applications | Source preparation, lineage checks and clone cost | Measure after lifetime proof |
| One shared mutable database or seeded template | Less preparation | Changes state isolation and rollback oracle | Reject |
| More workers, fewer assertions or relaxed deadlines | Quick configuration edit | Does not fix lifetime ownership | Reject |
| Vendor contracts plus standards evidence mapping | Makes reviews repeatable | Requires dated evidence and scoped claims | Maintain existing AI skill |

Recommended stack: modular Node ESM fixtures; actual worker settlement; explicit
transaction ownership and after-drain lease finalizers; private verified sources
and isolated native scenario databases; focused development controls followed by
one stable complete serial gate. Apply Node/pg/PostgreSQL contracts and OWASP
ownership/privacy practices here. W3C/WHATWG/IETF remain applicable to app UI and
HTTP work; this test-only slice makes no browser conformance claim.

## Acceptance and publication

Capture the existing public four-file profile before edits. Preserve all thirty-
four original cases and their SQL/lease/downstream/file assertions. Add focused
adapter controls and separate actual PostgreSQL lifetime, failed-clone and source
refusal evidence. Compare audited-empty and explicit-template profiles in the
same order with approved phase observations; report direct costs separately
from wall time and host variance. Retain untemplated bootstrap validation.

Update the standards AI skill's project evidence map with the observed ownership
boundaries, then validate its structure and installed-source identity. Fresh PR
discovery determines whether an unreplayed applicable open patch exists; an empty
eligible set requires no random replay. Finish on main, commit and push all
reviewed changes, without creating a branch, tag, release, deployment or PR merge.
