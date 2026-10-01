# 06. OpenAI identity and ChatGPT-plan integration

Research date: **2026-10-01**. This file supersedes any earlier assumption that a public PWA can
store everyone's ChatGPT tokens on a shared backend. Sources S01-S08 and S21-S25 are primary OpenAI
documentation. Recheck before public release; this is a changing preview and not legal advice.

## Verified capability and the product boundary

OpenAI documents Sign in with ChatGPT, optional eligible plan usage, an OSS/local flow and selected
commercial access. Identity does not itself confer inference entitlement. A publicly licensed project
is not automatically an approved hosted service. Register the real application, PWACloud, not another
tool's client identity. Use only the documented public Responses endpoint [S01,S02,S03].

## Required deployment modes

| Mode | User experience | Credential placement | Release status |
|---|---|---|---|
| `demo` | Full local app and clearly marked synthetic AI | No provider credentials | Fully implement |
| `chatgpt-plan-local` | User signs in on their personal runtime computer; phone pairs securely | Permitted protected local user-controlled store | Implement and test with authorized sign-in |
| `approved-hosted` | Direct mobile website sign-in | Only the custody model actually approved for this integration | Implement adapter boundary, keep disabled pending approval |
| `self-hosted-vm` | User-managed remote runtime | Unresolved documentation/terms interaction | Block persistent token deployment pending clarification |

The default local integration must remain free to use. Do not make “enter an API key” the primary
success path. Optional separately billed API support may be added after explicit user selection; no
automatic fallback and no API account required for the reference ChatGPT-plan path.

## Terms and documentation tension: fail closed

The SIWC terms dated September 29, 2026 constrain persistent token storage, user-controlled execution,
connected-app scope, charging for plan access, and subscription sharing. The separate self-hosted-VM
guide describes transferring credentials to a personal VM, while the session guide mentions protected
self-hosted storage. Those texts are not fully aligned on persistence. Do not resolve this silently
in favor of a multi-tenant vault or VM implementation [S04,S05,S06].

Default to protected storage on the user's local runtime. Obtain clarification or applicable written
partner terms before enabling hosted/remote persistent credentials. Also obtain confirmation that
third-party plugins installed inside PWACloud fall within the connected application's permitted scope.
Do not expose a generally reusable OpenAI-compatible proxy to other applications. Treat these as
external go-live gates, not evidence that a request has already been approved.

## Separate identity, entitlement and grants

PWA identity says which workspace/session is active. Provider registration says which verified
OpenAI issuer, subject, client registration and workspace is selected. Entitlement says which actually
granted scopes/features are available. Plugin grants say what that installed plugin may request.
All four must be valid before inference. Never merge accounts by email, infer a Pro plan from a label,
or let a plugin choose a different account. Provider usage is for this authenticated user's work.

Maintain explicit states: disconnected, identity-only, needs-consent, connecting, ready, refreshing,
reauth-required, temporarily-unavailable, policy-blocked and disabled. A failed refresh is not permission
to create a new account or rotate host IDs. UI state reflects verified responses, not a static demo flag.

## Local OSS registration

Use the documented registration flow with fresh state, nonce and PKCE S256, a stable opaque
`ext_agent_host_id`, and the application's actual name. First registration starts with
`dynamic_agent_client`; the issued client ID returned for that registration is saved and used for
exchange/returning authorization. Validate returned identity and granted scopes; retain identity-only
state when plan permission is absent [S07].

Implementation tasks: loopback listener with exact callback path; one-time expiring transaction;
issuer/JWKS verification; audience and nonce checks; state consumption; secure credential persistence;
refresh serialization; explicit account selection; redaction; and cancellation. Use a maintained OIDC
library where compatible. Derive exact endpoints and scope set from the referenced official flow at
implementation time. Never invent a device-code flow or copy another tool's auth file.

A phone cannot complete an OAuth callback on a different computer's `127.0.0.1`. In local mode the
computer completes sign-in and displays a short-lived one-use pairing invitation. The phone pairs to
the runtime's authenticated HTTPS PWA origin. Pairing grants a PWACloud session, not provider tokens.
Protect pairing with entropy, expiry, attempt limits, account confirmation on the runtime, and no
credential-bearing QR URLs. A pairing code is transient authority and must be redacted like a secret.

## Hosted identity

The website integration requires its own registered client/callback and the documented OIDC/PKCE
transaction flow. This identity route is distinct from OSS dynamic plan registration [S21]. Do not
assume that `openid profile email` also grants inference or that the OSS loopback callback works as
a hosted redirect. Hosted plan usage needs its applicable approved configuration. A config boolean
alone is not proof of approval; record operator-controlled release evidence separately.

## Plan adapter request shaping

The adapter obtains the selected account's available model list and preserves provider display names
and slugs. Do not hardcode the conversational model named in an example. This route's documented
catalogue uses a `models` array, which differs from assumptions some generic API clients make [S03].
Use the selected slug and the documented Responses HTTP transport. The small reference request builder
in `src/reference/ai.ts` intentionally supports only text, context and instructions.

For the current plan route, construct `store: false`, `stream: true` and the required history as `input`.
Do not forward arbitrary JSON from plugins. Omit unsupported generation options, persistent continuation
fields and hosted tools. In particular, do not implement local output budgets by sending unsupported
`max_output_tokens`. Image generation, hosted file search, Code Interpreter, native computer use and
hosted MCP are not v1 promises for this route [S22].

Images/files, structured outputs and tool calls require explicit adapter capability validation for the
selected model. Text is the first verified path. An unsupported capability produces a typed error before
request admission. A plugin's “AI” manifest permission is not a claim that every API endpoint is covered.

## Tool and agent bridge

After text streaming works, expose only plugin tools the user granted and the adapter supports.
Namespace tools by stable plugin and command IDs. Validate schemas, principal, resource scope, run
approval and data disclosure for every call. Model instructions never override broker policy.
Local function/custom execution is distinct from hosted provider tools. An optional Codex app-server
integration belongs to a later personal-runtime module, not the phone or mandatory UI runtime [S23].
Do not ship shell access in the first three plugins.

## Run accounting and limits

Use admission reservations per account, workspace and plugin. Local caps govern requests, concurrent
runs, input bytes, output delivery bytes and elapsed time. They are not exact ChatGPT credit forecasts.
Provider counters, when available, remain authoritative for provider usage. Show unknown remaining
allowance as unknown. The user's per-app provider limit is distinct from our per-plugin controls [S24].

Reserve a slot before sending, release the in-flight slot when finished, and retain the admitted-request
count even when a stream fails. Do not treat cancellation as a refund. Exact inference cost ceilings
cannot be promised from client cancellation or unsupported output parameters. Once request acceptance
is uncertain, retry only with a known safe idempotency strategy or explicit user action.

## Streaming, interruption and refresh

The runtime parses SSE incrementally across chunk boundaries, including UTF-8 and partial JSON. Track
provider request IDs privately, normalize events with monotonically increasing local sequence numbers,
and persist resumable run state. A disconnected HTTP stream is not completed inference; require a
provider terminal event. Reconnect the phone to the existing local run journal, not `previous_response_id`
on a fresh unsupported plan request. Sanitize provider error text and preserve diagnostic status/code.

Handle identity-only, revoked access, admission failure, policy restriction, rate limit and temporary
routing failure separately. OpenAI documents several different error shapes; do not assume every error
has the usual API object. Never silently switch billing paths [S25]. Serialize refresh per registration,
atomically replace credentials, and prevent concurrent refresh races from overwriting newer tokens.

## Consent and privacy

User-generated work can consume usage only after provider entitlement and plugin consent. Background
work requires a separate explicit decision, a stopping condition and visible activity. No automatic
AI requests during app launch, background catalogue refresh, installation, analytics or screenshots.
Approval copy must identify which data leaves the device. Do not claim login imports ChatGPT history.
Delete or export local PWACloud conversations under the user's control.

## Tests and external gate

Protocol fixtures must test missing direct-use scope, wrong state/nonce/issuer/audience, reused code,
expired transaction, wrong account, refresh race, revoked access, unsupported parameters, unknown model,
stream truncation, cancellation, duplicate run creation, policy denial and no fallback. These fixtures
prove our code, not provider eligibility.

A real smoke test requires the owner to authorize a real eligible account, enumerate actual models,
complete a short request and cancellation, and retain redacted evidence with no tokens or personal
prompts. Missing sign-in remains `blocked`, not `passed`. The hosted release additionally requires the
approval/custody/plugin-scope gates. Local and non-AI implementation continues while those are pending.
