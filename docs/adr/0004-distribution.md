# ADR 0004: one immutable plugin format, multiple transports

Status: accepted. Use GitHub Release archives/envelopes first and OCI as an adapter over the same signed
content model. Browser installation verifies both a trusted receipt and artifact bytes. Consequence:
receipt issuance is a visible trust dependency. It does not imply an arbitrary signed package is safe
or independently reproducible. Git remains the publisher entry point, not an arbitrary runtime compiler.
