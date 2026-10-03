# Scoped policy overrides skill design

Status: Accepted for implementation
Date: October 3, 2026

## Purpose and boundary

Create `harmoniarr-scoped-overrides` for changes that save or consume a user's
exception to acquisition policy in shared work. The reusable risk is a choice
that is stored correctly but ignored, applied to siblings, or used to weaken a
later verification gate. The quality-fallback investigation demonstrated all
three boundaries need explicit review.

The existing canonical-actions skill addresses the whole command journey. This
skill addresses policy ownership and the effective shared consumer. Ordinary
styling, copy, generic route work, and unrelated settings should not select it.
It does not authorize publication, releases, PR merges, or account changes.

## Options and recommended structure

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Extend canonical-actions with every policy detail | One entry point | Loads policy-specific rules for unrelated commands | Reject |
| Add a generic security skill | Broad reuse | Loses the wanted-link/shared-discovery distinction and verification boundary | Reject |
| Add a narrow project skill with one short consumer map | Precise discovery and task-specific invariants | Consumer map must follow architectural changes | Adopt |

Use a concise `SKILL.md`, quoted `agents/openai.yaml` metadata, and one reference
mapping the durable choice to read projection, shared search and downstream
inspection. No executable helper or generated scaffolding is needed. Commit the
source under `.agents/skills/harmoniarr-scoped-overrides` and install the same
content into the user's local Codex skill directory for discovery.

## Required behavior

Trace the selected recipient's policy authority independently of shared observed
facts. Prove that each relevant consumer reads the saved scoped exception and
that sibling recipients retain their requirements. Keep base verification and
filesystem/safe-add gates separate from effective search preferences. Treat
unknown policy conservatively and retain shared participants rather than dropping
owners to satisfy consent. Use current guarded writes, atomic audit/retry intent,
durable replay, and truthful post-commit status.

Choose tests that exercise the authority and consumer boundary: mixed recipients,
unknown or disabled participants, stale evidence, weak candidates, absent links,
rollback and retry. Do not replace implementation evidence with a stored flag or
matching wording.

## Validation and outcome

Run the bundled skill validator on tracked and installed copies, verify they are
identical, and perform an independent bounded review scenario using only the
skill and minimal raw artifacts. Record the observable result and any necessary
instruction correction in a separate outcome document. Keep generated evaluation
artifacts under ignored `.tmp` and do not provide the evaluator the intended
answer.
