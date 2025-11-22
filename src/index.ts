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
 * Logging framework providing a simplified facade over LogTape.
 *
 * Offers streamlined logger management for TypeScript/JavaScript applications with:
 *
 * - Hierarchical category derivation from `import.meta.url`
 * - Automatic zero-code logger setup for local codebase modules
 * - Simplified configuration with sensible defaults
 * - Utility functions for message formatting, execution timing, and error handling

 * **Category System**
 *
 * LogTape uses a hierarchical category system for organizing loggers. This module
 * automatically generates category arrays from `import.meta.url`, distinguishing
 * between internal project code and external dependencies:
 *
 * - **Internal modules** (project code):
 *
 *   - Prefixed with `"."` (for instance, `[".", "utils", "helper"]`)
 *
 * - **External modules** (from `node_modules/`):
 *
 *   - Non-scoped packages: Prefixed with `"@"` (for instance, `["@", "lodash", "map"]`)
 *   - Scoped packages: Inherently prefixed (for instance, `["@scope", "pkg", "module"]`)
 *
 * **Usage**
 *
 * ```typescript
 * import { log } from '@metreeca/core/logger';
 *
 * // Get logger for current module (auto-configures console logging for internal modules)
 *
 * const logger = log(import.meta.url);
 *
 * logger.info("Application started");
 * logger.debug("Processing request", { id: 123 });
 * logger.error("Failed to connect", error);
 *
 * // Configure logging levels (call once at startup)
 *
 * log({
 *
 *   // All internal code at debug level
 *   ".": "debug",
 *
 *   // Specific internal module at info level
 *   "./utils": "info"
 *
 *   // Specific external package at trace level
 *   "@/lodash": "trace",
 *
 * });
 * ```
 *
 * For advanced use cases, the {@link log} function accepts full LogTape configuration
 * objects with custom sinks, filters, and logger hierarchies.
 *
 * @see https://logtape.org/ LogTape documentation
 * @see https://logtape.org/manual/start LogTape configuration guide
 *
 * @module
 */

export * from "@logtape/logtape";

export * from "./facade";
export * from "./utilities";
