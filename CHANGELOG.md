# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unpublished](https://github.com/metreeca/tape/commits/HEAD)

### Changed

- Narrow `log(config)` value type from `string` to `LogLevel`
- Make `log(config)` idempotent, silently accepting repeated deep-equal configurations
- Fix `log(config)` preserving user-supplied `reset` flag instead of silently overwriting it
- Fix `log(config)` duplicate logger error when overriding default categories
- Preserve `"index"` as an explicit category segment so that `name.ts` and `name/index.ts` resolve
  to distinct categories; root `src/index.ts` now resolves to `[".", "index"]` instead of `["."]`
- Render log labels via a new `label()` helper: internal modules as `/module/path` with trailing
  `/` for `index` entries (e.g. `/utils/`, `/name/`), external packages as `package[:module]` with
  trailing `/` for `index` entries (e.g. `lodash/`, `@scope/pkg:utils/`)
- Bump `@metreeca/core` dependency to `^0.9.18`

