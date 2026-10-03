# Scoped policy overrides skill outcome

Completed October 3, 2026. The separate
[design](SCOPED_POLICY_OVERRIDES_SKILL_DESIGN.md) records the capability boundary,
alternatives, and validation plan.

## Implemented skill

[harmoniarr-scoped-overrides](../.agents/skills/harmoniarr-scoped-overrides/SKILL.md)
now contains concise ownership/effective-consumer instructions, one acquisition
consumer-map reference, and quoted Codex UI metadata. It is discoverable for
quality fallback and similar target-owned policy exceptions, while ordinary UI
styling and unrelated settings remain outside its scope.

The repository copy is the maintained source. The same three files are installed
in the user's local Codex skills directory. Per-file SHA-256 comparison found the
tracked source and installed copy identical. The bundled `quick_validate.py`
accepted both copies. No generated scaffold, executable helper, or unrelated
configuration was added.

## Independent behavioral evaluation

An independent agent received the finished skill and an isolated realistic review
request with a small ESM proposal. It received no expected answer, suspected bug,
or prior conclusions and could read only the supplied artifacts. No tracked
implementation, live service, or mutation function was accessed or executed.

The resulting review correctly identified consent spreading across recipients,
search preferences weakening downstream verification, non-atomic writes and
audit, absent durable replay, stale observation-based permission, and a premature
completion claim. It proposed narrow policy/projection/write/consumer modules and
meaningful mixed-owner, verification, transaction, retry, worker and browser
evidence. It kept the selected person's exception separate from shared policy.

The evaluator respected the request's restriction on source reads despite the
skill's normal instruction to inspect current implementation, and explicitly
limited its conclusions to the supplied proposal. No instruction change was
needed based on that evaluation. A subsequent independent application review
found a concrete mixed 256/320 kbps minimum defect; the skill now explicitly
requires saved numeric minimums to survive actual selection and downstream
context, with the project-specific preference/profile distinction in its map.
Source tracing also exposed a default-object compatibility gap; the map and
entry point now distinguish legitimate account defaults from unknown policy.
Evaluation inputs and review are retained locally
under ignored `.tmp/scoped-overrides-skill-evaluation`.

## Limits and recommendation

The validator checks structure, not decision quality. One bounded static review
is useful behavioral evidence, not an exhaustive evaluation or proof of production
behavior. The application change's tests are documented in the
[quality fallback outcome](MISSING_MUSIC_QUALITY_FALLBACK_OUTCOME.md).

Use this skill with the existing canonical-actions skill when implementing the
next target-owned exception. Update the consumer map when actual module boundaries
change; add instructions only when observed use demonstrates a missing invariant.
The skill grants no release, branch, merge, publication, or external-action
authorization.
