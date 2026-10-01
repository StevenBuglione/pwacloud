# Publishing and verifying plugin artifacts

Run the locked source build before tagging a reviewed commit:

```sh
pnpm install --frozen-lockfile
pnpm build:guest
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:security
pnpm exec tsx scripts/build-packages.ts --release
```

`--release` writes unsigned archives and envelopes to `artifacts/release-packages`. It does not generate
demo receipts or publish a trust root. The ordinary local build writes visibly labeled demo fixture
receipts to `artifacts/packages`; these are rejected unless the embedding host explicitly enables demo
mode. Never copy that root into production trust configuration.

The `plugin-release.yml` workflow runs only for `plugin-v*` tags in `StevenBuglione/pwacloud`. It builds
with Node 24.19.0, pnpm 11.19.0, Rust 1.93.0, locked Cargo and pnpm dependencies, and Jco 1.34.0. The
readonly build job tests and uploads exact unsigned artifacts. A separate signing job gets OIDC and
release-writing permissions; it never installs plugin dependencies. Actions are pinned to resolved
upstream commit SHAs. Cosign 3.1.3 signs the archive and the exact envelope bytes. `actions/attest` creates
SLSA provenance binding both artifacts to the source workflow. It also attests the CycloneDX dependency
inventory from the actual npm dependency tree and locked Cargo metadata. Declared license metadata is
included and machine paths are removed from the public license inventory. This is not a vulnerability
scan or a legal audit; Cargo.lock and bundled license notices remain part of review.

The workflow publishes a reference package release, with names such as `notebook.archive.zip`,
`notebook.envelope.json`, `notebook.archive.zip.sigstore.json`, and `notebook.envelope.json.sigstore.json`.
The shared `provenance.sigstore.json` binds all six archives/envelopes. These are actual generated
signatures only when the workflow runs successfully. A workflow file alone is not signing evidence.
The release notes deliberately keep product alpha, provider, and physical-device gates separate.

## Personal verification and compact browser receipts

`packages/package-verifier/src/provenance.ts` exposes `issueVerificationReceipt`. The operator supplies:

- Trusted Sigstore material obtained and updated through the official Sigstore trust-root mechanism.
- The exact expected issuer `https://token.actions.githubusercontent.com` and certificate identity
  `https://github.com/StevenBuglione/pwacloud/.github/workflows/plugin-release.yml@refs/tags/<reviewed-tag>`.
- The expected builder equal to that exact workflow identity, reviewed commit SHA, workflow
  path `.github/workflows/plugin-release.yml`, repository, and exact tag ref.
- A locally configured ECDSA P-256 signing key, its reviewed public `TrustRoot`, current revocation
  sequence, and revoked digests. The public root's `publisherIdentity` must equal the workflow identity.

Private signing material stays in the operator's protected user-controlled store. It is never a release
asset, browser value, plugin packet, public evidence, or example secret. The adapter accepts an already
opened `CryptoKey`; it does not scrape another application's credential store or create a remote vault.
The personal runtime generates a local signing key on first use and keeps it in its protected local
store. Its fixed policy accepts only the authorized PWACloud repository and exact release workflow,
tag, and commit, verified against updated Sigstore trust material. The resulting root identifies this
runtime's verification of that workflow; it is not the publisher's own key. The runtime persists only
its public roots for browser discovery through authenticated `/v1/trust`. Other publishers require
an explicitly configured policy and root; fixture keys never substitute for missing production trust.

The adapter verifies actual keyless signatures over both exact byte payloads with Sigstore's maintained
bundle parser and verifier, including trusted Fulcio/Rekor/CT roots and exact issuer/identity. It verifies
the SLSA builder, repository/workflow/ref, source commit, archive subject, and exact-envelope subject.
It then issues a receipt expiring in at most seven days, and a separate exact-envelope signature, using
raw 64-byte P-256 `r||s` encoding. Full package validation runs before a packet is returned. The browser
checks the approved root, both signatures, receipt expiry/revocation, archive digest/size, every file
digest, manifest compatibility, and the Component Model header and trusted transform version. The
Worker runtime performs its additional component import and memory inspection; uploaded JS glue is
rejected. A signed archive is not inherently safe application code.

The personal resolver can serve `encodeInstallPacket(verified.packet)` over its authenticated
`/v1/registry/resolve` route. An operator can instead publish approved receipt/envelope signatures as
the standard `archive.zip`, `envelope.json`, `receipt.json`, `receipt.sig`, and `envelope.sig` release
assets. `resolveGitHubRepository` verifies those assets and their tag-to-source commit. It never
compiles an arbitrary repository. Without an operator-approved root or valid attestation, installation
fails closed. No production receipt is substituted with a fixture key.

GitHub and OCI use the same verified package contract. OCI references require immutable SHA-256
manifest digests; all five layer digests and final package signatures are verified. The personal
download path filters DNS results, pins the selected public address, checks the actual TLS socket
peer, and repeats destination checks on every redirect. Registry authentication and browser CORS
never bypass these checks.

## Required dependency selections

The v0.1 manifest's `requires` value is an array of exact interface strings. It cannot express optional
auto-installs. An embedding host must pass `dependencySelections` to `createPluginHost`, as a map from
`<consumer-id>:<interface>` to the explicitly selected provider ID. Before staging any installation the
host validates the entire proposed graph, rejecting missing providers, incompatible interfaces, duplicate
versions, and cycles. It records the chosen provider and immutable digest atomically with the installed
consumer. On restart those recorded selections are reused and validated; missing or stale locks fail
closed. A provider needed by another installed consumer cannot be removed or changed to another digest
until the consumer is deliberately removed or its bindings are reviewed and reinstalled. An interface
match does not select a provider or grant access to its data.

## Upstream references

- [GitHub attestation action](https://github.com/actions/attest)
- [Cosign installer and checksum verification](https://github.com/sigstore/cosign-installer)
- [Sigstore verification library](https://github.com/sigstore/sigstore-js/tree/main/packages/verify)
- [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
