# M3 signed packages and repository resolver

Implemented deterministic zip creation, strict archive/manifest budgets, exact-byte P-256 receipt verification, maintained Sigstore verification, GitHub release and equivalent OCI transport, public-address socket pinning, signed catalogue checks, CLI authoring/build/watch/doctor/inspect/pack/verify/publish, and protected keyless reference-package workflow.

Observed validation: package-verifier suite28/28 and authoring browser suite4/4 passed. Actual public release installation remains pending workflow publication and live receipt verification. Tests use synthetic signing identities; they do not establish publisher attestation.

Evidence: `evidence/package-verifier/summary.md`, retained raw outputs and browser reports. Full integrated final-commit validation is recorded separately in `evidence/VERIFICATION.md` when available.
