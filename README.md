# @metreeca/tape

[![npm](https://img.shields.io/npm/v/@metreeca/tape)](https://www.npmjs.com/package/@metreeca/tape)

A simplified TypeScript facade for the [LogTape](https://logtape.org/) logging framework.

**@metreeca/tape** provides an opinionated, easy-to-use logging facade for TypeScript/JavaScript applications. It
streamlines LogTape configuration with automatic zero-code logger setup for local codebase modules and built-in error
handling for safe function execution. Key features include:

- **Hierarchical Categories**: automatic category derivation from `import.meta.url`
- **Zero-Code Setup**: auto-configures console logging for internal project modules
- **Simplified Configuration**: sensible defaults with easy level management
- **Function Guarding**: automatic error logging with safe fallback to `undefined`

# Installation

```shell
npm install @metreeca/tape
```

> [!WARNING]
>
> TypeScript consumers must use `"moduleResolution": "nodenext"/"node16"/"bundler"` in `tsconfig.json`.
> The legacy `"node"` resolver is not supported.

# Usage

> [!NOTE]
>
> This section introduces essential concepts and common patterns: see the
> [API reference](https://metreeca.github.io/tape/) for complete coverage.

## Getting Loggers

Retrieve logger instances for different scopes.

LogTape uses a [hierarchical category system](https://logtape.org/manual/categories) for organizing loggers;
**@metreeca/tape** automatically generates category arrays from `import.meta.url`, distinguishing between internal
project code and external dependencies:

- **Internal modules** (project code):
	- First segment is `"/"` (e.g., `["/", "utils", "helper"]`)
	- Extracted from paths after `src/` directory
	- Auto-configures console logging at `"info"` level on first use

- **External modules** (from `node_modules/`):
	- Non-scoped packages: bare package name (e.g., `["lodash", "map"]`)
	- Scoped packages: scope + name (e.g., `["@metreeca", "pipe", "feeds"]`)
	- Skips build directories (`dist`, `lib`, `build`, `out`)

| File Path                                   | Category                         |
|---------------------------------------------|----------------------------------|
| `file:///project/src/utils/logger.ts`       | `["/", "utils", "logger"]`       |
| `file:///project/src/utils/index.ts`        | `["/", "utils", "index"]`        |
| `node_modules/lodash/map.js`                | `["lodash", "map"]`              |
| `node_modules/@metreeca/pipe/dist/index.js` | `["@metreeca", "pipe", "index"]` |

`"index"` is preserved as an explicit segment so that `name.ts` and `name/index.ts` resolve to distinct categories
(`["/", "name"]` vs `["/", "name", "index"]`). LogTape's hierarchical matching means a filter at `/name` or
`@metreeca/pipe` still applies to nested `index` loggers.

```typescript
import { log } from '@metreeca/tape';

// Get logger for current module (auto-configures console logging on first use)

const logger = log(import.meta.url);

logger.info("Application started");
logger.debug("Processing request", { id: 123 });
logger.error("Failed to connect", error);

// Use category arrays directly for more control

const custom = log(["/", "custom", "category"]);

custom.info("Message from custom category");

// Access the root logger without any category

const root = log();

root.info("Message from root logger");
```

## Guarding Functions

Wrap functions with automatic error logging and safe fallback to `undefined`:

```typescript
// Wrap async functions

const safeOperation = log(async (data: string) => {
	return await riskyOperation(data); // This might throw
});

// Returns undefined if error occurs, logs error automatically

const result = await safeOperation("input");

// Also works with synchronous functions

const safeParse = log((json: string) => JSON.parse(json));

const data = safeParse("invalid json"); // Returns undefined, logs error
```

## Configuring LogTape

Configure logging levels using simple category-to-[`LogLevel`](https://jsr.io/@logtape/logtape/doc/~/LogLevel)
mappings.

Keys mirror the log label convention: `"/"` for all internal code, `"/module"` for a specific internal module, a bare
package name for non-scoped packages, and `"@scope/name"` for scoped packages. A trailing `/` targets the `index`
module specifically. Values are type-safe `LogLevel` strings (`"trace"`, `"debug"`, `"info"`, `"warning"`, `"error"`,
`"fatal"`):

```typescript
log({
	"/": "info",               // All internal code
	"/utils": "debug",         // Specific internal module
	"lodash": "trace",         // Specific non-scoped package
	"@metreeca/pipe": "debug"  // Specific scoped package
});
```

Both configuration forms are idempotent: repeated calls with a deep-equal configuration are silently accepted, while
applying a different configuration throws unless the full `Config` form is used with `reset` set to `true`.

For advanced use cases, pass a complete LogTape `Config` object:

```typescript
import { getConsoleSink } from '@metreeca/tape';

log({
	sinks: {
		console: getConsoleSink(),
		file: getFileSink("app.log")
	},
	loggers: [
		{
			category: ["/"],
			lowestLevel: "debug",
			sinks: ["console", "file"]
		}
	]
});
```

# Support

- open an [issue](https://github.com/metreeca/tape/issues) to report a problem or to suggest a new feature
- start a [discussion](https://github.com/metreeca/tape/discussions) to ask a how-to question or to share an idea

# License

This project is licensed under the Apache 2.0 License –
see [LICENSE](https://github.com/metreeca/tape?tab=Apache-2.0-1-ov-file) file for details.
