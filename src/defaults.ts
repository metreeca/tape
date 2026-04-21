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

import { type Config, getConsoleSink, type LoggerConfig, type LogLevel } from "@logtape/logtape";
import { label } from "./category.js";

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
 * Creates a default LogTape configuration with console sink and custom formatter.
 *
 * Configures console output with visual severity prefixes, suppresses LogTape
 * meta logger warnings, and applies category-to-{@link LogLevel | level} mappings from the provided `config`.
 *
 * @internal
 *
 * @param config Category-to-{@link LogLevel | level} mapping for logger configuration
 *
 * @returns LogTape configuration object with console sink
 */
export function defaults(config: Record<string, LogLevel>): Config<"console", never> {

	return {

		sinks: {

			console: getConsoleSink({

				formatter: record => {

					const prefix = prefixes[record.level] ?? "?";
					const source = label(record.category);
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

		loggers: <LoggerConfig<"console", never>[]>[

			...("logtape/meta" in config ? [] : [{
				category: ["logtape", "meta"],
				lowestLevel: "warning",
				sinks: ["console"]
			}]),

			...("." in config ? [] : [{
				category: ["."],
				lowestLevel: "info",
				sinks: ["console"]
			}]),

			...Object.entries(config).map(([path, level]) => ({
				category: path.split("/").filter(Boolean),
				lowestLevel: level,
				sinks: ["console"]
			}))

		]

	};

}
