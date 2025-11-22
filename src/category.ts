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
 * Marker prefix for project-local code categories.
 *
 * Used to distinguish project code from external dependencies in logger hierarchies.
 *
 * @example
 * ```ts
 * "./module"  // Project code
 * ```
 */
export const internal = ".";

/**
 * Marker prefix for external dependency categories.
 *
 * Used to distinguish project code from external dependencies in logger hierarchies.
 *
 * @example
 * ```ts
 * "@/pkg/module"  // External dependency (non-scoped package)
 * "@scope/pkg"    // External dependency (scoped package, inherently prefixed)
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
 * - node_modules paths: Extract package identifier, prefix non-scoped packages with `"@"`
 * - Local code: Prefix with `"."`, extract segments after root directory (default: `"src"`)
 * - Cleaning: Remove extensions, filter empty/`"index"` segments
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
 * Builds path segments for imported npm packages.
 *
 * Extracts package identifier, removes build directories and redundant package names,
 * then cleans remaining segments. Non-scoped packages are prefixed with `"@"`.
 *
 * @param segments Path segments after "node_modules" in the file path
 *
 * @returns Array starting with `"@"` prefix (for non-scoped) or package identifier
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

	return scoped
		? [...packageId, ...category]
		: [external, ...packageId, ...category];

}

/**
 * Builds project-relative path segments with "." prefix.
 *
 * When root directory is found, returns all segments after it.
 * Otherwise, returns only the last segment as a fallback.
 *
 * @param segments Path segments to process
 * @param root Root directory name to search for (typically "src")
 *
 * @returns Array starting with "." followed by cleaned path segments
 */
function exported(segments: string[], root: string): readonly string[] {

	const cleaned = clean(segments);
	const codebase = cleaned.indexOf(root);

	return [internal, ...cleaned.slice(codebase >= 0 ? codebase+1 : -1)];
}


/**
 * Cleans and filters path segments.
 *
 * Splits segments on "/", removes file extensions and trailing slashes,
 * filters out empty segments and "index" segments.
 *
 * @param segments Path segments to clean
 *
 * @returns Filtered array of cleaned segments
 */
function clean(segments: readonly string[]): readonly string[] {
	return segments
		.flatMap(s => s.split("/"))
		.map(s => s.replace(/(?:\.\w+)*\/*$/, ""))
		.filter(s => s && s !== "index");
}
