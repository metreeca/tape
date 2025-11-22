# @metreeca/tape

[![npm](https://img.shields.io/npm/v/@metreeca/tape)](https://www.npmjs.com/package/@metreeca/tape)

A simplified TypeScript facade for the [LogTape](https://logtape.org/) logging framework.

**@metreeca/tape** provides an opinionated, easy-to-use logging facade for TypeScript/JavaScript applications. It
streamlines LogTape configuration with automatic zero-code logger setup for local codebase modules and utility functions
for common logging tasks. Key features include:

- **Hierarchical categories** / Automatic category derivation from `import.meta.url`
- **Zero-code setup** / Auto-configures console logging for internal project modules
- **Simplified configuration** / Sensible defaults with easy level management
- **Utility functions** / Message formatting, execution timing, and error handling

# Installation

```shell
npm install @metreeca/tape
```

> [!WARNING]
>
> TypeScript consumers must use `"moduleResolution": "bundler"` (or `"node16"`/`"nodenext"`) in `tsconfig.json`.
> The legacy `"node"` resolver is not supported.

# Usage

> [!NOTE]
>
> This section introduces essential concepts and common patterns: see the
> [API reference](https://metreeca.github.io/tape/) for complete coverage.

## Getting Started

```typescript
import { log } from '@metreeca/tape';

// Get logger for current module (auto-configures console logging on first use)

const logger = log(import.meta.url);

logger.info("Application started");
logger.debug("Processing request", { id: 123 });
logger.error("Failed to connect", error);

// Use category arrays directly for more control

const custom = log([".", "custom", "category"]);

custom.info("Message from custom category");

// Access the root logger without any category

const root = log();

root.info("Message from root logger");
```

## Categories

LogTape uses a hierarchical category system for organizing loggers. **@metreeca/tape** automatically generates category
arrays from `import.meta.url`, distinguishing between internal project code and external dependencies:

- **Internal modules** (project code):
  - Prefixed with `"."` (e.g., `[".", "utils", "helper"]`)
  - Extracted from paths after `src/` directory
  - Auto-configures console logging at `"info"` level on first use

- **External modules** (from `node_modules/`):
  - Non-scoped packages: Prefixed with `"@"` (e.g., `["@", "lodash", "map"]`)
  - Scoped packages: Inherently prefixed (e.g., `["@metreeca", "pipe", "feeds"]`)
  - Skips build directories (`dist`, `lib`, `build`, `out`)

| File Path                                   | Category                   |
|---------------------------------------------|----------------------------|
| `file:///project/src/utils/logger.ts`       | `[".", "utils", "logger"]` |
| `node_modules/lodash/map.js`                | `["@", "lodash", "map"]`   |
| `node_modules/@metreeca/pipe/dist/index.js` | `["@metreeca", "pipe"]`    |

## Configuration

Configure logging levels once at application startup. The `log()` function accepts simple path-to-level mappings:

```typescript
log({
	".": "debug",        // All internal code at debug level
	"./utils": "info",   // Specific internal module at info level
	"@/lodash": "trace"  // Specific external package at trace level
});
```

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
			category: ["."],
			lowestLevel: "debug",
			sinks: ["console", "file"]
		}
	]
});
```

## Utilities

### Message Extraction

Extract readable messages from unknown values:

```typescript
import { message } from '@metreeca/tape';

message(new Error("Failed"));  // "Failed"
message(1234.56);              // "1,234.56"
message("Custom message");     // "Custom message"
```

### Execution Timing

Monitor execution time of synchronous or async operations:

```typescript
import { time } from '@metreeca/tape';

// Async operation

await time(
	async () => fetch("/api/data"),
	(result, elapsed) => logger.info(`Fetched in ${elapsed}ms`)
);

// Sync operation

const result = time(
	() => expensiveComputation(),
	(value, elapsed) => logger.debug(`Computed in ${elapsed}ms`)
);
```

### Error Handling

Wrap functions with automatic error logging and safe fallback to `undefined`:

```typescript
import { guard } from '@metreeca/tape';

const safeOperation = guard(async (data: string) => {
	return await riskyOperation(data); // This might throw
});

// Returns undefined if error occurs, logs error automatically

const result = await safeOperation("input");
```

# Support

- open an [issue](https://github.com/metreeca/tape/issues) to report a problem or to suggest a new feature
- start a [discussion](https://github.com/metreeca/tape/discussions) to ask a how-to question or to share an idea

# License

This project is licensed under the Apache 2.0 License –
see [LICENSE](https://github.com/metreeca/tape?tab=Apache-2.0-1-ov-file) file for details.
