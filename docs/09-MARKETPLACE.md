# 09. Git-to-install distribution and marketplace

## Publish once, install without rebuilding the host

The plugin author runs a scaffold command, develops locally against the SDK, validates the package,
and publishes a signed release from their own repository. A user pastes the repository URL or selects
its catalogue entry. The host resolves a verified immutable release, not a branch's live JavaScript.
Repositories lacking the manifest or compatible release receive an actionable error and authoring guide.
Do not compile unknown repositories inside the user's phone or automatically send their source to a build service.

CLI target commands: `pwacloud create-plugin`, `dev`, `validate`, `build`, `pack`, `verify`, `publish`,
`doctor`, and `inspect`. `publish` requires the author's authorized credentials and cannot silently make
a private repository public. The scaffold includes React and Lit UI choices and an optional Rust service.

## Release pipeline

Validate source manifest -> compile guest -> bundle UI -> inspect imports/limits -> schema/contract tests
-> browser smoke tests -> licence/SBOM -> deterministic archive -> digest envelope -> sign -> publish.
Source builds run with no end-user credentials. Signing permissions exist only in a protected release job.
Fork PR tests do not get write tokens or OIDC signing authority. A tag must refer to a reviewed commit.
Use an explicit source-to-artifact relationship and label “attested” separately from “reproduced.”

GitHub Releases is the first transport. Support an immutable envelope referencing release assets with
exact digests. Never assume redirected release URLs are permanent or that an OCI registry allows browser
CORS. The personal resolver mediates supported downloads while validating destinations and bytes.
M8 adds OCI using the same manifest and archive format, not a different plugin runtime [S26].

## Catalogue v1

A signed static catalogue is sufficient for the first public alpha. It includes plugin ID, publisher
identity, source repository, title, description, categories, release records, compatibility, declared
capabilities, real screenshot references, moderation state and signatures. Search locally for a small
catalogue; add SQLite FTS behind an optional service as scale demands. No external search engine or
multi-tenant publisher account system is required to prove the product.

Filter by compatibility, UI profile, local/offline behavior, capabilities, interface provided, language
and accessibility review. Rank using transparent relevance, not invented downloads or paid placements.
The UI may say “No ratings yet.” It must not seed fake testimonials or download counts.

## Moderation and review

Publish a plugin-submission checklist: source/license, reproducible build instructions, permissions,
privacy explanation, no remote code, no hidden analytics, supported UI profile, mobile screenshots,
accessibility, package limits and acceptance tests. Review is not a mathematical guarantee. Name exactly
what a badge means. Curated catalogue inclusion can be stricter than direct repository installation.

Report an app, withdraw a release, revoke a digest, change publisher identity, rotate trust keys and
appeal a decision all need documented operator workflows. The reference alpha can manage these through
reviewed catalogue pull requests rather than an admin web application. Keep an audit log and preserve
previous signed metadata for investigation. Do not store user reports publicly when they contain private data.

## Update and dependency discovery

Poll catalogue updates opportunistically while the app is active; do not keep a browser worker alive.
A newly compatible release can be staged, but activation follows the lifecycle policy. Search by WIT
interface only when the catalogue has verified metadata for that interface. Auto-binding an arbitrary
provider because it exports the right type is unsafe; users or host policy select the provider.

## Trust receipt and revocation distribution

Publish trust roots with the shell, rotate with overlapping keys and a reviewed update, and maintain
receipt expiry and revoked-digest metadata. Validate signer identity and issuer narrowly [S15]. The
browser verifies the selected receipt and package digest. If the receipt authority is unavailable,
explain whether the action is blocked or allowed from a previous trusted cache; never show fresh
verification that did not occur.

## Commercial boundary

No paid marketplace or revenue sharing in v1. The framework's licence is separate from each plugin's
licence and from provider terms. Do not bundle model entitlement, sell another user's allowance, or
advertise a third-party plugin as an independently authorized ChatGPT partner merely because it calls
PWACloud. Hosted plugin-mediated plan use remains part of the explicit OpenAI review gate.
