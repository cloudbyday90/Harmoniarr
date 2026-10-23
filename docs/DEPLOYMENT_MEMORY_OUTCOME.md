# Deployment memory qualification outcome

Completed October 22, 2026 on `main`, following the sizing item in the
[aggregate outcome](ARTWORK_AGGREGATE_OUTCOME.md). See separate
[design and reproducible command](DEPLOYMENT_MEMORY_DESIGN.md),
[official research/tradeoffs](DEPLOYMENT_MEMORY_RESEARCH.md) and
[local Docker outcome](LOCAL_DOCKER_DEPLOYMENT_MEMORY_OUTCOME.md).

## Delivered lane

`npm run validate:native-deployment-memory` runs three explicit scenarios inside
one newly owned instance of the existing image, with embedded PostgreSQL. Fresh
containers qualified both **2 GiB and 3 GiB**, two CPUs, 256 PIDs, no additional
swap, read-only root, UID 1000, no external network and no published ports. App/
database storage is disposable tmpfs; only validated source/fixture inputs are
mounted read-only. The existing app/data is never the qualification target.

The actual application is composed in the measured Node process. Actual artwork
fetch/ingestion, default limited child, filesystem publication, asset/assignment
stores, quota/backoff stores and PostgreSQL execute. Provider metadata is fixed;
image bytes cross real loopback TLS with normal certificate verification and a
fixture-only CA/destination. This does not establish live-provider metadata
acceptance. Periodic workers, HTTP serving, unrelated media work and a populated
production catalogue are outside this lane.

Each case holds two native materialized-sort statements at a PostgreSQL-observed
advisory lock while artwork runs. Each sorts 100,000 rows with local 8 MiB work
memory and parallel workers disabled. Saved rows, file/row hashes, retained caller
buffers, child close and zero final reservations are checked. Reverse lock
acquisition is covered by a separate controlled cleanup test: whichever statement
acquires first can roll back immediately, rather than waiting in submission order.

PostgreSQL was **18.6** with actual default shared buffers **128 MiB**, default
work memory **4 MiB**, hash multiplier **2**, max connections **100** and app pool
maximum **10**. These defaults do not mean every connection uses 4 MiB total.
Only two controlled sort statements were qualified, not ten or 100 concurrent
application queries. The sorting work is synthetic database pressure, not a
measured production library query mix.

## Recorded measurements

All values below are MiB, rounded to one decimal. This host uses **cgroup v1**:
the sampled usage counter is approximate. The reported kernel peak is its
lifetime maximum **through that scenario's settlement**, including initialization,
schema preparation, fixture generation and preceding scenarios. In particular,
the maximum-byte row inherits the preceding maximum-pixel peak. It is not that
row's incremental memory cost. Counters are read separately and are not an atomic
decomposition.

| Container limit | Scenario | Sampled container usage peak | Kernel lifetime peak through settlement | Node RSS sample peak |
| --- | --- | ---: | ---: | ---: |
| 3 GiB | Two 1024² solid JPEGs + 64 MiB caller buffer | 362.9 | 363.7 | 197.8 |
| 3 GiB | Two 8192² solid JPEGs + 256 MiB caller buffer | 1313.1 | 1315.8 | 401.1 |
| 3 GiB | One 100 MiB PNG download + 256 MiB caller buffer | 873.4 | 1315.8 | 631.1 |
| 2 GiB | Two 1024² solid JPEGs + 64 MiB caller buffer | 358.6 | 360.2 | 194.3 |
| 2 GiB | Two 8192² solid JPEGs + 256 MiB caller buffer | 1318.2 | 1326.0 | 397.2 |
| 2 GiB | One 100 MiB PNG download + 256 MiB caller buffer | 893.9 | 1326.0 | 623.0 |

Both profiles retained the **2 GiB logical artwork budget**. Ordinary work reached
two children; maximum-pixel work reached one and retained the first reservation
through held publication while the second job waited. Maximum-byte work used one
provider request/child, not two concurrent maximum-byte inputs. All five saved
assignments per profile were verified; maximum-pixel and maximum-byte output
hashes match the previously qualified native fixtures. Every case ended with zero
active/queued/reserved work. Kernel limit-hit and OOM-kill counters did not increase.
The v1 OOM-event count is unavailable and recorded as null, not zero.

The recorded lifetime peaks leave approximately **1756 MiB** in the 3 GiB profile
and **722 MiB** in the 2 GiB profile through scenario settlement. This is headroom
for these executions, not reserved capacity or a general deployment minimum.
Tmpfs data is charged memory and differs from production bind-mount I/O/cache
behavior. Solid JPEGs and a padded maximum-byte PNG do not model every entropy/
sample-depth combination. No forced GC or kernel peak reset was used.

## Validation and publication scope

- **9 focused tests passed**: six new parser/sampling/retirement cases and three
  existing runtime-resource service/monitor cases. Sampling reads cannot overlap
  or build a backlog; missing/invalid counters fail, late checkpoints are revoked
  and original Error/null survives cleanup.
- **Three native cases passed in each final profile** against rebuilt image
  `sha256:d79580498e265a0e74f3330bf48e03210b14fec5538ea220dbf03f754ca62ac3`.
  Earlier three-case controls also passed in both profiles against the preceding
  image. Repeated cases overlap and are not unique tests to sum.
- Scoped lint, Node baseline, copyright, ESM consistency and repository test
  hygiene passed. Both updated project skills passed the skill-creator validator;
  their practical scenarios cover v1/v2 interpretation, overlapping counters,
  missing measurements, reversed lock ownership and unmeasured worker scope.
- Six new JavaScript files were frozen with 3,338 source files, fingerprint
  `a6a885519f99a9c110a7e1c03d20bd9c2e1c9c80bf6ba1af0c44c5d5c9184eb8`.
  Exact runtime comparison confirmed all 901 server files, 11 shared files,
  155 client artifacts, Node binary, 110 production npm versions and 151 APK
  versions unchanged. Root package metadata adds only the explicit test command;
  the lockfile and version are unchanged.

No production runtime code changed, so unrelated full server/client/script,
browser and PostgreSQL matrices were not repeated. The owning native cases use
real embedded PostgreSQL and actual locks/rollback. Early fixture failures for a
v2-only assumption, missing public test VAPID material and a UUID assertion cast
were corrected; their private logs and retirement evidence remain available.

GitHub MCP found **no open PRs** at selection and again before publication. There
was no applicable random PR or stale open PR to implement, rebase or close. No PR
was merged. Work stays on `main`; no release, tag or version bump is created.

## Recommendation and next item

Keep the existing FIFO/count/byte/deadline controls, 2 GiB logical reservations and
actual per-child DATA limit. Use container accounting alongside separate process
and reservation evidence. The 3 GiB qualification profile has more observed
headroom; the passing 2 GiB subset does not justify declaring 2 GiB sufficient for
all deployments or lowering the child limit. Do not add automatic tuning or an
operator memory slider from this dataset.

**Next:** qualify concurrent library scanning and actual media inspection/
transcoding against this same shared-container envelope, with real worker
ownership and a representative catalogue. Those unmeasured owners, query
concurrency and storage behavior must inform a deployment sizing recommendation
before changing built-in limits or exposing memory configuration.
