# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unpublished](https://github.com/metreeca/tape/commits/HEAD)

### Added

- Add `time()` utility for monitoring the execution time of synchronous and asynchronous tasks, reporting
  the result value and the elapsed milliseconds to a monitor callback
- Add `report()` utility for formatting values as readable log content, rendering numbers with grouped
  digits, strings as quoted literals with their invisible characters surfaced as escapes and overlong
  content optionally clipped, errors through their message, and functions through their name

### Changed

- Narrow `log(config)` value type from `string` to `LogLevel`
- Make `log(config)` idempotent, silently accepting repeated deep-equal configurations
- Fix `log(config)` preserving user-supplied `reset` flag instead of silently overwriting it
- Fix `log(config)` duplicate logger error when overriding default categories
- Preserve `"index"` as an explicit category segment so that `name.ts` and `name/index.ts` resolve
  to distinct categories; root `src/index.ts` now resolves to `["/", "index"]` instead of `["."]`
- Qualify internal category arrays with the enclosing package directory (the folder holding `src/`)
  so that identically-named modules across monorepo packages resolve to distinct categories
  (e.g. `["/", "tape", "utils"]` instead of `["/", "utils"]`)
- Render log labels via a new `label()` helper: internal modules as `/module/path` with trailing
  `/` for `index` entries (e.g. `/utils/`, `/name/`), external packages as `package[:module]` with
  trailing `/` for `index` entries (e.g. `lodash/`, `@scope/pkg:utils/`)
- **BREAKING**: Align category arrays and config keys with the label convention: internal marker
  changed from `"."` to `"/"` (e.g. `["/", "utils"]` instead of `[".", "utils"]`); non-scoped
  packages drop the `"@"` marker (e.g. `["lodash", "map"]` instead of `["@", "lodash", "map"]`);
  config keys use label-style syntax (`"/"`, `"/utils"`, `"lodash"`, `"@scope/pkg"` replace `"."`,
  `"./utils"`, `"@/lodash"`, `"@scope/pkg"`). A new `parse()` helper maps config keys to category
  arrays
- Bump `@metreeca/core` dependency to `^0.9.22`, realigning imports to its reorganised module layout
- **BREAKING**: Bump `@logtape/logtape` dependency to `^2.3.2`: the re-exported LogTape surface drops the
  deprecated `LoggerConfig.level` property, replaced by `lowestLevel` for a minimum level or by `filters`
  for finer selection

