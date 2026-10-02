# Signed revocation enforcement

Observed on 2026-10-01 against source based on commit `2364a6813c2319b604bab76beff448aa3c26bab7`
with uncommitted changes in this slice. Windows x64, pinned Node 24.19.0. The seven new Node
checks passed; the complete unit/production/integration/hostile run passed all 240 cases with
zero failures, retries or skips. Dependency-boundary lint passed. Whole-workspace TypeScript
at that point reported the shell agent's in-progress nullable database expression, so this
record does not claim a final clean-source typecheck or final browser verification.

The verifier now validates signed-catalogue policy projections and refuses revoked archive
digests, older receipt sequences, future-issued metadata and expired metadata. Registry
options can be read after asynchronous resolution. Fixture loading accepts the same policy.
The controller checks policy at admission and again immediately before its durable install
commit; a previously known policy cannot disappear through an undefined getter.

The runtime independently checks policy during signed registration, after asynchronous guest
preparation and during resolution. Its policy source re-verifies persisted exact signed bytes
and signature after restart, retains expired metadata, rejects lower sequences and conflicting
same-sequence revocations, and serializes concurrent refreshes. Removing configured files
retains known metadata; removing configuration for a runtime that already recorded metadata
requires operator correction instead of silently restoring an unknown state.

Local receipt issuance uses the authenticated current sequence/revocations and checks again
after cryptographic proof verification. A runtime that has never had trusted catalogue metadata
reports `unknown` through authenticated `GET /v1/catalogue/policy`. The receipt schema's initial
sequence zero in that state provides no claim of revocation freshness. Existing local editing
remains available; new admissions against known expired or revoked metadata fail closed.

Runtime configuration:

```text
PWACLOUD_CATALOGUE=<path to exact signed catalogue JSON>
PWACLOUD_CATALOGUE_SIGNATURE=<path to raw P256 signature>
PWACLOUD_CATALOGUE_TRUST_ROOTS=<optional explicit public root JSON>
```

When catalogue trust roots are omitted, explicitly configured package roots are used. Demo
mode uses `artifacts/packages/catalogue.json` and `.sig`; personal mode has no demo catalogue
or demo package-root default. Personal catalogue roots reject demo authority.

The new tests use actual P256 signatures with explicitly synthetic test authority, the real
runtime server/SQLite, and an actual Rust Component Model artifact for the preparation race.
The preparation callback is deliberately blocked for the race; that callback itself is not
represented as a real Jco transformation or a live Sigstore release. Separate existing runtime
loader tests execute the actual transformation. Browser/controller IndexedDB checks and the
final public-release rerun are coordinated by their owners and are not claimed here.

Retained outputs:

- `revocation-boundary-tests.txt`: 7 passed, SHA-256 `5134d78d641fd2f0b810c85b0c5a79eda4995f10b48fa5b6b7ed2f0e07c97098`.
- `revocation-full-node-regression.txt`: 240 passed, SHA-256 `0eb636d3c50bbb76acb1daaadc1c7ebaa7ab1e2c0f96df24c909f35e00f35752`.

Commands were `pnpm exec tsx --test tests/production/package-revocation.test.ts tests/integration/package-revocation.test.ts`
and `pnpm exec tsx --test tests/unit/*.test.ts tests/production/*.test.ts tests/integration/*.test.ts tests/hostile/*.test.ts`.
