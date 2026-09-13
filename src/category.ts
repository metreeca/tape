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
 * Logger category naming.
 *
 * Resolves module paths and configuration keys into canonical logger categories, keeping project code and imported
 * dependencies apart, and renders categories back as the human-readable labels console entries are sourced by,
 * shortened where the display field is narrower than the label.
 *
 * @internal
 * @module
 */

import { clip } from "@metreeca/core/strings";


const Roots = new Set(["dist", "lib", "build", "out"]);


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
 * Keys follow the {@link label} convention:
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
 * A trailing `/` narrows a key to a folder entry point alone, appending an explicit `"index"` segment (for example
 * `"/name/"` → `["/", "name", "index"]`, `"lodash/"` → `["lodash", "index"]`). This form extends the label convention
 * rather than mirroring it: no label ends with `/`, so a key of this shape has no counterpart among the labels.
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

	const buildOffset = Roots.has(segments[module]) ? 1 : 0;
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
 * - **Internal modules** (category starts with `"/"`): leading `/`, then module segments joined by `/`. A folder
 *   entry point is named after its folder, its trailing `index` segment dropped (for example `/utils`). The root
 *   `["/", "index"]` renders as `/`.
 *
 * - **External packages** (category starts with a bare package name or a `"@scope"` segment): package name, followed
 *   by `:module` where a module path beyond the entry point is present. The entry point renders the package alone
 *   (for example `lodash`), and a trailing `index` inside a longer module path is dropped (for example
 *   `@scope/pkg:utils`).
 *
 * No label ends with `/`, so `name.ts` and `name/index.ts` render alike, though their categories stay distinct for
 * filtering.
 *
 * Labels longer than `length` are shortened to fit, keeping the tail of the module path, where the emitting module is
 * named, in preference to its leading segments: every segment given up is replaced by a single `…`, which stands for
 * the separator they were introduced by as well (at a width of 20, `/tape/utils/nested/helper` renders as
 * `…/nested/helper` and `@scope/pkg:utils/nested/helper` as `@scope/pkg:…/helper`). Where the trailing segment
 * doesn't fit whole, it is clipped rather than given up, its last retained code point replaced by `…`; a module path
 * with no segment left to give up keeps its leading `/` or package prefix. Where the package name leaves no room for
 * a module at all, the label is clipped as a whole.
 *
 * @internal
 *
 * @param category Hierarchical logger category segments
 * @param length The maximum length in code points of the rendered label; `0` or a negative value renders the label in
 *     full; defaults to `0`
 *
 * @returns Human-readable label suitable for log display, no longer than `length` code points
 */
export function label(category: readonly string[], length = 0): string {

	const segments = category.filter(s => s);

	return segments[0] === internal
		? internally(prune(segments.slice(1)))
		: externally(segments);


	function internally(path: readonly string[]): string {

		return shorten(path, "/", length);

	}

	function externally(path: readonly string[]): string {

		const scoped = path[0]?.startsWith(external);
		const pkg = scoped ? `${path[0]}/${path[1]}` : path[0] ?? "";
		const module = prune(path.slice(scoped ? 2 : 1));

		const room = length-pkg.length-1; // what the module is left with, after the package and its ":" separator
		const rendered = module.length === 0 ? pkg : `${pkg}:${shorten(module, "", room)}`;

		return length <= 0 || room > 0 ? rendered : clip(rendered, length); // no room: clip the label as a whole
	}


	function prune(path: readonly string[]): readonly string[] {

		return path.at(-1) === "index" ? path.slice(0, -1) : path;

	}

	function shorten(path: readonly string[], lead: string, room: number): string {

		const whole = `${lead}${path.join("/")}`;
		const shorter = path.slice(1).map((_, given) => `…/${path.slice(given+1).join("/")}`); // one more given up each

		return room <= 0 ? whole
			: [whole, ...shorter].find(rendering => rendering.length <= room) // the longest that fits
				?? clip(shorter.at(-1) ?? whole, room); // none fits whole: the shortest, clipped

	}

}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Cleans and filters path segments.
 *
 * Removes file extensions and trailing slashes, flattening segments that carry an embedded `/` and dropping empty
 * ones. The `"index"` segment is retained, so that sibling modules stay distinguishable (for example `name.ts`
 * against `name/index.ts`).
 *
 * @param path Path segments to clean
 *
 * @returns Filtered array of cleaned segments
 */
function clean(path: readonly string[]): readonly string[] {

	return path
		.flatMap(s => s.split("/"))
		.map(s => s.replace(/(?:\.\w+)*\/*$/, ""))
		.filter(s => s);

}
