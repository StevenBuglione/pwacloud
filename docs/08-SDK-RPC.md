# 08. SDK, guest ABI and service contracts

## SDK surface

`@pwacloud/sdk` is a thin typed transport client, not a source of authority. It exposes promises and
async iterables to UI authors while the host controls the underlying MessagePort. The source package
scope is a target naming convention; verify registry availability before publishing it.

```ts
interface PluginClient {
  storage: { get(key: string): Promise<Uint8Array | null>;
             put(key: string, value: Uint8Array): Promise<void> };
  http: { request(request: ScopedHttpRequest): Promise<ScopedHttpResponse> };
  ai: { start(request: AiTaskRequest): Promise<{ runId: string }>;
        events(runId: string, after?: number): AsyncIterable<RunEvent>;
        cancel(runId: string): Promise<void> };
  commands: { invoke(id: string, args: unknown): Promise<unknown> };
  ui: { navigate(path: string): Promise<void>;
        setTitle(title: string): Promise<void>;
        checkpoint(state: unknown): Promise<void> };
}
```

These are proposed interfaces; generate final binding types from the versioned schemas. SDK initialization
requires a host handshake; do not expose a global API that any random window can attach to. React hooks
subscribe to state without remounting on every stream chunk. Lit gets an adapter using the same protocol.

## Protocol envelope

Use version, request ID, method and params only for requests. The transport already supplies principal.
Responses contain request ID, success/error and a typed payload. The SDK maps `ai.events()` to a
permission-checked `ai.subscribe` request and sends `ai.unsubscribe` on disposal; it does not hand
the iframe an authenticated HTTP endpoint or session cookie. Events contain channel/run ID, sequence,
type and data. The receiver validates unknown fields, maximum encoded bytes and method-specific schema.
Use structured clone and Transferables for binary payloads, not unbounded base64 blobs in JSON.

Errors have stable codes such as permission-denied, revoked, incompatible, quota-exceeded, offline,
provider-unavailable, unsupported-capability, cancelled, timeout, invalid-request, interrupted and internal.
Human messages are sanitized. Stack traces, secrets and raw provider headers are not plugin-visible.

Set initial bounds: 256 KiB control message, 64 outstanding RPCs per frame, 8 MiB binary transfer with
explicit credit, bounded event queues, and 30-second generic request timeout unless a method defines
something narrower. These are proposed v1 policy defaults. Streaming is not one ever-growing response.

## Navigation and design context

A host sends initial theme tokens, locale, text scale, safe-area/viewport context, current route and
restored checkpoint. Context updates are sequenced and coalesced. A plugin requests route changes
under its namespace; the host updates browser history and sends a confirmed route event. The host owns
back-stack order and route persistence. Do not use `window.top.location` from plugin code.

For privileged browser features that require user activation, the SDK requests a host interaction flow.
A MessagePort callback may not preserve transient activation. Use a host-owned button/chooser when
necessary and test it on devices. Do not promise camera, clipboard, share or file access by merely
adding a manifest string.

## Event/effect Wasm ABI

`contracts/plugin.wit` defines the versioned guest world. Guest exports activation, event handling,
snapshot and shutdown. Event handling is synchronous and bounded; asynchronous work returns effects
such as storage-get, network-request or AI-start with correlation IDs. The host checks grants, performs
the async operation, and returns an effect-result event. This avoids blocking a browser thread to emulate
synchronous HTTP imports. No Asyncify or experimental async Component Model feature is required in v1.

The TypeScript side validates a guest's returned effect list before executing it. Limit effects per
turn, aggregate payload, recursive call depth and outstanding operations. Deny cycles that continually
create new effects without user-approved budget. A guest is not allowed to bootstrap its own Worker or
create privileged JS closures. Re-entrant host callbacks must queue events, not corrupt guest state.

WIT gives typed call boundaries, but service discovery and transport still need implementation [S12].
For plugin-to-plugin services, generate TypeScript adapters for supported WIT interfaces and route
through the broker. Bind consumer/provider identities, version, scope and resource handles explicitly.
No raw direct port is handed to a peer if that would bypass policy.

## Agent tools

A tool descriptor contains stable ID, input/output schemas, description, read/write classification,
resource-selection semantics, required grants and confirmation rules. Descriptions supplied by plugins
are untrusted content, not system instructions. The host builds the available tool list from current
grants and supported provider capabilities. Sensitive writes require confirmation bound to exact arguments.
The agent cannot install plugins or authorize another plugin on the user's behalf without an explicit
host-controlled approval flow. Shell execution is outside v1.

## API endpoints on the personal runtime

The proposed contract in `contracts/openapi.json` covers session status, provider state/models, install
metadata, run creation/events/cancel and scoped network requests. Every resource checks session and
ownership server-side. Request IDs are idempotency keys scoped to user/plugin, not global strings.
Do not expose raw OpenAI request passthrough, arbitrary model endpoint URLs, credential export, or a
catch-all “execute” route. The public catalogue has a separate read-only surface without user sessions.
