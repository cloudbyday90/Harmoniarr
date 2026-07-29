# Settings Backup and Restore Hierarchy

**Status:** Implemented on 2026-07-28

## Problem

`Settings > Backup & restore` previously displayed backup inventory, restore
preview and apply, maintenance locks, and diagnostics as equal-weight cards.
That made ordinary protection status harder to scan and placed destructive
restore controls beside routine refresh controls.

The recovery service already enforces the actual security boundary: recovery
routes are admin-only, mutations use CSRF protection and rate limits, restore
uses a compatibility preview and expected payload digest, maintenance locks
pause unsafe work, and backup mutations are audited. Browser presentation must
not become an authorization decision.

## Research

Official sources were checked on 2026-07-28 against the requested June 2026
baseline.

| Source | Applied guidance |
| --- | --- |
| [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final) | Treat backup and restoration as a tested continuity process with clear recovery priorities, rather than assuming a file alone proves recoverability. |
| [OWASP Database Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html) | Treat backups as protected data, using restricted access and encryption where available. |
| [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) | Test and audit backup and restore procedures; protect encrypted backup material and the keys needed to recover it. |
| [W3C ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Use semantic disclosure controls for optional task detail, preserving keyboard operation and expanded-state semantics. |

## Options

### Keep four equal-weight recovery cards

Pros: every control is immediately visible.

Cons: ordinary backup status competes with destructive restore and specialist
diagnostics; an operator must scan more than is needed for routine use.

### Hide all recovery controls behind a single advanced boundary

Pros: very compact initial page.

Cons: missing backup protection and an active maintenance lock can be missed;
one large hidden panel recreates the original cognitive load after opening.

### Recovery posture followed by separate tasks

Pros: makes missing, unencrypted, unavailable, and maintenance-blocked states
clear first; keeps restore confirmation contextual; retains deep links and all
specialist capability without treating every operator as a recovery expert.

Cons: backup history, restore, maintenance, or diagnostics each take one
explicit click when needed.

## Final Recommendation Stack

1. Lead with server-reported **Recovery status**, showing missing inventory,
   unavailable reads, encryption posture, selected restore checks, and active
   maintenance as distinct states. Do not claim that browser state alone makes
   recovery safe.
2. Keep **Create backup** and **Refresh status** visible. Creating a backup is
   the frequent protective action and should not be buried.
3. Place history selection in **Review backup history** and open **Restore a
   backup** only for an explicit selection or a direct restore deep link.
4. Keep restore compatibility, acknowledgement, digest-bound apply, and the
   durable operation-run handoff together. Put download and permanent delete
   under a clearly named file-actions disclosure.
5. Surface active maintenance in the status summary, while placing lock release
   and full queue/audit detail in separate maintenance and diagnostics tasks.
6. Preserve admin authorization, CSRF, rate limiting, compatibility checks,
   integrity expectations, server-held encryption material, maintenance locks,
   and audit events. This work changes presentation only.

## Implementation

- Added the ESM-only `settings-recovery-presentation.js` pure helper. It turns
  bounded server responses into explicit status copy and does not authorize
  restore or infer recovery safety from browser state.
- Reworked `RecoveryWorkspaceView.vue` into one Recovery status card and four
  named task disclosures: backup history, restore, recovery maintenance, and
  recovery diagnostics.
- Restore detail remains mounted once opened, preserving confirmation state and
  deep-link behavior. Active maintenance automatically opens its task so a
  blocking state is not silently hidden.

## Verification

- Unit coverage exercises loading, failed inventory, absent backup, unencrypted
  backup, encrypted/ready backup, and active-maintenance posture states.
- Source-contract coverage asserts the posture and task boundaries.
- Browser verification opens each recovery task from the Settings route and
  checks for page errors.
- Full repository tests, ESM checks, client build, and no-cache local Docker
  walkthrough rebuild are required before completion.

## Next High-Value Item

Refine the **Settings setup overview** into a compact readiness summary that
keeps the required connection and media-folder actions visible while making
optional provider and advanced configuration status scannable rather than
card-heavy.
