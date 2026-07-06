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
 * Path normalization for logger hierarchies.
 *
 * Converts file URLs and path segments into canonical logger paths, distinguishing
 * between project code and imported dependencies.
 *
 * @internal
 * @module
 */

const roots = new Set(["dist", "lib", "build", "out"]);


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Marker segment for project-local code categories.
 *
 * Internal logger categories start with this segment to distinguish project code
 * from external dependencies in logger hierarchies.
 *
 * @example
 * ```ts
 * ["/", "tape", "utils", "helper"]  // Project module tape/src/utils/helper.ts
 * ["/"]                             // All internal code
 * ```
 */
export const internal = "/";

/**
 * Prefix character identifying scoped npm package segments.
 *
 * Scoped packages start with this character in their first category segment
 * (e.g. `"@scope"` in `["@scope", "pkg"]`). Non-scoped packages have no marker —
 * the package name is the first category segment.
 *
 * @example
 * ```ts
 * ["lodash", "map"]        // Non-scoped package (bare name)
 * ["@scope", "pkg", "utils"] // Scoped package
 * ```
 */
export const external = "@";


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Normalizes a URL or path into hierarchical logger category segments.
 *
 * Implementation details:
 *
 * - URIs with any scheme (file://, http://, data:, etc.) are parsed and pathname extracted
 * - node_modules paths: Extract package identifier (bare name for non-scoped, scope + name for scoped)
 * - Local code: Prefix with `"/"`, then the package directory (the segment immediately preceding the
 *   root directory), then the segments after the root directory (default root: `"src"`). The package
 *   directory is omitted when the root is absent or is itself the leading segment.
 * - Cleaning: Remove extensions, filter empty segments; `"index"` is preserved as an explicit
 *   segment to distinguish sibling modules (e.g., `name.ts` vs `name/index.ts`)
 * - Build directories (`dist`, `lib`, `build`, `out`) are skipped
 *
 * @internal
 *
 * @param url A URI with any scheme, or plain path string
 * @param root Root directory name for project code (default: `"src"`)
 *
 * @returns Array of category segments for hierarchical logger naming
 *
 * @see {@link log} for user-facing path resolution behavior
 */
export function category(url: string, root = "src"): readonly string[] {

	const path = url.match(/^(?:\w+:)?(?:\/\/[^/]*)?(.*)$/)![1];
	const segments = path.split("/");
	const modules = segments.indexOf("node_modules");

	return modules >= 0
		? imported(segments.slice(modules+1))
		: exported(segments, root);

}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Parses a filter config key into a category array.
 *
 * The key format mirrors the log label convention:
 *
 * - `""` → `[]` (root catch-all)
 * - `"/"` → `["/"]` (all internal code)
 * - `"/utils"` → `["/", "utils"]` (internal module)
 * - `"/utils/helper"` → `["/", "utils", "helper"]` (nested internal module)
 * - `"lodash"` → `["lodash"]` (non-scoped package)
 * - `"lodash/map"` → `["lodash", "map"]` (non-scoped package module)
 * - `"@scope/pkg"` → `["@scope", "pkg"]` (scoped package)
 * - `"@scope/pkg/utils"` → `["@scope", "pkg", "utils"]` (scoped package module)
 *
 * A trailing `/` appends an explicit `"index"` segment (e.g. `"/name/"` →
 * `["/", "name", "index"]`, `"lodash/"` → `["lodash", "index"]`).
 *
 * @internal
 *
 * @param key Filter config key in label form
 *
 * @returns Hierarchical category segments
 */
export function parse(key: string): readonly string[] {

	const prefix = key.startsWith("/") ? [internal] : [];
	const trailing = key !== "/" && key.endsWith("/") ? ["index"] : [];
	const parts = key.replace(/\/$/, "").split("/").filter(s => s);

	return [...prefix, ...parts, ...trailing];

}

/**
 * Builds path segments for imported npm packages.
 *
 * Extracts package identifier, removes build directories and redundant package names,
 * then cleans remaining segments.
 *
 * @param segments Path segments after "node_modules" in the file path
 *
 * @returns Array starting with the bare package name (for non-scoped) or scope + name
 * (for scoped), followed by cleaned module path segments
 */
function imported(segments: string[]): readonly string[] {

	const scoped = segments[0]?.startsWith(external);
	const module = scoped ? 2 : 1;

	const packageId = segments.slice(0, module); // package id (e.g., "pkg" or "@scope/core")
	const packageName = packageId.at(-1)!; // last part of package id (e.g., "core" from "@scope/core")

	// skip build directory if present, then skip redundant package name if present

	const buildOffset = roots.has(segments[module]) ? 1 : 0;
	const nameOffset = segments[module+buildOffset] === packageName ? 1 : 0;

	const category = clean(segments.slice(module+buildOffset+nameOffset));

	return [...packageId, ...category];

}

/**
 * Builds project-relative path segments with the {@link internal} prefix.
 *
 * When the root directory is found, prepends the package directory (the segment immediately preceding
 * the root) followed by the segments after the root. The package directory is omitted when the root is
 * the leading segment. When the root is absent, returns only the last segment as a fallback.
 *
 * @param segments Path segments to process
 * @param root Root directory name to search for (typically "src")
 *
 * @returns Array starting with the internal marker, the package directory (when available), and the
 * cleaned module path segments
 */
function exported(segments: string[], root: string): readonly string[] {

	const cleaned = clean(segments);
	const codebase = cleaned.indexOf(root);

	const pkg = codebase >= 1 ? cleaned.slice(codebase-1, codebase) : [];
	const modules = codebase >= 0 ? cleaned.slice(codebase+1) : cleaned.slice(-1);

	return [internal, ...pkg, ...modules];
}


/**
 * Renders a category array as a human-readable log label.
 *
 * Format:
 *
 * - **Internal modules** (category starts with `"/"`): leading `/`, then module
 *   segments joined by `/`. A trailing `index` segment collapses to a trailing `/`.
 *   The root `["/", "index"]` renders as `/`.
 *
 * - **External packages** (category starts with a bare package name or a `"@scope"`
 *   segment): package name followed by `:module` when a non-index module path is
 *   present. A module path of `index` renders the package with a trailing `/` (e.g.
 *   `lodash/`). A trailing `/index` inside a multi-segment module path collapses to
 *   a trailing `/` (e.g. `@scope/pkg:utils/`).
 *
 * @internal
 *
 * @param category Hierarchical logger category segments
 *
 * @returns Human-readable label suitable for log display
 */
export function label(category: readonly string[]): string {

	const segments = category.filter(s => s);

	if ( segments[0] === internal ) {

		const module = segments.slice(1).join("/").replace(/(^|\/)index$/, "$1");

		return `/${module}`;

	} else {

		const scoped = segments[0]?.startsWith(external);
		const pkg = scoped ? `${segments[0]}/${segments[1]}` : segments[0] ?? "";
		const module = segments.slice(scoped ? 2 : 1).join("/");

		if ( module === "" ) {
			return pkg;
		} else if ( module === "index" ) {
			return `${pkg}/`;
		} else {
			return `${pkg}:${module.replace(/\/index$/, "/")}`;
		}

	}

}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Cleans and filters path segments.
 *
 * Splits segments on "/", removes file extensions and trailing slashes,
 * filters out empty segments. The `"index"` segment is preserved to
 * distinguish sibling modules (e.g., `name.ts` vs `name/index.ts`).
 *
 * @param segments Path segments to clean
 *
 * @returns Filtered array of cleaned segments
 */
function clean(segments: readonly string[]): readonly string[] {
	return segments
		.flatMap(s => s.split("/"))
		.map(s => s.replace(/(?:\.\w+)*\/*$/, ""))
		.filter(s => s);
}
