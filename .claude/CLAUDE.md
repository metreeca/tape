---
title: Project Guidelines
description: Development guidelines and conventions for the @metreeca/tape package.
---

# References

## LogTape Documentation

- [LogTape Official Documentation](https://logtape.org/)
- [Getting Started](https://logtape.org/intro)
- [Hierarchical Category System](https://logtape.org/manual/categories)
- [Configuration](https://logtape.org/manual/config)
- [Text Formatters](https://logtape.org/manual/formatters)
- [GitHub Repository](https://github.com/dahlia/logtape)

# NPM Scripts

- **`npm run clean`** - Remove dependencies and build artefacts
- **`npm run prime`** - Install dependencies from the lockfile
- **`npm run setup`** - Install dependencies and link sibling `@metreeca/*` repositories
- **`npm run build`** - Compile sources and generate docs
- **`npm run check`** - Run the test suite
- **`npm run proof`** - Serve live docs

> [!CAUTION]
> **`prime` and `setup` are not interchangeable.** Run `prime` when finalising a public release: `@metreeca/*` imports
> resolve to the published releases recorded in the lockfile. Run `setup` for local development against unpublished
> sibling branches: imports resolve to the working copies in the neighbouring repositories.
