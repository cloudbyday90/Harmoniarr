# Verified operator track requirements

October 12, 2026, America/New_York. Continues
[track consent](OPERATOR_TRACK_CONSENT_OUTCOME.md).

## Selected correction

Saved resolved state is not catalog membership. Resolve acquisition exceptions
against current local release/medium/track/recording identities, and capture that
catalog with the publication source. This catalog has recording MBIDs and
positions, but no MusicBrainz track MBIDs. An unsupported track-MBID override
cannot grant consent by falling back to a different identity; retain it for review.
Recording plus medium/track position must identify exactly one current track.
Bound edition and group-scoped contracts remain distinct. Descriptive counts
remain separate from verified grants.

Represent explicit partial or track-derived intent with a versioned
`operatorTrackScope` containing target release and exact current track identities.
Persist the requirement in request and owner-specific Wanted evidence. Propagate
it through discovery participants and candidate context. No sibling's requirement
can be dropped or treated as another owner's consent. Invalid requirements refuse
publication; supported requirements covering the entire verified catalog retain
whole-release acquisition. Proper subsets remain blocked at release-wide search,
selection and download/import verification boundaries until exact file filtering
and verification are implemented. This round delivers that conservative boundary,
not an unproven partial-download feature. Existing independent full-release
policy/manual consent and acquired media remain unchanged.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Trust remap flags or title similarity | Cheap, current behavior | Unknown identity and partial intent can authorize whole-release work | Reject |
| Immediately add track-MBID schema and fuzzy partial downloads | Broader feature | Catalog migration, remapping and verified file/import contracts require additional evidence | Defer |
| Current-catalog proof plus typed requirements and conservative downstream refusal | Stops silent scope expansion; retains verified whole-release path; narrow ESM owners | Subset work waits for exact filtering; one additional internal catalog read and cooperative writer enrollment | Select |

Use saved owner intent → current catalog proof → typed track scope → guarded
atomic request/event and Wanted owner → current shared participant requirements
→ conservative search/selection/pre-provider/import gates → actual drainage.
Keep existing actor/acquisition locks, cancellation and quality floors. Enroll
standalone medium/recording/track replacement writers in existing exclusive source
admission so catalog phantoms cannot change the proof through supported APIs.
Privileged SQL remains outside cooperative coordination.

## Evidence and scope

Reproduce unknown identity and partial-to-whole publication through native saved
flows. Prove valid recording/position matches, ambiguous/missing/other-edition and
unsupported track MBIDs, mutations after planning, exact target comparison,
typed per-owner persistence, mixed participants and no provider call for subsets.
Backstop legacy candidates against current participant requirements before
download or library-add verification. Preserve Error/null drainage and owned
transaction clients. Use one stable complete fast gate and a serial affected
native cohort, recording red diagnostics separately. No release, tag, branch,
merge or Docker deployment is part of this round.
