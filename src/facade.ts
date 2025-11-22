/*
 * Copyright © 2025 Metreeca srl
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
 * Simplified logging facade over LogTape.
 *
 * Provides the {@link log} function for logger retrieval and configuration with
 * automatic path-based categorization and zero-configuration defaults.
 *
 * @module
 */

import {
	Config,
	configureSync,
	getConfig,
	getConsoleSink,
	getLogger,
	type Logger,
	LoggerConfig
} from "@logtape/logtape";
import { isArray, isObject, isString } from "@metreeca/core";
import { category, internal } from "./category";


/**
 * Visual severity prefixes for log levels.
 *
 * Maps LogTape log levels to character sequences indicating severity.
 */
const prefixes = {
	"trace": "???",
	"debug": "??",
	"info": "?",
	"warning": "!",
	"error": "!!",
	"fatal": "!!!"
} as const;


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
 * Extracts a hierarchical category array from the path for logger categorization.
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
 *   and `"index"` segments are removed.
 *
 * - **Imported packages** (from `node_modules/`): Non-scoped packages prefixed with
 *   `"@"` (for instance, `["@", "lodash"]`), scoped packages use two segments (for instance,
 *   `["@metreeca", "post"]`). Build directories (`dist`, `lib`, `build`, `out`)
 *   and redundant package name folders are skipped. Extensions and `"index"`
 *   segments are removed from remaining paths.
 *
 * @param url File path or URL to create logger category from
 *
 * @returns Logger instance for the resolved category
 *
 * @example
 *
 * ```ts
 * const logger = log(import.meta.url);
 *
 * // file:///project/src/utils/logger.ts → [".", "utils", "logger"]
 * // node_modules/lodash/map.js → ["@", "lodash", "map"]
 * // node_modules/@metreeca/post/dist/index.js → ["@metreeca", "post"]
 * ```
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
 * Configures LogTape with category-to-level mappings.
 *
 * Configures LogTap with a single console logger using visual severity prefixes and a configuration derived from a
 * simplified representation mapping categories to minimum log levels:
 *
 * - Each key represents a LogTape category array as a slash-separated path, with `"."` prefix
 *   for internal project code and `"@"` prefix for external dependencies (for instance,
 *   `"./utils"` for category `[".", "utils"]` or `"@/lodash"` for `["@", "lodash"]`).
 *
 * - Each value specifies the minimum log level (`"trace"`, `"debug"`, `"info"`,
 *   `"warning"`, `"error"`, `"fatal"`); invalid levels are filtered out.
 *
 * @param config Path-to-level mapping for logger configuration
 */
export function log(config: Record<string, string>): void

/**
 * Configures LogTape with a complete configuration object.
 *
 * @typeParam S Sink identifier type
 * @typeParam F Filter identifier type
 *
 * @param config LogTape configuration object with sinks, filters, and loggers
 */
export function log<S extends string, F extends string>(config: Config<S, F>): void

export function log<S extends string, F extends string>(a?: unknown): unknown {

	if ( a === undefined ) {

		return getLogger();

	} else if ( isString(a) ) {

		const c = category(a);

		if ( c[0] === internal && getConfig() === null ) {
			configureSync(std({}));
		}

		return getLogger(c);

	} else if ( isArray<string>(a) ) {

		if ( a[0] === internal && getConfig() === null ) {
			configureSync(std({}));
		}

		return getLogger(a);

	} else if ( isObject(a) && Object.values(a).every(isString) ) {

		return configureSync(std(a as Record<string, string>));

	} else {

		return configureSync<S, F>(a as unknown as Config<S, F>);

	}

}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Creates a standard LogTape configuration with console sink and custom formatter.
 *
 * Configures console output with visual severity prefixes, suppresses LogTape
 * meta logger warnings, and applies path-to-level mappings from the provided config.
 *
 * @internal
 *
 * @param config Path-to-level mapping for logger configuration
 *
 * @returns LogTape configuration object with console sink
 */
function std(config: Record<string, string>): Config<"console", never> {
	return {

		sinks: {

			console: getConsoleSink({

				formatter: record => {

					const prefix = prefixes[record.level] ?? "?";
					const source = record.category.at(-1) ?? "";
					const message = record.message.map(String).join("");

					return [
						"%s %s %s",
						prefix.padStart(3),
						source.padEnd(20),
						message
					];

				}

			})

		},

		loggers: [

			{
				category: ["logtape", "meta"],
				lowestLevel: "warning",
				sinks: ["console"]
			},

			{
				category: ["."],
				lowestLevel: "info",
				sinks: ["console"]
			},

			...Object.entries(config)
				.filter(([, level]) => level in prefixes)
				.map(([path, level]) => <LoggerConfig<"console", never>>{
					category: path.split("/").filter(Boolean),
					lowestLevel: level as keyof typeof prefixes,
					sinks: ["console"]
				})

		]
	};
}
