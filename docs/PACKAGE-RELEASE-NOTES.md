# Signed plugin reference packages

This release contains source-built Notebook, Feed Reader, and Canvas Board archives, exact digest
envelopes, keyless Sigstore signatures, build provenance, and dependency inventories. The signatures
identify the specific `plugin-release.yml` workflow and tag. They do not establish an independent
reproduction, a mobile-device test result, model entitlement, or completion of the product alpha gates.

Production receipt roots are an explicit operator trust decision. This release contains no test private
keys, demo trust roots, or demo receipts. The personal verifier must check the expected workflow identity,
issuer, builder, source commit, exact archive/envelope bytes, component restrictions, receipt expiry and
revocation before serving a browser installation packet. See `docs/PACKAGE-PUBLISHING.md`.

The ChatGPT and physical-device acceptance gates remain separate from package signing. Hosted plan
sharing and remote credential persistence remain disabled.
