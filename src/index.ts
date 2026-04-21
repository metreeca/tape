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
 * Provides the {@link log} function for logger retrieval, configuration, and
 * function guarding with automatic path-based categorisation and zero-configuration
 * defaults.
 *
 * @module
 */

import { Config, ConfigError, configureSync, getConfig, getLogger, type Logger, type LogLevel } from "@logtape/logtape";
import { isArray, isFunction, isObject, isString } from "@metreeca/core";
import { message } from "@metreeca/core/report";
import { equals } from "@metreeca/core/deep";
import { category, internal } from "./category.js";
import { defaults } from "./defaults.js";


export * from "@logtape/logtape";


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
 * with `"."` (local code) and LogTape is not yet configured. Default configuration
 * includes console sink with visual severity prefixes, LogTape meta logger set to
 * `"warning"` level, and local code logger at `"info"` level.
 *
 * Path resolution:
 *
 * - **Local code** (your project): Paths prefixed with `"."`. If URL provided
 *   (for instance, `import.meta.url`), pathname is parsed and segments after `src/`
 *   directory are extracted (or filename only if `src/` not found). Extensions
 *   are removed; `"index"` is preserved as an explicit segment so that
 *   `name.ts` and `name/index.ts` remain distinguishable.
 *
 * - **Imported packages** (from `node_modules/`): Non-scoped packages prefixed with
 *   `"@"` (for instance, `["@", "lodash", "index"]` for a bare entry point), scoped
 *   packages use two segments (for instance, `["@metreeca", "post", "index"]`).
 *   Build directories (`dist`, `lib`, `build`, `out`) and redundant package name
 *   folders are skipped. Extensions are removed from remaining paths; `"index"` is
 *   preserved. Hierarchical matching means a filter at `@/lodash` still applies to
 *   `@/lodash/index`.
 *
 * @param url File path or URL to create logger category from
 *
 * @returns Logger instance for the resolved category
 */
export function log(url: string): Logger;

/**
 * Retrieves a logger for the specified category array.
 *
 * Automatically configures LogTape on first use if the category starts with `"."`
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
 * - Each key represents a LogTape category array as a slash-separated path, with `"."` prefix
 *   for internal project code and `"@"` prefix for external dependencies (for instance,
 *   `"./utils"` for category `[".", "utils"]` or `"@/lodash"` for `["@", "lodash"]`).
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

}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
