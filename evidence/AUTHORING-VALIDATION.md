# Authoring validation results

Validated: **2026-10-01T20:53:47Z**. These checks cover this handoff, **not a completed PWA**.

## Executed checks

| Check | Result | Evidence |
|---|---|---|
| Node reference unit tests | 135/135 passed; 0 failed; 0 skipped | `evidence/authoring/reference-tests.tap` |
| Strict TypeScript reference compilation check | Exit 0 | `evidence/authoring/typecheck.log` (empty because no diagnostics) |
| Structural, cross-reference and SQLite constraint audit | 347 checks passed | `evidence/authoring/structural-audit.json` |
| JSON Schema and semantic fixtures | 49 checks passed across 5 schemas and 3 plugin manifests | `evidence/authoring/contract-validation.json` |
| Pending release-evidence gate | Correctly rejected incomplete evidence, exit 1 | `evidence/authoring/release-gate.log` |
| Publication helper | Dry run exit 0 and syntax check exit 0 | `evidence/authoring/publication-dry-run.log` |

The reference tests include real WebCrypto SHA-256 and ECDSA P-256 operations with generated test keys,
URL/grant checks, lifecycle action selection, model-catalog/request shaping, chunked UTF-8/SSE parsing,
request admission, and evidence-gate rejection. Test identities, models, report rows and signing keys
are fixtures, not real provider accounts or publisher proofs. SQLite constraints execute in memory.

The structural audit's own redirected-output scan was corrected during authoring and the final audit
was rerun successfully. This does not change any product milestone from pending to passed.

## Actual environment

Node v22.16.0; Version 5.8.3; Python 3.13.5.
The schema validator was jsonschema 4.26.0. Environment: Linux-6.18.44-x86_64-with-glibc2.41.
These versions describe the authoring harness, not the production version recommendation.

## Not executed or not available

No complete PWA, real iframe/Worker browser integration, Rust/WIT/Jco guest compilation, actual ZIP
loader, real GitHub release install, Cosign publisher verification, physical iPhone/Android test,
real OAuth sign-in, real ChatGPT inference, hosted integration, deployed service, or GitHub Actions
run was executed. The product's 57 acceptance cases remain pending in the implementation ledger.
The WIT and OpenAPI files are implementation contracts, not claims of working guest/runtime services.

GitHub account identity was read as StevenBuglione. The repository probe returned 404; this is not
proof of global name availability. The connected tools exposed reads, and this container had no
authenticated gh CLI or configured GitHub write token. No remote repository, branch, issue, commit,
release or deployment was created. Use the publication helper from an authorized environment.

The release gate is deliberately blocked. It must not be bypassed to make a screenshot or demo look done.
