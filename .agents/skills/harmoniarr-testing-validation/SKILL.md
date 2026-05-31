---
name: harmoniarr-testing-validation
description: Use this skill when choosing, running, or explaining Harmoniarr validation for code changes. Trigger for test planning, deciding focused versus full validation, Vue/client changes, backend service or route changes, migrations, schema snapshots, Docker/local deployment checks, release evidence, CI failures, or any request to make a change with high confidence.
---

# Harmoniarr Testing Validation

## Default Approach

Run the smallest focused tests that prove the changed behavior, then broaden based on blast radius. Before commit or push, run the validation level appropriate to the risk.

Use PowerShell commands from the repository root.

## Validation Matrix

Client utility or composable:

- Focused: `node --test test/client/<matching>.test.js`
- Broader: `npm run test:client`
- Always add `npm run lint:client` for changed `src/client/**/*.js` or `*.vue`

Vue view or component:

- Focused unit tests when present.
- `npm run lint:client`
- `npm run build:client`
- Use `$webapp-testing` or `$web-design-reviewer` when layout, interaction, keyboard behavior, or responsive rendering matters.

Server service or store:

- Focused: `node --test test/server/<matching>.test.js`
- Broader: `npm run test:server`
- Add integration tests when behavior depends on real PostgreSQL state, route middleware, sessions, CSRF, operation queues, or cross-module wiring.

Route changes:

- Focused route tests in `test/server/*routes*.test.js`
- Add integration coverage for auth/session/CSRF/database-backed behavior when mocks cannot prove the contract.
- Check `src/server/route-inventory.js` when adding, removing, or changing API routes.

Migration or schema work:

- Run migration filename checks through `npm run migration:check`.
- Run schema snapshot checks through `npm run check:schema-snapshot` when the database/snapshot surface is touched.
- Run `npm run validate:schema-bootstrap` or `npm run validate:database` when bootstrap behavior matters.

Scripts or release tooling:

- Focused script tests in `test/scripts/`.
- `npm run lint:scripts`
- Run the script directly when it has observable CLI behavior.

Before commit for substantial work:

- `npm test`
- `npm run build`

Before high-risk release, Docker, or database changes:

- `npm run validate` when time and local prerequisites allow.
- Add the relevant Docker validation scripts from `package.json` only when the change affects packaging, image startup, Compose, or release evidence.

## Test Design

- Prefer tests at the module boundary that owns the behavior.
- Add route/integration tests when middleware, session freshness, CSRF, database transactions, operation-run visibility, or startup wiring are part of the contract.
- Keep test doubles small and explicit; inject dependencies into service factories rather than mocking global modules.
- Assert durable state and response shape, not implementation trivia.
- For UI state, test pure helpers and composables first; use browser checks when visual or interaction behavior cannot be proven otherwise.

## Failure Handling

When validation fails:

1. Read the first failing assertion or build error.
2. Reproduce the smallest failing command.
3. Patch the cause, not the test expectation, unless the expectation is stale because the contract intentionally changed.
4. Re-run the focused failing command.
5. Re-run the broader command that originally failed.

## Reporting

In final updates, report exact commands run and whether they passed. If a command could not run, state the concrete blocker and the remaining risk.
