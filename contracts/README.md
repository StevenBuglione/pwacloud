# Contract authority
The JSON Schema files constrain wire shape, not complete authorization. Every method additionally
needs a strict discriminated parameter schema in `packages/contracts` and semantic checks in the host.
`params` in the seed RPC envelope is intentionally not a universal method validator. The caller must
never supply a trusted principal; derive it from the authenticated port/session.

The manifests describe assets to implement; those assets are not included. Validate paths, identities,
version relationships, duplicate capability IDs, imports and build profiles beyond schema syntax.
The WIT contract is a target contract and has not been compiled in the authoring session. M0 must compile
and round-trip it with the pinned Component Model toolchain before treating it as frozen.

`openapi.json` specifies the control-service interface, not implemented endpoints or provider authorization.
`runtime.sql` contains metadata only. Provider access/refresh tokens must not be placed in this database.
