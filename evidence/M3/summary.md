# M3 signed packages and repository resolver

Implemented deterministic zip creation, strict archive/manifest budgets, exact-byte P-256 receipt verification, maintained Sigstore verification, GitHub release and equivalent OCI transport, public-address socket pinning, signed catalogue checks, CLI authoring/build/watch/doctor/inspect/pack/verify/publish, and protected keyless reference-package workflow.

Observed validation: package-verifier suite28/28 and authoring browser suite4/4 passed. Actual public release installation remains pending workflow publication and live receipt verification. Tests use synthetic signing identities; they do not establish publisher attestation.

Evidence: `evidence/package-verifier/summary.md`, retained raw outputs and browser reports. Full integrated final-commit validation is recorded separately in `evidence/VERIFICATION.md` when available.

## Integrated qualification records

Historical slice results above retain their original scope. The complete baseline2364a6813c2319b604bab76beff448aa3c26bab7 passed188 unit,25 integration,20 hostile and56 browser checks locally and in clean Ubuntu Actions run36943590577. Later offline/revocation additions must match their own production build and run. Current source commit, command exit codes and full outputs are recorded centrally in `evidence/M10/local-verification.json`, `ci-current.json` after capture, `verify-all-final-output.txt`, `evidence/browser-results.json`, and `evidence/VERIFICATION.md`. All57 exact contracts and remaining external gates are mapped in `evidence/ACCEPTANCE-DISPOSITION.md`. No historical result certifies later edits.
