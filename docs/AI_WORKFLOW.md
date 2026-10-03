# AI Workflow And Shared Copilot Skills

## Purpose

This repository includes a shared `.agents/` directory for GitHub Copilot agent workflows in VS Code.

The goal is to keep reusable AI workflow guidance versioned alongside the project so UI review, frontend implementation, browser testing, and related tasks follow the same repo conventions.

## What `.agents/` Is For

- Shared Copilot skills and reference material used by the VS Code agent workflow.
- Reusable guidance for frontend implementation, UI review, browser testing, and design-oriented tasks.
- Repo-level workflow context that the team may want to evolve and review like normal documentation.

Current skill areas include:

- Premium frontend UI direction
- Web design review
- Web app testing
- General web implementation guidance
- Scroll animation guidance
- Penpot UI/UX design guidance
- Optional image-generation workflow guidance
- Harmoniarr canonical actions: complete a visible music workflow through its
  ownership policy, durable command, and refreshed UI. The shared entrypoint is
  [.agents/skills/harmoniarr-canonical-actions/SKILL.md](../.agents/skills/harmoniarr-canonical-actions/SKILL.md).
- Harmoniarr scoped overrides: trace a recipient's acquisition exception through
  shared search and downstream verification. Use
  [.agents/skills/harmoniarr-scoped-overrides/SKILL.md](../.agents/skills/harmoniarr-scoped-overrides/SKILL.md)
  when changing policy exceptions; ordinary styling and unrelated settings are
  outside its scope.
- Harmoniarr web standards: connect applicable W3C, WHATWG, OWASP, IETF, and
  official implementation guidance to a concrete web journey and its evidence.
  Use [the standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
  for standards-oriented command/form work and review.

## Tooling Scope

`.agents/` is intended for GitHub Copilot agent workflows in VS Code.

It should not be treated as a universal prompt standard across all AI tools:

- GitHub Copilot in VS Code: supported target for these files.
- ChatGPT or Codex outside that workflow: may still benefit from the content, but will not automatically load or obey `.agents/` conventions.
- Non-Copilot tooling: should treat this directory as project documentation unless an integration explicitly supports it.

If equivalent behavior is needed in another tool, copy or adapt the relevant guidance from `.agents/` into that tool's prompt or workflow configuration.

The canonical-action skill also has Codex UI metadata and can be copied into
the configured Codex skills directory for local discovery. Its repository copy
is the maintained source; installing it does not make all `.agents/` content
automatically active in other tools. The separate
[skill design](CANONICAL_ACTION_SKILL_DESIGN.md) and
[validation outcome](CANONICAL_ACTION_SKILL_OUTCOME.md) record its scope and
verification.

The scoped-overrides skill uses the same maintained-source/local-install
arrangement. Its [design](SCOPED_POLICY_OVERRIDES_SKILL_DESIGN.md) and
[outcome](SCOPED_POLICY_OVERRIDES_SKILL_OUTCOME.md) record the consumer boundaries
and independent behavioral evaluation.

The web-standards skill is also maintained in the repository and installed
locally with Codex metadata. Its [design](WEB_STANDARDS_SKILL_DESIGN.md) and
[outcome](WEB_STANDARDS_SKILL_OUTCOME.md) document applicable practice families,
source status, structural validation, and independent bounded evaluation.

## Repository Rules

- Keep `.agents/` content shareable and repo-safe.
- Do not store secrets, tokens, local absolute paths, or machine-specific setup in these files.
- Prefer durable guidance over personal prompt fragments.
- Treat updates like documentation changes: focused, reviewable, and scoped to actual workflow value.

## Local-Only Files

Generated local editor/runtime artifacts should not be committed.

Examples:

- `.eslintcache`
- transient local prompt experiments that are not meant to be shared

## Editor LSP Configuration

The repo includes `jsconfig.json` at the root for Vue/Volar + TypeScript language server support. This enables go-to-definition, autocomplete, and symbol search across the Vue client (`src/client/`).

### Vue LSP hybrid mode

opencode's built-in Vue LSP uses hybrid mode: Volar handles template/CSS, and the TypeScript language server handles `<script>` blocks. The project already has `typescript` as a dependency, so both should auto-start.

If Vue diagnostics don't appear in your editor, configure `vue_ls` with initialization options pointing to the TypeScript plugin. The `opencode.json` at the repo root includes this configuration. For other editors (Neovim, Helix, Zed), follow the Volar v3+ setup pattern: install both `typescript-language-server` and `@vue/language-server`, then pass the `@vue/typescript-plugin` location in `init_options.plugins`.

### Postgres LSP

The repo includes a `.gitignore`d `postgres-language-server.jsonc` config template. To use the Postgres Language Server for schema-aware SQL completions and migration linting:

1. Install the Postgres LSP (`npm install -D @postgres-language-server/cli` or via editor extension).
2. Copy or create `postgres-language-server.jsonc` in the repo root (run `postgres-language-server init`).
3. Update the `db` section with your local PostgreSQL connection details.
4. The LSP will provide completions against the live schema and lint migration files in `src/server/migrations/`.

## When To Update This Area

Update `.agents/` when:

- the repo adopts a new shared Copilot workflow
- frontend or testing guidance becomes stable enough to standardize
- a skill is repeatedly useful across sessions and should become team-visible

Do not update it just to preserve one-off prompts that are not expected to help future work.
