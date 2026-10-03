# Canonical action skill design

Status: Accepted for implementation
Date: October 3, 2026

## Purpose

The architecture review found a recurring project risk: mature backend
capabilities can remain disconnected from the canonical UI while older plans
continue to describe superseded surfaces. Future work needs a repeatable way
to trace visible state, actor/target ownership, durable mutation, and refreshed
feedback as one user journey.

## Recommendations and tradeoffs

| Option | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Expand the backend architecture skill | Centralizes guidance | Makes a backend skill responsible for UI lifecycle and product routing | Keep its existing boundary |
| Create a generic project development skill | Covers more work | Repeats existing instructions and triggers too broadly | Reject |
| Create a narrow canonical-action skill | Captures project-specific ownership, legacy-route, dispatch, and refresh traps | Adds one maintained entrypoint | Adopt |

The new `harmoniarr-canonical-actions` skill covers user commands and recovery
handoffs. It excludes ordinary styling, does not mandate branch creation,
and does not authorize remote mutations. It preserves the user's chosen scope
and points to current repository paths rather than bundling copied schema or
API inventories.

## Final recommendation stack

- A concise `SKILL.md` containing the non-obvious project invariants.
- Optional Codex UI metadata under `agents/openai.yaml`, with normal implicit
  discovery retained.
- A versioned shared copy under `.agents/skills/` plus a locally installed
  discoverable copy under the configured Codex skills directory.
- Frontmatter/scaffold validation through the bundled skill-creator validator.
- An independent read-only scenario review after implementation, checking
  behavior rather than matching headings or repeating the intended answer.

The action design's [official-source research](MISSING_MUSIC_SEARCH_AGAIN_DESIGN.md)
supports authorization, ESM modularity, async cleanup, and accessible feedback.
The skill adds Harmoniarr-specific context to that guidance; it is not a new
authorization or background-job framework.

## Acceptance

Another agent should locate the current surface, preserve actor/target scope,
reuse existing durable work, recognize stale documentation, and select
meaningful transaction/browser proof. The entrypoint must contain no scaffold
placeholders or machine-specific paths. Installation must not overwrite an
unrelated existing skill.
