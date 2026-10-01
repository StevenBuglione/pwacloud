# ADR 0002: effect/event ABI for asynchronous guest operations

Status: accepted. Guests execute bounded synchronous handlers and emit typed effects. The host performs
async storage/network/AI work and returns correlated events. This avoids blocking the UI thread or
relying on experimental async component support. Consequence: guest SDKs need a small state machine;
WIT interfaces remain versioned, and RPC/service routing still needs host implementation.
