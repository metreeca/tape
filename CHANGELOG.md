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
- Bump `@metreeca/core` dependency to `^0.9.18`

