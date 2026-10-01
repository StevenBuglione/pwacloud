# 04. Plugin package specification, v0.1

The machine-readable manifest is `contracts/plugin-manifest.schema.json`. JSON is normative for the
release artifact; a publisher CLI may accept YAML and normalize it before signing. Use strict unknown-
field rejection and size limits. Do not reinterpret a manifest with arbitrary executable hooks.

## Package contents

A distribution archive contains `manifest.json`, `ui/app.js` and `ui/style.css` when applicable,
`service/component.wasm` when applicable, verified asset files, license notices, and a machine-readable
build report. The package cannot contain symlinks, hardlinks, device files, absolute paths, traversal,
NUL characters, duplicate normalized entries, encrypted entries or nested executable archives.
Enforce compressed bytes, expanded bytes, file count and individual-file budgets before extraction.

A separate release envelope binds archive digest and size, manifest digest, component-world version,
source repository identity and commit, package version, browser-transform toolchain identity, and
signature/provenance references. Do not include an archive's own final digest inside that archive.
The envelope is signed over exact bytes. Verification must not depend on reserializing JSON identically.

## Manifest semantics

`id` is a publisher-scoped immutable identifier. Names, icons and screenshots are display metadata,
not authority. `version` is strict SemVer. `hostApi` specifies the supported major and tested minimum
minor. `ui.profile` chooses `isolated-web` or `host-rendered`; a manifest cannot request first-party
host execution. The `service` is optional, but at least one UI or service contribution is required.
Host API and component world versions are distinct and cannot be substituted for each other.

Permissions have stable IDs, a capability name, a required flag, and structured restrictions. Network
scopes use exact HTTPS origins, method allowlists and normalized path prefixes. No arbitrary wildcard
hostnames in v1. Storage is per-plugin and workspace; a quota does not reserve disk. AI is a named
capability with local admission limits and declared context scope, never a credential or entitlement.
Unknown capabilities are incompatible, not automatically granted.

Contributions are declarative host chrome: library entry, route suffix, command, settings entry,
and optional host-rendered preview. Paths are namespaced under `/apps/<installation-id>/...` by the
host. A plugin cannot register `/auth`, `/settings`, global account controls, arbitrary HTML icons,
raw SVG scripts, or a service worker. Use a host-reviewed icon identifier or inert vetted image.

## Expressive UI asset profile

V1 isolated-web UI publishes one bundled IIFE JavaScript entry, one CSS entry, and an asset map. All
framework dependencies are included; no remote scripts, fonts, analytics, dynamic CDN imports or
runtime package installation. The bundler rewrites asset references to SDK-provided object URLs.
Map token-to-file digest before serving an asset. Dynamic chunks are flattened or rejected for this
profile. Large lazy applications can add a separately versioned module-loader profile later.

The host constructs a controlled `srcdoc` document containing only the verified bundle and runtime
bootstrap. Escape embedded script/style termination safely using encoded payloads, not a string
replacement with unproven edge cases. Restrict scripts and resources with CSP and sandbox. See
`05-SECURITY.md` for the residual navigation risk. Asset bytes come from the host's verified cache,
not cross-origin third-party storage. This profile intentionally trades some bundler convenience
for predictable offline behavior and an auditable load boundary.

M0 must prove this packaging path with React and Lit in real browser engines. Do not ship a loader
that works only with WebKit security disabled. Rust/.NET UI frameworks are future compatible candidates
only after their output meets the profile and size budget; they are not automatically supported in v1.

## Wasm transformation

Publish the original component and transform it with a pinned trusted Jco pipeline [S12,S13]. Reject
unknown WIT imports, unapproved runtime features, missing memory maxima where policy requires them,
and components exceeding aggregate declared linear-memory policy. Inspect all embedded core modules.
JavaScript glue in the package is not inherently safe because it accompanies Wasm. Only the pinned
transform pipeline may generate executable Worker glue; verify provenance and/or repeat transformation
in the verifier. Do not import a publisher's free-form Worker entry.

Browser linear memory limits do not bound JS heap, compiled code, GPU allocations, all runtime overhead,
or the full page's memory. Label these controls accurately. First guests use synchronous event handlers
that emit async effects; no browser-wide shared memory or cross-origin isolation is required for v1.

## Signatures and trust roots

Use Sigstore/Cosign in publisher CI to establish a specific expected workflow identity and issuer,
not merely “signed by some GitHub Actions job” [S15]. The personal verifier checks that identity,
source/release relationship, artifact digest and expected builder. A signature does not establish
independent reproducibility. Display those badges separately.

For browser/offline use, issue a compact PWACloud verification receipt signed by a catalogue/verifier
key trusted by the host. Prefer WebCrypto-compatible ECDSA P-256 with specified raw 64-byte `r||s`
encoding. Version the format and sign an exact byte payload. A receipt binds manifest/package digests,
publisher identity, verification policy version, expiry and revocation-feed version. The browser checks
the receipt and hashes downloaded bytes itself. This makes the receipt issuer an explicit trust root;
do not hide that dependency or call it trustless.

Direct repository installs follow the same verification pipeline, plus a visible first-use publisher
trust review. An arbitrary key supplied by the plugin is not a trust anchor. A self-host operator can
configure private trust roots explicitly. Production roots are never replaced by the test fixture key.

## Install compatibility and dependency rules

Resolve versions into a lock record with immutable digest, source commit, host API, guest world,
UI profile and chosen service bindings. Resolve the entire dependency graph before installation;
reject cycles and unsupported major versions. Optional dependencies do not silently auto-install.
Two independently upgraded providers may coexist only if the namespaced service binding and data
ownership remain unambiguous. No global JS dependency sharing between untrusted UIs.

Offline installs require an already cached valid receipt and package. Expired receipts block new
installation until reverified. Already-installed tools can remain locally usable with an explicit
revocation-freshness warning under policy; sensitive new operations can require current trust metadata.
Updates that add permissions always require fresh consent before activation.
