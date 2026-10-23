# Controlled provider authority research

Official sources discovered and opened through connected MCP search on 2026-10-23. This is an application of the guidance to a specific fixture failure, not certification.

## Sources and application

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), living guidance: deny by default, validate authorization at the action boundary and test business authorization rules. Our inference: repair saved fixture ownership rather than weakening the execution guard; prove refusal after the accepted state changes.
- [NIST SP 800-162](https://csrc.nist.gov/pubs/sp/800/162/upd2/final), January 2014 with August 2019 updates: authorization considers subjects, objects, actions, relationships and sometimes environment. Our inference: an administrator role alone does not supply wanted-release ownership, current recipient eligibility or saved quality consent.
- [W3C PROV Model Primer](https://www.w3.org/TR/prov-primer/), Working Group Note, 30 April 2013: provenance records agents, entities and activities involved in producing data. Our inference: distinguish controlled metadata/monitoring inputs, derived wanted/discovery state, ingested candidates and actual execution evidence. We do not implement a PROV interchange format or claim W3C conformance.

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Saved monitoring plus canonical reconciliation | Matches current application ownership; worker rechecks remain meaningful; covers single/shared recipients | More setup work and dependence on real domain services | Adopt |
| Manually patch wanted/link/candidate ownership rows | Small local edit | Can bypass derivation, hide missing inputs and drift on worker reconciliation | Reject for positive pipeline qualification |
| Relax or stub the acquisition guard | Makes a fixture progress | Removes the security property being qualified | Reject |
| Persist exhausted scoped recovery in its owning transaction | Existing projection/restart works; stop, history, reputation and episode roll back together | Adds one guarded write and holds existing transaction locks slightly longer | Adopt |
| Set exhaustion after the recovery transaction or only in fixture SQL | Easy local workaround | Can leave partial history/state and conceal the runtime composition gap | Reject |

## Recommended stack

1. Small ESM metadata-input and authority-fixture modules.
2. Saved enabled operators and monitored-artist policies.
3. Actual wanted/discovery reconciliation and exact derived-recipient assertions.
4. Actual client/ingestion/worker execution with current production guards.
5. Paired permitted/refused scenarios, bounded provider counters and file checks, then acknowledged fixture cleanup.
6. Existing scoped recovery transaction plus a small exhaustion store; retain current source identity, recipient checks, replay and future reservations.
7. Focused driver/evidence checks, affected shared PostgreSQL cohort, one full fast gate and immutable packaged pipeline/file-backed qualification. Compare exact runtime bytes before retaining unrelated memory qualification.

No open PR was returned by GitHub MCP at initial selection. Recheck before publication; implement an applicable open PR locally only if one becomes available.
