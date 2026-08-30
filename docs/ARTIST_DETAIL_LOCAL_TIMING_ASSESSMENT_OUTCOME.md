# Artist Detail Local Timing Assessment Outcome

Status: Implemented
Date: 2026-08-30

## Outcome

The local Artist Detail timing workflow now has a read-only, offline
assessment command. It turns a strictly validated single or repeated capture
into one conservative next action while remaining local, identity-free, and
separate from normal product UI and cache behavior.

The assessment gives priority to a missing Discography region, then a
persistently loading region, then route variation, then consistent provider
fallback. Only ready local-projection evidence recommends reproducing the
reported account and artist before any cache change. This prevents a healthy
walkthrough capture from being misread as a reason to alter SWR.

## Implementation

- `scripts/artist-detail-local-timing-assessment.js` is the pure ESM decision
  module. It reuses the existing strict single-or-batch artifact validation,
  returns only fixed labels, and renders fixed operator guidance without
  interpolating evidence values.
- `scripts/assess-artist-detail-local-timing.js` is the small ESM CLI. It
  accepts only a workspace-local `--evidence-path`, parses valid JSON, and
  normalizes read failures without exposing a filesystem error. It verifies the
  canonical path, so an in-workspace symlink cannot make the reader access an
  artifact outside the repository.
- `package.json` adds `npm run assess:artist-detail-local-timing`.
- `test/scripts/artist-detail-local-timing-assessment.test.js` proves each
  action branch, action precedence, bounded output, strict artifact
  validation, lexical and canonical workspace confinement, malformed JSON
  handling, and redacted read failures.

## Security and accessibility outcome

The command has no browser, cookie, credential, provider, database, network,
or write capability. It validates the evidence before assessment and prints
only fixed prose, so it cannot disclose fields the timing contract excludes.
The product's existing semantic `role=status` and `aria-busy` lifecycle remains
the accessible in-app loading communication; the command does not add a
second, chatty live region or move focus.

## Verification

Passed on 2026-08-30:

- `node --test test/scripts/artist-detail-local-timing-assessment.test.js`
- `npm run lint:scripts`
- `npm run lint:test`
- `npm run assess:artist-detail-local-timing -- -- --evidence-path .tmp/artist-detail-timing-assessment-cli.json`
  against a disposable schema-valid local artifact; it returned the expected
  ready/local-projection reproduction guidance.

Complete repository and security validation evidence is recorded with the
implementation commit.

## Next recommended item

Run the existing three-sample capture for the affected account and artist,
then assess its workspace-local artifact. Follow the returned action only; if
it reports a repeated loading or availability failure, add the smallest
regression beside that confirmed client boundary before changing cache or SWR.
