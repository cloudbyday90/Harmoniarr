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

## Tooling Scope

`.agents/` is intended for GitHub Copilot agent workflows in VS Code.

It should not be treated as a universal prompt standard across all AI tools:

- GitHub Copilot in VS Code: supported target for these files.
- ChatGPT or Codex outside that workflow: may still benefit from the content, but will not automatically load or obey `.agents/` conventions.
- Non-Copilot tooling: should treat this directory as project documentation unless an integration explicitly supports it.

If equivalent behavior is needed in another tool, copy or adapt the relevant guidance from `.agents/` into that tool's prompt or workflow configuration.

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

## When To Update This Area

Update `.agents/` when:

- the repo adopts a new shared Copilot workflow
- frontend or testing guidance becomes stable enough to standardize
- a skill is repeatedly useful across sessions and should become team-visible

Do not update it just to preserve one-off prompts that are not expected to help future work.