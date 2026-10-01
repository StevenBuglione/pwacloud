# 05. Threat model and release-critical security requirements

## Protect these assets

The user's local documents, plugin-private stores, host sessions, ChatGPT credentials and entitlement,
other provider credentials, selected account/workspace identity, install trust roots, grant decisions,
AI usage, saved work, and the ability to leave or stop a malfunctioning plugin.

Assume a malicious plugin publisher, compromised release/CDN, dishonest manifest, hostile web UI,
malformed Wasm, prompt injection in retrieved content, forged RPC messages, revoked permission races,
network redirects/DNS rebinding, interrupted browser storage writes, and another tab resuming stale state.
Also assume publisher CI dependencies may be compromised. Do not assume signatures eliminate malice.

## Trust classes

`host-rendered` executes untrusted service logic only as Wasm and renders through audited host
components. It is the recommended class for strict data-handling requirements. Rich custom web UI
is not allowed in this class.

`isolated-web` runs bundled untrusted JavaScript inside an opaque-origin iframe. It protects host DOM
and privileged capability boundaries when correctly implemented. It does **not** provide a complete
CPU, memory, or outbound-network isolation guarantee. Its UI can see data the user deliberately sends
to it. Do not load secrets or arbitrary workspace content by default.

First-party host UI is compiled into the shell and reviewed as trusted application code. A marketplace
plugin cannot promote itself into that class. No “trust this plugin” toggle that silently loads its
JavaScript alongside the host's session authority.

## Frame setup and residual egress

Use `sandbox="allow-scripts"` with no same-origin, forms, popups, downloads, top-navigation or modal
permissions. Apply a restrictive CSP to the actual controlled document: default none; connect none;
object none; frame none; base none; form-action none; worker none; scripts only the pinned bootstrap/
verified bundle mechanism; images/fonts/media only vetted local blob/data resources as required.
Use a restrictive Permissions Policy and no-referrer. Do not rely on the experimental iframe `csp`
attribute as the only enforcement mechanism [S14,S16,S19].

The frame's `fetch`, WebSocket and similar direct resource requests should be blocked by CSP. However,
self-navigation can be a residual outbound channel, and arbitrary JavaScript can create other device/
browser-specific behaviors. `connect-src` is not a universal network firewall. A load handler can tear
down a navigated frame and revoke its port, but cannot undo a request already sent. Cross-browser
no-egress claims require stronger architecture, not optimistic wording. Do not pass highly sensitive
information into arbitrary custom UI under a “cannot send data out” promise.

On any unexpected navigation, revoke the old port and grant generation; require verified reconstruction
before reconnecting. Never reuse the old session nonce. A frame could also stall the page process;
removing it is not a guaranteed OS-level kill. Document the DoS limit and prioritize reviewed marketplace
apps. Service guests have better termination control because they run in Workers.

## Handshake and RPC

Create a random single-use boot nonce tied to a specific iframe instance and installation generation.
Verify `event.source === iframe.contentWindow`. An opaque frame's origin can be `null`, which is not
identity. A one-time port-transfer handshake may need wildcard target origin for an opaque origin;
never use a global wildcard listener for privileged operations. After setup, use the bound MessagePort
only. Verify version, instance generation, message size, request ID, method schema and expiry.

The host map owns the principal. Ignore or reject any principal fields in plugin packets. Close the
port on reload, disable, uninstall, account switch, unexpected navigation or repeated protocol failures.
Bound in-flight RPCs, queued bytes, payload sizes, stream windows and response rates. Drop stale
responses after teardown. Reject duplicate/replayed request IDs except documented idempotent retries.

## Grant evaluation

Authorize each operation, not just installation. Evaluate the authenticated user/session, current
workspace, active install digest/generation, requested resource, granted scope, provider/account,
expiry, revocation counter, user gesture or action approval, and usage admission. A denied dependency
cannot tunnel through another plugin's more powerful grant. Cross-plugin calls carry both caller and
callee context; effective authority is the explicit approved binding, not the union of their grants.

Queueing before revocation is not permission to execute after revocation. Resource handles are opaque,
scoped, expiring and revocable. A file picker grants the selected file, not all browser/local storage.
Sensitive approve dialogs are always outside untrusted frames.

## Network broker and SSRF

Browser-direct host fetch still obeys CORS [S20]. A personal-runtime proxy is not a CORS bypass service
for arbitrary URLs. Enforce exact permitted origins, methods and path scopes. Reject credentials in
URLs, ambiguous encodings, unexpected protocols, host suffix tricks and unapproved ports. Restrict
headers, request sizes, content types, response bytes, duration, decompression expansion and concurrency.
Use `redirect: manual` and validate every redirect target; do not forward credentials across origins.

Server-side fetching also requires DNS resolution and connection-time address validation. Block
loopback, private, link-local, multicast, metadata services, IPv4-mapped IPv6 and disallowed ranges
unless a separately designed local-service capability authorizes them. Pin the resolved allowed address
for the actual connection, verify the peer, and re-check each hop. URL string validation alone is not
SSRF protection. Treat catalogue, package and screenshot fetchers as SSRF surfaces too. Keep network
credential injection bound to an exact provider audience and redacted from plugin-visible responses.

## Session and credential protection

Use a host-only `__Host-` secure HttpOnly application cookie with an intentional SameSite policy,
CSRF token and exact Origin validation. Reject `Origin: null` for authenticated APIs. Check Fetch
Metadata where available as defense in depth, not the only auth. Do not accept a CORS wildcard with
credentials. Do not put application-session authority in iframe URLs. OAuth callbacks use validated
transaction state and separate exemptions, not a global CSRF disable.

The OpenAI credential rules and external approval gates are in `06-OPENAI.md`. A secure key vault
cannot make an otherwise unauthorized custody model permissible. Do not store tokens simply because
an earlier design diagram showed a BFF. Credential-free static hosting remains possible for the shell.

## Supply chain and content

Verify immutable bytes before parsing executable payloads. Enforce archive limits before extraction.
Use an ephemeral isolated publisher build without customer secrets, host filesystem mounts, Docker
socket access or inherited cloud credentials. Do not build arbitrary repositories on catalogue workers.
Trusted workflows pin actions/toolchains and emit SBOM, license and provenance data. Dependency updates
run the whole hostile-plugin suite. Disable install-time hooks for third-party packages where feasible;
review any necessary build script explicitly.

Render Markdown/HTML with an allowlist sanitizer and safe link handling. Sanitize SVG or use rasterized
icons for catalogue metadata. Prevent stored XSS in titles, errors, logs, file names and AI output.
A model tool call is a request, not permission. Prompt-injected content cannot broaden grants, switch
accounts, alter budgets, invoke shell, or turn on background runs.

## Failure handling and incident response

Fail closed on verification and authorization errors. Preserve user data. Record redacted structured
security events with reason codes and plugin digest. Publish a revocation feed for compromised releases;
apply it without deleting documents. Document stale/offline trust behavior. A recovery control can
start the shell with all plugins disabled. Never treat revocation-feed silence as proof of safety.

## Security tests are release gates

Required attacks include forged principal, null-origin API call, wrong MessagePort, replay after reload,
credential read, host DOM read, blocked direct fetch/image/WebSocket, frame self-navigation residual,
SSRF redirect, mapped IPv6, oversized decompression, memory-growth guest, endless Wasm loop, UI DoS,
prompt-injected tool invocation, permission expansion update, downgrade, signature mismatch and
provider usage after revocation. The residual tests document remaining limits; they must not be renamed
as successful containment claims. See `12-TESTING.md` for evidence and expected outcomes.
