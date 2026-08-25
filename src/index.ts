/*
 * Copyright © 2025-2026 Metreeca srl
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Simplified facade for the LogTape logging framework.
 *
 * Provides the {@link log} function for logger retrieval, LogTape configuration and function guarding, with categories
 * derived automatically from module paths and zero-configuration defaults for local code, the {@link time} function for
 * monitoring task execution, and the {@link report} function for formatting values as readable log content.
 *
 * @module index
 */

import { Config, ConfigError, configureSync, getConfig, getLogger, type Logger, type LogLevel } from "@logtape/logtape";
import { isArray, isError, isFunction, isNumber, isObject, isString } from "@metreeca/core";
import { clip, escape } from "@metreeca/core/strings";
import { equals } from "@metreeca/core/structures";
import { category, internal } from "./category.js";
import { defaults } from "./defaults.js";

export * from "@logtape/logtape";


/**
 * Matches the characters a quoted report may not carry as they are.
 *
 * Covers the quotation mark and the reverse solidus, which delimit and escape the report itself, and every character
 * that would otherwise reach the log without a visible glyph of its own:
 *
 * - control characters (`Cc`), line and paragraph separators (`Zl`, `Zp`) and space separators (`Zs`) other than the
 *   plain space, which would break the report across lines or pad it invisibly;
 * - format characters (`Cf`), which carry no glyph and may reorder the surrounding text;
 * - default ignorable code points, which render as nothing whatever their general category, catching the invisible
 *   letters (`U+115F`, `U+1160`, `U+3164`, `U+FFA0`) and marks (`U+034F`) the categories above miss;
 * - unassigned (`Cn`) and private use (`Co`) code points, whose rendering depends on the font rather than on Unicode;
 * - the blank braille pattern (`U+2800`), a symbol by general category that renders as whitespace;
 * - isolated surrogates, which denote no character at all: unicode matching folds a well-formed pair into the single
 *   supplementary code point it denotes, so only an unpaired half is matched.
 *
 * The zero width joiner and the variation selectors (`U+FE00`-`U+FE0F`, `U+E0100`-`U+E01EF`) are reported as they are:
 * none of them renders on its own, but each alters a visible neighbouring glyph, so escaping them would break composed
 * emoji and ideographic variants without revealing anything the rendered text doesn't already show.
 *
 * Combining marks are reported as they are as well, bar the default ignorable ones: they render as part of the
 * grapheme they attach to, and escaping them would make text in the scripts that require them illegible; a leading
 * mark attaches to the opening quotation mark of the report.
 *
 * Membership in the unassigned category tracks the Unicode version of the runtime, so a code point assigned after that
 * version is reported as an escape.
 */
const QuotePattern = new RegExp([
	"[\"\\\\\\p{Cc}\\p{Zl}\\p{Zp}\\p{Cn}\\p{Co}\\u2800\\uD800-\\uDFFF]",
	"[^\\P{Cf}\\u200D]",
	"[^\\P{Zs} ]",
	"[^\\P{Default_Ignorable_Code_Point}\\p{Variation_Selector}\\u200D]"
].join("|"), "gu");


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Last explicitly applied configuration argument.
 * `undefined` when unconfigured or autoconfigured; the original argument after explicit configuration.
 * Used to allow explicit configuration to override autoconfiguration and to silently skip
 * idempotent reconfiguration attempts.
 */
let custom: undefined | Record<string, LogLevel> | Config<string, string>;


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Retrieves the root logger instance.
 *
 * @returns The root logger with empty category
 */
export function log(): Logger;

/**
 * Retrieves a logger for the specified file path or URL.
 *
 * Extracts a hierarchical category array from the path for logger categorisation.
 *
 * Automatically configures LogTape on first use if the extracted category starts
 * with `"/"` (local code) and LogTape is not yet configured. Default configuration
 * includes console sink with visual severity prefixes, LogTape meta logger set to
 * `"warning"` level, and local code logger at `"info"` level.
 *
 * Path resolution:
 *
 * - **Local code** (your project): Category starts with `"/"`, followed by the package
 *   directory (the folder enclosing `src/`) and the segments after `src/`. If a URL is
 *   provided (for instance, `import.meta.url`), its pathname is parsed; when `src/` is absent
 *   the filename only is used and the package directory is omitted. Extensions are removed;
 *   `"index"` is preserved as an explicit segment so that `name.ts` and `name/index.ts` remain
 *   distinguishable. The package directory keeps modules from sibling packages in a monorepo distinct.
 *
 * - **Imported packages** (from `node_modules/`): Non-scoped packages start with the bare
 *   package name (for instance, `["lodash", "index"]` for a bare entry point); scoped
 *   packages use two segments (for instance, `["@metreeca", "post", "index"]`).
 *   Build directories (`dist`, `lib`, `build`, `out`) and redundant package name
 *   folders are skipped. Extensions are removed from remaining paths; `"index"` is
 *   preserved. Hierarchical matching means a filter at `lodash` still applies to
 *   `lodash/index`.
 *
 * @param url File path or URL to create logger category from
 *
 * @returns Logger instance for the resolved category
 */
export function log(url: string): Logger;

/**
 * Retrieves a logger for the specified category array.
 *
 * Automatically configures LogTape on first use if the category starts with `"/"`
 * and LogTape is not yet configured. Default configuration includes console sink
 * with visual severity prefixes, LogTape meta logger at `"warning"` level, and
 * local code logger at `"info"` level.
 *
 * @param category Hierarchical logger category segments
 *
 * @returns Logger instance for the specified category
 */
export function log(category: readonly string[]): Logger;

/**
 * Wraps a synchronous function with error handling and logging.
 *
 * Catches errors thrown by the function, logs them using the function's name
 * as logger category, and returns `undefined` instead of propagating the error.
 *
 * @typeParam T The tuple type of function arguments
 * @typeParam R The return type of the function
 *
 * @param f Function to wrap with error handling
 *
 * @returns Wrapped function that returns the original result or `undefined` on error
 */
export function log<T extends unknown[], R>(f: (...args: T) => R): (...args: T) => undefined | R;

/**
 * Configures LogTape with a complete configuration object.
 *
 * > [!TIP]
 * >
 * > Repeated calls with a deep-equal configuration are silently accepted (the `reset` flag is ignored
 * > for comparison purposes). Applying a different configuration throws unless `reset` is set to true.
 *
 * @typeParam S Sink identifier type
 * @typeParam F Filter identifier type
 *
 * @param config LogTape configuration object with sinks, filters, and loggers
 */
export function log<S extends string, F extends string>(config: Config<S, F>): void

/**
 * Configures LogTape with category-to-level mappings.
 *
 * Configures LogTape with a single console logger using visual severity prefixes and a configuration derived from a
 * simplified representation mapping categories to minimum {@link LogLevel | log levels}:
 *
 * - Each key represents a LogTape category in label form: `"/"` (all internal code), `"/utils"`
 *   (internal module), `"lodash"` (non-scoped package), `"@scope/pkg"` (scoped package). A
 *   trailing `/` targets the `index` module (for instance, `"/name/"` matches only `src/name/index.ts`).
 *
 * - Each value specifies the minimum {@link LogLevel} for the category.
 *
 * > [!TIP]
 * >
 * > Repeated calls with a deep-equal mapping are silently accepted. Applying a different configuration
 * > throws unless a full {@link Config} object with `reset` set to true is used.
 *
 * @param config Path-to-level mapping for logger configuration
 */
export function log(config: Record<string, LogLevel>): void

/**
 * Wraps an asynchronous function with error handling and logging.
 *
 * Catches errors thrown or rejected by the function, logs them using the
 * function's name as logger category, and returns `undefined` instead of
 * propagating the error.
 *
 * @typeParam T The tuple type of function arguments
 * @typeParam R The return type of the function
 *
 * @param f Async function to wrap with error handling
 *
 * @returns Wrapped function that returns a promise resolving to the original result or `undefined` on error
 */
export function log<T extends unknown[], R>(f: (...args: T) => Promise<R>): (...args: T) => Promise<undefined | R>;

/**
 * Retrieves loggers, configures LogTape, and guards functions.
 */
export function log<S extends string, F extends string>(a?: unknown): unknown {

	if ( a === undefined ) { // get root logger

		return get();

	} else if ( isString(a) ) { // get logger by URL/path

		return get(category(a));

	} else if ( isArray<string>(a) ) { // get logger by category

		return get(a);

	} else if ( isFunction(a) ) { // wrap function with error handling

		return guard(a as (...args: unknown[]) => unknown);

	} else if ( isObject(a) && Object.values(a).every(isString) ) { // configure with path-to-level map

		return configure(a as Record<string, LogLevel>, defaults(a as Record<string, LogLevel>));

	} else { // configure with full config object

		return configure(a as Config<S, F>, a as Config<S, F>);

	}


	function get(category: readonly string[] = []) {

		if ( category[0] === internal && getConfig() === null && custom === undefined ) {
			configureSync(defaults({}));
		}

		return getLogger(category);
	}

	function guard(f: (...args: unknown[]) => unknown) {

		const logger = log(import.meta.url).getChild(f.name);

		return (...args: unknown[]) => {
			try {

				const result = f(...args);

				if ( result instanceof Promise ) {

					return result.catch(error => {

						logger.error(message(error));

						return undefined;

					});

				} else {

					return result;

				}

			} catch ( error ) {

				logger.error(message(error));

				return undefined;

			}
		};


		function message(error: unknown): string {
			return isError(error) ? error.message : String(error);
		}

	}

	function configure<S extends string, F extends string>(
		source: Record<string, LogLevel> | Config<S, F>,
		config: Config<S, F>
	) {

		const configured = getConfig() !== null;

		if ( !configured // unconfigured or externally reset
			|| custom === undefined // no prior custom config
			|| source.reset === true // explicit reset requested
		) {

			configureSync<S, F>({
				...config,
				reset: configured
			});

			custom = source;

		} else if ( !equals({ ...source, reset: undefined }, { ...custom, reset: undefined }) ) {

			throw new ConfigError("expected matching configuration or explicit reset");

		}

	}

}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Executes an asynchronous task and monitors its execution time.
 *
 * Measures elapsed time from invocation until promise resolution.
 *
 * @typeParam T The type of value returned by the task
 *
 * @param task Function returning a promise to be timed
 * @param monitor Callback invoked with the result value and elapsed time in milliseconds
 *
 * @returns A promise resolving to the task's return value
 *
 * @throws Any error thrown by the task (monitor is not called on error)
 */
export function time<T>(task: () => Promise<T>, monitor: (value: T, elapsed: number) => void): Promise<T>;

/**
 * Executes a synchronous task and monitors its execution time.
 *
 * Measures elapsed time from invocation until completion.
 *
 * @typeParam T The type of value returned by the task
 *
 * @param task Function returning a value to be timed
 * @param monitor Callback invoked with the result value and elapsed time in milliseconds
 *
 * @returns The task's return value
 *
 * @throws Any error thrown by the task (monitor is not called on error)
 */
export function time<T>(task: () => T, monitor: (value: T, elapsed: number) => void): T;

/**
 * Executes a task (sync or async) and monitors its execution time.
 *
 * @internal
 */
export function time<T>(task: () => T | Promise<T>, monitor: (value: T, elapsed: number) => void): T | Promise<T> {

	const start = Date.now();

	const value = task();

	if ( value instanceof Promise ) {

		return value.then(resolved => {

			monitor(resolved, Date.now()-start);

			return resolved;

		});

	} else {

		monitor(value, Date.now()-start);

		return value;

	}

}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Formats a value as a readable report.
 *
 * Reports numbers with grouped digits, strings as quoted literals with their invisible characters surfaced as escapes,
 * errors through their message, functions through their name, and every other value through its string representation.
 *
 * **Numbers**
 *
 * Numbers are formatted with the digit grouping of the `en-US` locale, whatever the ambient locale, so that reports of
 * the same value are comparable across systems.
 *
 * **Strings**
 *
 * String content is delimited by quotation marks, so leading and trailing whitespace is bounded and its extent is
 * unambiguous, and is escaped so that nothing it carries can hide from the log or corrupt it: the quotation mark and
 * the reverse solidus, which would otherwise close or escape the literal, and every character with no visible glyph
 * of its own, that is control characters, line and paragraph separators, space separators other than the plain space,
 * format characters, default ignorable code points whatever their general category, unassigned and private use code
 * points, the blank braille pattern and isolated surrogates. Escapes take the two-character JSON form where one is
 * defined (`\"`, `\\`, `\b`, `\f`, `\n`, `\r`, `\t`) and the `\uXXXX` / `\UXXXXXXXX` numeric form otherwise.
 *
 * The zero width joiner, the variation selectors and the combining marks are reported as they are: none of them
 * renders on its own, but each alters a visible neighbouring glyph, so escaping them would break composed emoji,
 * ideographic variants and the scripts that require marks, without revealing anything the rendered text doesn't
 * already show. A leading mark attaches to the opening quotation mark of the report.
 *
 * **Errors**
 *
 * Errors are reported through their message, without the class name their string representation would prefix it with:
 * the level and the context of the log entry already state that a failure is being reported. Messages are composed by
 * the throwing code rather than carried in from the outside, so they are reported as they are, neither delimited,
 * escaped nor clipped: report the offending values separately where their extent or their invisible content matters.
 *
 * **Functions**
 *
 * Functions are reported through their name followed by an empty argument list, classes and other callable values
 * included, rather than through the source text their string representation would expose: the name identifies the
 * function in the code, while its body would bury the log entry under content that belongs to the source. Names are
 * code-defined, so they are reported as they are, neither escaped nor clipped. Anonymous functions, whose name is
 * empty because no declaration, binding or property definition supplied one, take the `function` keyword in place of a
 * name and are reported as `function()`.
 *
 * **Other Values**
 *
 * Every other value is reported through its string representation, error-like values that are not `Error` instances
 * included, whatever message-like properties they may carry.
 *
 * @param value The value to report
 * @param length The maximum length in code points of the reported string content, counted before escaping; longer
 *     content is clipped, with the last retained code point replaced by an ellipsis; `0` or a negative value disables
 *     clipping; ignored for values other than strings; defaults to `0`
 *
 * @returns The formatted number, quoted and escaped string literal, error message, function name with an empty
 *     argument list, or string representation of `value`
 */
export function report(value: unknown, length?: number): string {

	return isNumber(value) ? value.toLocaleString("en-US")
		: isString(value) ? `"${escape(clip(value, length), QuotePattern)}"`
			: isError(value) ? value.message
				: isFunction(value) ? `${value.name || "function"}()`
					: String(value);

}
