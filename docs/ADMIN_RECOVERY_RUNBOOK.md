# Harmoniarr Bootstrap-Admin Recovery Runbook

## Purpose

This document describes the intended operator runbook for emergency bootstrap-admin recovery in Harmoniarr.

It is a planning and operations document, not an implementation spec. The lower-level mechanics and API contracts live in `docs/BACKUP_RESTORE_DESIGN.md`, and the posture requirements live in `docs/SECURITY_POLICY.md`.

## When To Use This Runbook

Use this runbook only when:

- Harmoniarr already has at least one user account
- no usable admin path remains
- the operator still has local control of the container or runtime host

Do not use this runbook for normal first-run setup. If no users exist, use the ordinary setup-account flow.

## Preconditions

Before starting recovery, confirm all of the following:

- the operator has direct local access to the Harmoniarr runtime
- the operator can run `harmoniarrctl` inside the container or packaged runtime
- the app database is reachable
- no restore or upgrade operation is currently in progress

Recovery should fail closed if these conditions are not true.

## Recovery Principles

- Recovery is an emergency path, not a convenience password reset.
- Local CLI arming is required; remote HTTP alone must not arm recovery.
- The one-time recovery code is printed once and must be handled like a secret.
- Recovery completion does not auto-login the operator.
- Successful recovery forces fresh login and revokes interactive session state.

## Docker Runbook

### Step 1: Check Current Recovery State

Run:

```text
docker exec harmoniarr harmoniarrctl recovery bootstrap-admin-status
```

Expected result:

- If no recovery run is armed, continue to Step 2.
- If a recovery run is already armed, decide whether to reuse it, wait for expiry, or cancel and replace it.

### Step 2: Arm Bootstrap-Admin Recovery

Run:

```text
docker exec harmoniarr harmoniarrctl recovery arm-bootstrap-admin --reason "operator lockout"
```

Expected result:

- Harmoniarr prints a one-time recovery code exactly once.
- Harmoniarr prints the expiry time.
- Harmoniarr indicates the recovery page path.

Operator action:

- store the recovery code temporarily in a safe place
- do not paste it into chat, logs, tickets, or shell history notes

### Step 3: Complete Recovery In The Browser

Open the recovery page:

```text
/recover/bootstrap-admin
```

Enter:

- the one-time recovery code
- the recovered or replacement admin username
- a new password
- password confirmation

Expected result:

- Harmoniarr validates the code
- Harmoniarr acquires the `admin_recovery` lock
- Harmoniarr creates or re-enables exactly one admin path
- Harmoniarr revokes interactive browser sessions and refresh-token-backed sessions
- Harmoniarr redirects to the ordinary login screen

### Step 4: Perform Fresh Login

Log in normally using the recovered credentials.

Expected result:

- no session is inherited from the recovery flow
- login is a normal auth path with fresh session issuance

### Step 5: Complete Post-Recovery Review

After login, the operator should complete the recovery checklist:

- confirm admin access works
- review all admin accounts
- disable or remove unexpected admin paths
- rotate or revoke API keys if compromise is suspected
- review provider settings and backup settings
- clear recovery banners only after review is complete

## Non-Docker Packaged Runtime Runbook

The same recovery logic should be available in non-container distributions.

Equivalent pattern:

```text
harmoniarrctl recovery bootstrap-admin-status
harmoniarrctl recovery arm-bootstrap-admin --reason "operator lockout"
harmoniarrctl recovery cancel-bootstrap-admin --reason "stale recovery run"
```

The surrounding wrapper can vary by installer or platform, but it should still route through the same `harmoniarrctl` recovery implementation.

## Cancellation And Replacement

To cancel an armed run:

```text
docker exec harmoniarr harmoniarrctl recovery cancel-bootstrap-admin --reason "operator requested cancel" --force
```

Use cancellation when:

- the recovery code may have been exposed
- the wrong operator armed the run
- a stale run should be replaced before expiry

## Expected Failure Cases

### Recovery Already Armed

Symptom:

- arming returns a conflict and refuses to create a second active run

Operator action:

- inspect status
- cancel with `--force` if appropriate
- otherwise wait for expiry

### Conflicting Maintenance Lock

Symptom:

- recovery completion reports that restore or upgrade activity blocks recovery

Operator action:

- stop the conflicting operation first
- confirm the conflicting restore or upgrade flow is fully cleared
- re-arm if the original code expires

### Database Unavailable

Symptom:

- local CLI fails before arming or status cannot be read

Operator action:

- treat this as a broader runtime or database outage
- restore database availability before using bootstrap-admin recovery

### Recovery Code Expired

Symptom:

- completion returns invalid or expired recovery state

Operator action:

- arm a new run locally
- do not try to reuse the old code

### Too Many Invalid Attempts

Symptom:

- completion route returns rate-limited or threshold-reached behavior

Operator action:

- assume the run is no longer trustworthy
- inspect logs and audit events
- arm a new run locally if recovery is still required

## Audit Expectations

The following events should exist for the recovery lifecycle:

- recovery armed
- recovery cancelled
- recovery expired
- recovery invalidated
- recovery completed
- interactive sessions revoked after recovery

These events should be visible to the operator after login for review and later incident analysis.

## What Operators Should Not Do

- Do not use bootstrap-admin recovery as the normal admin-password workflow.
- Do not share the one-time recovery code through insecure channels.
- Do not leave an armed recovery run active longer than needed.
- Do not assume recovery is complete until fresh login succeeds.
- Do not skip admin-account and API-key review after recovery.

## Related Documents

- `docs/BACKUP_RESTORE_DESIGN.md`
- `docs/SECURITY_POLICY.md`
- `docs/DATABASE_MODEL.md`