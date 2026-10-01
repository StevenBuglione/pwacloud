# 02. System architecture and ownership

## Placement

The PWA owns presentation, local state, installed artifact caches, Worker lifecycles, plugin permissions,
and the broker's local half. A paired personal runtime owns permitted OAuth credentials, authenticated
provider calls, durable AI runs when explicitly authorized, and optional verified network proxying.
The public marketplace holds only public catalogue and release metadata. It never owns end-user
ChatGPT credentials in the default architecture.

Data path: plugin frame -> host-bound MessagePort -> client capability router -> local store, guest
Worker, or same-origin personal API -> authorized provider. Responses follow the same association.
No plugin supplies a replacement API base URL or forwards a provider token.

## Target repository layout

```text
apps/
  shell/                     # React/Ionic installable reference PWA
  personal-runtime/          # Fastify API, OAuth, model adapter, run journal
  catalogue/                 # catalogue compiler and optional search service
packages/
  contracts/                 # schemas and generated TypeScript
  sdk/                       # framework-neutral plugin client
  sdk-react/                 # hooks and React conveniences
  sdk-lit/                   # small Lit example adapter
  ui-kit/                    # phone-first patterns and design tokens
  controller/                # desired state, install transactions, scheduler
  broker/                    # capability policy and authority bindings
  runtime-web/               # Worker loader and Wasm bridge
  runtime-ui/                # iframe creation, handshake, viewport and navigation
  storage/                   # IndexedDB/OPFS adapters and quotas
  provider-chatgpt/           # supported direct-plan adapter
  package-verifier/          # digest, receipts, provenance, compatibility
  registry-client/           # GitHub Release and OCI transports
  cli/                       # create, validate, pack, publish, doctor
examples/plugins/
  notebook/
  feed-reader/
  canvas-board/
tests/
  unit/ integration/ e2e/ hostile/ fixtures/
infra/
  local/ ci/ deployment/
docs/ contracts/ planning/ evidence/
```

Root commands after M1: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`,
`pnpm test:integration`, `pnpm test:e2e`, `pnpm test:security`, `pnpm test:a11y`, `pnpm verify:all`,
and `pnpm verify:release`. A missing script is a failure, not a successful no-op. The seed package's
scripts do not pretend these target commands are already implemented.

## Module boundaries

`contracts` depends on no application package. `broker` is pure policy plus interfaces to storage,
HTTP, identity and provider implementations. `controller` consumes contracts and broker interfaces.
`runtime-web` and `runtime-ui` depend on contracts, not on React. `sdk-react` depends on `sdk`, never
the shell. `ui-kit` provides ergonomic components but is optional for third-party plugin authors.
The personal runtime can run without the catalogue service. The shell can run offline without the
personal runtime. No package imports a concrete application from `apps/`.

Plugin authors must not import shell internals. Enforce dependency rules in CI. The embedding API is
`createPluginHost({storage, policy, registries, uiMounts, aiTransport, diagnostics})`, plus mount adapters.
Ship a minimal second host without Ionic in M9 to prove reusability.

## Runtime principal

A principal consists of host-assigned workspace ID, installed plugin ID, immutable artifact digest,
installation generation, instance ID, and connection ID. Create it only after install validation.
Associate it with the MessagePort or Worker object in a host-side map. A JSON request's fields cannot
replace this association. Grants also bind the account/session generation where AI or remote data
is involved. Uninstall, reload, account switch, and update rotate or invalidate the appropriate generation.

The browser authenticates to its personal runtime using a scoped secure application session, not an
OpenAI token. The runtime independently checks installation/grant/run ownership. An origin or client-side
check alone is insufficient. Do not send a bearer capability valid for arbitrary work to an iframe.

## UI manager

The host owns top-level navigation, header identity, bottom tabs, permission dialogs, confirmations,
and global task controls. A plugin owns its content viewport. It submits navigation intentions and
host-chrome contributions through schemas. It cannot replace the host's account menu or approval sheet.

Keep one active rich iframe on a phone. Replace inactive UIs with durable checkpoints, not dozens of
hidden frames. Host-rendered dashboard previews use sanitized data and host components. Full-screen
plugin pages may internally use any supported bundled web framework. Apps with dynamic CDN imports
must be repackaged for the supported asset profile, not silently given internet/script privileges.

## Guest runtime

A Worker loads a verified component's browser artifact created by the trusted transformation pipeline.
All original imports must match the allowed WIT world. Unknown imports fail before execution. The
loader never runs arbitrary publisher-supplied worker scripts. A guest processes bounded events,
returns effects, and is re-entered when asynchronous effects finish. A wall-clock watchdog terminates
unresponsive Workers; final browser scheduling and process memory are outside platform control.

Workers do not touch the DOM. UI framework Wasm (for example a Rust web frontend) is separate from
service Component Model Wasm and must satisfy the UI bundling/CSP profile. It does not automatically
inherit the service guest's isolation or host ABI.

## Personal runtime

Default bind is loopback. Pairing a phone requires an explicit HTTPS endpoint controlled by the user,
an authenticated pairing ceremony, and the same PWA/API origin. The browser cannot use a desktop's
`127.0.0.1` callback. Complete initial local sign-in on the runtime's computer, then authorize the phone
as a client of that runtime. This is less frictionless than hosted sign-in; the UI must say so.

A paired browser receives only PWACloud session authority. It does not receive OpenAI refresh/access
or ID tokens. Protect local credentials through OS credential storage or an encrypted local store with
a separately protected key. Never treat a desktop configuration file as permission to expose a public
endpoint. A remote VM path remains gated by the documentation/terms issue in `06-OPENAI.md`.

## Durable runs and stream transport

Use HTTP to create a run with an idempotency key and POST body. Return a run ID before streaming.
Stream sequenced PWACloud events using a same-origin authenticated fetch stream. Persist important events
in the runtime journal. The browser acknowledges its last event; reconnect replays events from the
journal, not the model. Never restart a possibly admitted model call just because the phone reconnects.

By default, a disconnect cancels expensive work after a short configured grace interval. A user can
explicitly choose “Continue on my runtime,” with scope, duration and usage limits disclosed. A browser
Worker has no such guarantee. Data and state consistency do not depend on `beforeunload` firing.

## No hidden server dependency

Offline edit/search/filter/format operations remain browser-local. Network-required commands show a
clear offline state. Installation needs internet unless a previously verified package is cached.
AI needs a reachable authorized runtime/provider. Do not queue expensive inference automatically when
a phone returns online. Signed cached metadata is useful offline but cannot prove current revocation status.
