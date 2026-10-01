# ADR 0001: isolated UI session rather than shared-realm microfrontend loading

Status: accepted. Rich plugins use a bundled app in an opaque-origin iframe with a principal-bound
MessagePort. Shared-realm remote modules and custom elements do not enforce marketplace trust boundaries.
First-party components remain ordinary host code. Restricted data-handling plugins can use audited
host-rendered UI. Consequence: theme, navigation, file access and overlays need explicit SDK bridges;
arbitrary UI egress and process DoS cannot be perfectly eliminated by an iframe.
