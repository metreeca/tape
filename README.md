# @metreeca/tape

[![npm](https://img.shields.io/npm/v/@metreeca/tape)](https://www.npmjs.com/package/@metreeca/tape)

Simplified facade for the [LogTape](https://logtape.org/) logging framework.

**@metreeca/tape** provides an opinionated, easy-to-use logging facade for TypeScript/JavaScript applications. It
streamlines LogTape configuration with automatic zero-code logger setup for local codebase modules and built-in error
handling for safe function execution. Key features include:

- **Simplified Configuration**: sensible defaults with easy level management
- **Hierarchical Categories**: automatic category derivation from `import.meta.url`
- **Zero-Code Setup**: auto-configures console logging for internal project modules
- **Function Guarding**: automatic error logging with safe fallback to `undefined`
- **Task Timing**: elapsed-time monitoring for synchronous and asynchronous tasks
- **Value Reporting**: readable value formatting, with invisible characters surfaced as escapes

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

Every logger is identified by a **category**, that is, a path locating the emitting module inside LogTape's
[hierarchical category system](https://logtape.org/manual/categories). **@metreeca/tape** derives categories
automatically from `import.meta.url`: internal project modules are rooted at `"/"`, modules loaded from `node_modules/`
at their package name.

Categories are written either as arrays, when looking up loggers, or in **label form**, when configuring levels: `"/"`
for all internal code, `"/module"` for a specific internal module, `"lodash"` for a non-scoped package, and
`"@scope/name"` for a scoped one.

## Configuring LogTape

Configure logging levels using simple category-to-[`LogLevel`](https://jsr.io/@logtape/logtape/doc/~/LogLevel)
mappings.

Keys are category labels, with a trailing `/` targeting the `index` module specifically (for instance, `"/name/"`
matches only `src/name/index.ts`). Values are type-safe `LogLevel` strings (`"trace"`, `"debug"`, `"info"`,
`"warning"`, `"error"`, `"fatal"`):

```typescript
import { log } from '@metreeca/tape';

log({
	"/": "info",               // All internal code
	"/utils": "debug",         // Specific internal module
	"lodash": "trace",         // Specific non-scoped package
	"@metreeca/flow": "debug"  // Specific scoped package
});
```

For advanced use cases, pass a complete LogTape `Config` object:

```typescript
import { getFileSink } from '@logtape/file';
import { getConsoleSink, log } from '@metreeca/tape';

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

The file sink lives in the separate [`@logtape/file`](https://www.npmjs.com/package/@logtape/file) package; only
LogTape's core exports are re-exported by **@metreeca/tape**.

Both configuration forms are idempotent: repeated calls with a deep-equal configuration are silently accepted, while
applying a different configuration throws unless the full `Config` form is used with `reset` set to `true`.

## Getting Loggers

Retrieve logger instances for different scopes.

Category arrays are generated from `import.meta.url`, distinguishing between internal project code and external
dependencies:

- **Internal modules** (project code):
	- First segment is `"/"`, followed by the package directory and the path after `src/`
	  (e.g., `["/", "project", "utils", "helper"]`)
	- The package directory (the folder enclosing `src/`) keeps sibling packages in a monorepo distinct
	- Auto-configures console logging at `"info"` level on first use

- **External modules** (from `node_modules/`):
	- Non-scoped packages: bare package name (e.g., `["lodash", "map"]`)
	- Scoped packages: scope + name (e.g., `["@metreeca", "flow", "feeds"]`)
	- Skips build directories (`dist`, `lib`, `build`, `out`)

| File Path                                   | Category                              |
|---------------------------------------------|---------------------------------------|
| `file:///project/src/utils/logger.ts`       | `["/", "project", "utils", "logger"]` |
| `file:///project/src/utils/index.ts`        | `["/", "project", "utils", "index"]`  |
| `node_modules/lodash/map.js`                | `["lodash", "map"]`                   |
| `node_modules/@metreeca/flow/dist/index.js` | `["@metreeca", "flow", "index"]`      |

`"index"` is preserved as an explicit segment so that `name.ts` and `name/index.ts` resolve to distinct categories
(`["/", "project", "name"]` vs `["/", "project", "name", "index"]`). LogTape's hierarchical matching means a filter at
`/project/name` or `@metreeca/flow` still applies to nested `index` loggers.

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

## Timing Tasks

Measure the execution time of synchronous or asynchronous tasks, reporting the result value and the elapsed
milliseconds to a monitor callback:

```typescript
import { log, time } from '@metreeca/tape';

const logger = log(import.meta.url);

// Async tasks are timed until the promise resolves

const users = await time(
	() => fetchUsers(),
	(value, elapsed) => logger.info(`fetched ${value.length} users in ${elapsed} ms`)
);

// Sync tasks are timed until the call returns

const summary = time(
	() => render(users),
	(value, elapsed) => logger.debug(`rendered summary in ${elapsed} ms`)
);
```

The task's return value is passed through unchanged. Errors propagate to the caller and the monitor is not invoked.

## Reporting Values

Format values for inclusion in log messages, bounding their extent and surfacing the characters that wouldn't otherwise
be visible in the log:

```typescript
import { log, report } from '@metreeca/tape';

const logger = log(import.meta.url);

// Numbers are formatted with grouped digits

logger.info(`imported ${report(1234567)} records`); // imported 1,234,567 records

// Strings are quoted, bounding whitespace and surfacing invisible characters as escapes

logger.warning(`unknown tag ${report("tag\n")}`); // unknown tag "tag\n"

// Overlong content is clipped to a maximum number of code points

logger.debug(`request body ${report(body, 40)}`);

// Errors are reported through their message

logger.error(`import failed / ${report(error)}`); // import failed / connection refused

// Functions are reported through their name

logger.debug(`retrying ${report(fetchUsers)}`); // retrying fetchUsers()
```

Numbers are formatted with grouped digits, strings are reported as quoted literals, errors through their message,
functions through their name, and any other value through its string representation.

Digit grouping follows the `en-US` locale, whatever the ambient locale, so that reports of the same value are
comparable across systems.

Quotation marks bound leading and trailing whitespace, so the extent of the reported string content is unambiguous.
Every character that would otherwise close the literal or reach the log without a visible glyph of its own is escaped,
so that nothing in the content can hide or corrupt it: escapes take the two-character JSON form where one is defined
(`\"`, `\\`, `\b`, `\f`, `\n`, `\r`, `\t`) and the `\uXXXX` / `\UXXXXXXXX` numeric form otherwise. Characters that
render as part of a neighbouring glyph, like the combining marks and the variation selectors, are reported as they are.

The optional `length` argument clips overlong string content to a maximum number of code points, counted before
escaping, replacing the last retained one with an ellipsis.

Error messages are reported without the class name their string representation would prefix them with, as the level and
the context of the log entry already state that a failure is being reported. They are reported as they are, neither
delimited, escaped nor clipped: report the offending values separately where their extent or their invisible content
matters.

Functions are reported through their name followed by an empty argument list, classes and other callable values
included, rather than through the source text their string representation would expose. Names are reported as they are,
neither escaped nor clipped; anonymous functions take the `function` keyword in place of a name and are reported as
`function()`.

# Support

- open an [issue](https://github.com/metreeca/tape/issues) to report a problem or to suggest a new feature
- start a [discussion](https://github.com/metreeca/tape/discussions) to ask a how-to question or to share an idea

# License

This project is licensed under the Apache 2.0 License –
see [LICENSE](https://github.com/metreeca/tape?tab=Apache-2.0-1-ov-file) file for details.
