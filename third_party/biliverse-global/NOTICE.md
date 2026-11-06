# Biliverse Global

This integration includes the official Biliverse Global request and response
release bundles, by VirgilClyne and the Biliverse contributors.

- Source: https://github.com/Biliverse/Global
- License: Apache License 2.0 (see LICENSE in this directory).
- Exact release and asset SHA256 digests: Scripts/bilibili/global-integration.sources.json.

Changes made by this repository: the bundles run in separate function scopes;
`globalThis.$argument` accesses bind to their stage-local `$argument`; an outer
adapter sequences Global processing and RuCu6 ad cleanup. Global's routing,
cache, search, preference storage and regional selection implementations are
otherwise unchanged. This is an unofficial integration, not a Biliverse release.
