# Package and distribution implementation slice

Observed on 2026-10-01, Windows x64, Node 24.19.0, pnpm 11.19.0. This slice was run against the
working tree; final matching-commit release acceptance is recorded by the integration owner.

Implemented production TypeScript modules: strict deterministic ZIP packing and structure checks,
bounded incremental decompression, exact-byte ECDSA P-256 envelope/receipt verification, explicit
trust-root parsing, compatibility and digest checks, expiry/revocation/publisher binding, retained
exact package packets, GitHub release/tag resolution, pinned-digest OCI transport, public DNS and
actual TLS peer checks, signed catalogue filtering, dependency graph resolution and persistent
provider/digest locks, CLI authoring/build/pack/inspect/verify/doctor/publish dispatch, CycloneDX/npm/
Cargo inventory generation, and the separate protected keyless release workflow.

Commands and observed exit codes:

| Command | Exit | Observed result |
| --- | --- | --- |
| `tsx --test tests/production/package.test.ts tests/hostile/package.test.ts tests/integration/package.test.ts` | 0 | 28 passed, 0 failed, 0 skipped; raw `test-output.txt` |
| `playwright test -c artifacts/package-browser.config.ts package.spec.ts` | 0 | 4 passed across Chromium and WebKit at 360 CSS pixels; `browser-output.txt`, machine-path-redacted `browser-results.json`, and four `scaffold-*.png` captures |
| `tsx scripts/build-packages.ts` | 0 | All three demo packages built; raw `build-output.txt` |
| `tsx scripts/build-packages.ts --release` | 0 | All three unsigned source-built reference archives/envelopes built; raw `release-build-output.txt` |
| `tsc --noEmit` | 0 | Observed whole-tree typecheck passed before concurrent task UI edits; final matching-tree check is owned by integration |
| `tsc --noEmit` during concurrent task UI work | 1 | Incomplete shell/task UI contained unused symbols; `typecheck-concurrent-failure.txt`; reported to its owner for final verification |
| `tsx scripts/lint.ts` | 0 | TypeScript source and dependency boundary lint passed |
| `cargo metadata --locked --format-version 1 --manifest-path examples/guest/Cargo.toml` | 0 | Actual locked Rust dependency metadata |
| `tsx packages/cli/src/sbom-main.ts <pnpm-tree> <output> <license-inventory> <cargo-metadata>` | 0 | 464 components, including 34 Cargo components in the measured local inventory |
| Official CycloneDX 1.6 schema validation of that generated SBOM using Ajv | 0 | Generated fields valid; optional IRI/email format definitions absent from output were not installed in this one-off validator |
| `secureFetch` live request to the official GitHub API | 0 | HTTP 200, 11,654 bytes; actual public TLS peer guard executed |
| `secureFetch` official Cosign checksum asset restricted to the initial GitHub origin | 0 | Its real external release-asset redirect rejected with `blocked-destination` |

Failures retained and corrected: the first test run had three CLI failures (`first-run.txt`, machine
paths redacted; original retained privately under ignored `artifacts/private-evidence/package-verifier`): a scaffold
directory did not satisfy the authoritative manifest schema and one assertion matched presentation
text rather than the explicit error code. The scaffold and assertion were corrected. A separate
decompression regression now checks a dishonest output length even when the attacker supplies the
CRC for the truncated prefix. The initial live HTTPS smoke exposed Node 24's automatic family-selection
lookup callback shape; a typed dedicated Agent now pins one address and disables automatic family
selection. Dependency fixtures initially used a non-normative object form; the resolver and tests now
validate the actual `requires: string[]` schema. The SBOM converter was corrected to consume pnpm's
actual `from` leaf naming rather than inventing a `name` field. A public redirect-to-private smoke
endpoint returned 403, so that attempted observation did not prove a private redirect case.
The scaffold originally mounted `#app` while the production opaque loader creates `#root`; this was
corrected for both frameworks. Visual review also exposed Lit's shadow-DOM styling boundary; the
scaffold now defines component styles and the browser cases check its actual 160-pixel editor height,
width, and font. A first browser-run attempt exposed Playwright's handling of transitive
JSON imports in Node; the tests now use the maintained tsx module loader for trusted local TypeScript
modules. The four browser cases create fresh React/Lit source, compile actual IIFEs, sign exact bytes
with explicit synthetic P-256 roots, verify and install through the actual controller and IndexedDB,
mount the production opaque loader, edit the rendered textarea, assert frame DOM access denial and
360-pixel width, then verify the CLI development preview and rebuild after changing source. They are
desktop engine observations, not physical iOS or Android results. Original machine-path-bearing
Playwright JSON is excluded from public evidence; the public copy removes machine paths.

Honest limits: unit/integration package signatures use newly generated explicit demo/test keys, and
are real P-256 signatures; they are not Sigstore publisher attestations. The transport tests use
synthetic download metadata and bytes. Production Sigstore receipt issuance has denial regression
tests and uses the maintained bundle/verifier libraries, but success requires a real protected workflow
run and an operator-configured production root. The workflow configuration test proves its static
authority separation and pins, not a completed CI run. Real public Git installation, live OCI registry
authentication, complete hostile DNS-rebinding/socket observations,
and final matching-commit acceptance remain integration work. No physical-device or provider result
is inferred from these package tests. No milestone is declared complete by this slice alone.
The integration owner also added required-dependency selection and restart lock checks to the actual
IndexedDB lifecycle browser fixture; its observed result belongs to that owner's lifecycle evidence.
