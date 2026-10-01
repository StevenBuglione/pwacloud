# M2 principal-bound capabilities and isolated UI

Implemented strict AJV RPC/manifest boundaries; opaque allow-scripts frames with nonce CSP, source-bound one-use handshake, bounded/replay-protected messages and deterministic teardown; SDK correlation and cancellation; atomic IndexedDB quotas and generation guards; brokered storage, HTTP, AI subscriptions and one-use selected-document approval. UI encoding has a bounded exact-content cache while every mount rehashes assets and creates new identity/nonce/port. AI event delivery is bounded64 events/256KiB and rechecks grants before every delivery.

Observed unit167/167 and security15/15 pass before final delegated agent/removal additions. Actual browser forged-identity, replay, oversized request, principal and storage boundaries are in the integrated Playwright suite. CSP navigation/CPU residuals remain explicit; no complete iframe isolation claim.
