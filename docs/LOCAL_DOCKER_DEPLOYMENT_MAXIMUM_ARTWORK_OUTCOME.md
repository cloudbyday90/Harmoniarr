# Maximum artwork local Docker outcome

October 24, 2026. Followed the applicable preserved-state rebuild/start/bootstrap
and readiness steps in [the walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
The separate [implementation outcome](DEPLOYMENT_MAXIMUM_ARTWORK_OUTCOME.md)
records maximum-case findings and the next memory-management investigation.

## Rebuild and preserved state

Built with pull and no cache through an isolated Docker buildx builder, loaded
`harmoniarr:walkthrough-local`, then removed the builder and verified its absence.
The immutable image changed from
`sha256:7e406c535cd2e1ba4d8cce150e6fd662b4bb40de105ddba5e0f131f164c33122`
to
`sha256:2b0916878bff76af08e823a1d5e27953ded4d8a2fba5fdbd463667c43286f0ba`.

Recreated the walkthrough service with `up -d --wait --no-build`, then ran the
documented disposable bootstrap helper with `--rm --no-deps`. It confirmed the
existing administrator; the helper retired. All five actual bind sources,
destinations and read/write flags match their pre-build values. Existing data,
administrator and saved configuration were preserved. Reset and optional managed
provider/release rehearsals were not applicable to this rebuild.

The app is healthy at `http://127.0.0.1:47956`, with loopback-only publication,
read-only root and UID 1000. Authenticated readiness passed using a temporary
password-only file; the file and its directory were removed. Startup applied zero
migrations and verified 115 applied, zero pending.

## Runtime identity and validation scope

Node 24.22.1, npm 12.0.2, PostgreSQL 18.6, Sharp 0.35.5/libvips 8.18.7 and FFmpeg
8.0.1 remain unchanged. Before/after inventories verify byte-identical 933 server,
11 shared and 155 client artifacts, plus unchanged 110 npm and 151 OS packages.
Root metadata matches source; package.json adds only the explicit native alias.
No production module or dependency change is packaged in this task.

Fresh maximum and affected regression containers use this immutable image with
verified matching source mounts. They expose no ports, use network none and
disposable tmpfs data, and are removed after actual completion. The normal
walkthrough app remains running. See the implementation outcome for final native
results, historical evidence retention and the limits of the containment proof.

No release, tag, version change, PR merge or deployment to an external environment.
