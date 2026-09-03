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

import { describe, expect, test } from "vitest";
import { category, label, parse } from "./category.js";


describe("parse()", () => {

	describe("project files", () => {

		test("extracts context from project file", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/src/pipelines/units/tasks/analyze.ts";
			expect(category(url)).toEqual(["/", "Pipe", "pipelines", "units", "tasks", "analyze"]);
		});

		test("handles project file outside src", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/scripts/build.ts";
			expect(category(url)).toEqual(["/", "build"]);
		});

		test("supports custom project root", () => {
			const url = "file:///Users/Alessandro/packages/core/lib/utils.ts";
			expect(category(url, "lib")).toEqual(["/", "core", "utils"]);
		});

		test("preserves index for root-level index files under custom root", () => {
			const url = "file:///Users/Alessandro/project/lib/index.ts";
			expect(category(url, "lib")).toEqual(["/", "project", "index"]);
		});

		test("uses last segment when root directory not found", () => {
			const url = "file:///Users/Alessandro/project/lib/utils.ts";
			expect(category(url, "src")).toEqual(["/", "utils"]);
		});

		test("preserves index segment in project files", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/src/utils/index.ts";
			expect(category(url)).toEqual(["/", "Pipe", "utils", "index"]);
		});

		test("preserves index for root src file", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/src/index.ts";
			expect(category(url)).toEqual(["/", "Pipe", "index"]);
		});

		test("distinguishes name.ts from name/index.ts", () => {
			const flat = "file:///Users/Alessandro/project/src/name.ts";
			const nested = "file:///Users/Alessandro/project/src/name/index.ts";
			expect(category(flat)).toEqual(["/", "project", "name"]);
			expect(category(nested)).toEqual(["/", "project", "name", "index"]);
		});

		test("qualifies project modules with the enclosing package directory", () => {
			const url = "file:///Users/Alessandro/monorepo/packages/tape/src/utils/helper.ts";
			expect(category(url)).toEqual(["/", "tape", "utils", "helper"]);
		});

		test("distinguishes the same module across monorepo packages", () => {
			const a = "file:///Users/Alessandro/monorepo/packages/appA/src/index.ts";
			const b = "file:///Users/Alessandro/monorepo/packages/appB/src/index.ts";
			expect(category(a)).toEqual(["/", "appA", "index"]);
			expect(category(b)).toEqual(["/", "appB", "index"]);
		});

	});

	describe("node_modules packages", () => {

		test("extracts scoped package name from node_modules with preserved index", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/@metreeca/core/dist/index.js";
			expect(category(url)).toEqual(["@metreeca", "core", "index"]);
		});

		test("extracts scoped package with nested module path", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/@metreeca/core/dist/utils/validate.js";
			expect(category(url)).toEqual(["@metreeca", "core", "utils", "validate"]);
		});

		test("extracts regular package name from node_modules", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/express/lib/express.js";
			expect(category(url)).toEqual([ "express", "express"]);
		});

		test("handles packages without build directory", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/package/src/utils.js";
			expect(category(url)).toEqual([ "package", "src", "utils"]);
		});

		test("handles deeply nested package paths", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/@scope/pkg/dist/nested/deep/module.js";
			expect(category(url)).toEqual(["@scope", "pkg", "nested", "deep", "module"]);
		});

		test("filters only first redundant package name in module path", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/@scope/pkg/dist/pkg/utils.js";
			expect(category(url)).toEqual(["@scope", "pkg", "utils"]);
		});

		test("preserves legitimate package names deeper in path", () => {
			// Package name "logger" appears legitimately in the path after being filtered once
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/logger/dist/logger/utils/logger-config.js";
			expect(category(url)).toEqual([ "logger", "utils", "logger-config"]);
		});

		test("does not filter when package name appears later without redundancy", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/pkg/src/utils/pkg-helper.js";
			// "src" is not a build directory, so it stays in the path
			expect(category(url)).toEqual([ "pkg", "src", "utils", "pkg-helper"]);
		});

		test("preserves index segment in package entry file", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/lodash/index.js";
			expect(category(url)).toEqual([ "lodash", "index"]);
		});

	});

	describe("path segments", () => {

		test("parses slash-separated path segments as project code", () => {
			// Without root directory, only last segment is used
			expect(category("foo/bar/baz")).toEqual(["/", "baz"]);
		});

		test("handles single non-URL element as project code", () => {
			expect(category("utilities")).toEqual(["/", "utilities"]);
		});

		test("handles empty string as project root", () => {
			expect(category("")).toEqual(["/"]);
		});

		test("handles leading slashes in path as project code", () => {
			// Without root directory, only last segment is used
			expect(category("/foo/bar")).toEqual(["/", "bar"]);
		});

		test("handles trailing slashes in path as project code", () => {
			// Without root directory, only last segment is used
			expect(category("foo/bar/baz/")).toEqual(["/", "baz"]);
		});

		test("extracts segments after root directory in plain paths", () => {
			expect(category("src/utils/helper")).toEqual(["/", "utils", "helper"]);
		});

	});

	describe("file extensions", () => {

		test("strips any file extension", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/src/pipelines/units.py";
			expect(category(url)).toEqual(["/", "Pipe", "pipelines", "units"]);
		});

		test("strips multiple extensions", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/src/pipelines/units.test.ts";
			expect(category(url)).toEqual(["/", "Pipe", "pipelines", "units"]);
		});

		test("strips multiple unrelated extensions", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/src/pipelines/module.core.ts";
			expect(category(url)).toEqual(["/", "Pipe", "pipelines", "module"]);
		});

		test("strips extension from package files", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/lodash/dist/lodash.min.js";
			expect(category(url)).toEqual([ "lodash", "lodash"]);
		});

	});

	describe("http/https URLs", () => {

		test("handles http URLs", () => {
			const url = "http://example.com/node_modules/package/index.js";
			expect(category(url)).toEqual([ "package", "index"]);
		});

		test("handles https URLs", () => {
			const url = "https://example.com/path/to/file.ts";
			// Without a "src" root in the path, it takes only the last segment
			expect(category(url)).toEqual(["/", "file"]);
		});

		test("handles URLs without paths", () => {
			const url = "http://example.com";
			expect(category(url)).toEqual(["/"]);
		});

	});

	describe("custom URI schemes", () => {

		test("handles data URIs", () => {
			const url = "data:text/plain,hello";
			// Without root directory, only last segment is used
			expect(category(url)).toEqual(["/", "plain,hello"]);
		});

		test("handles ws/wss URIs", () => {
			const url = "ws://example.com/socket/channel.js";
			// Without root directory, only last segment is used
			expect(category(url)).toEqual(["/", "channel"]);
		});

		test("handles custom scheme URIs with root directory", () => {
			const url = "custom://host/src/utils/helper.ts";
			expect(category(url)).toEqual(["/", "utils", "helper"]);
		});

		test("handles scheme without authority", () => {
			const url = "custom:/path/to/module.ts";
			// Without root directory, only last segment is used
			expect(category(url)).toEqual(["/", "module"]);
		});

		test("handles scheme without authority with root directory", () => {
			const url = "custom:/src/utils/module.ts";
			expect(category(url)).toEqual(["/", "utils", "module"]);
		});

		test("handles node_modules in custom schemes", () => {
			const url = "bundler://project/node_modules/@scope/pkg/dist/index.js";
			expect(category(url)).toEqual(["@scope", "pkg", "index"]);
		});

	});

});


describe("label()", () => {

	describe("internal modules", () => {

		test("renders root index as /", () => {
			expect(label(["/", "index"])).toBe("/");
		});

		test("renders flat module with leading /", () => {
			expect(label(["/", "name"])).toBe("/name");
		});

		test("renders nested index with trailing /", () => {
			expect(label(["/", "name", "index"])).toBe("/name/");
		});

		test("renders deep module path", () => {
			expect(label(["/", "utils", "helper"])).toBe("/utils/helper");
		});

		test("renders deep index module with trailing /", () => {
			expect(label(["/", "utils", "index"])).toBe("/utils/");
		});

		test("distinguishes name.ts from name/index.ts", () => {
			expect(label(["/", "name"])).toBe("/name");
			expect(label(["/", "name", "index"])).toBe("/name/");
		});

		test("ignores empty trailing segments from anonymous getChild", () => {
			expect(label(["/", "index", ""])).toBe("/");
			expect(label(["/", "name", ""])).toBe("/name");
		});

	});

	describe("external packages", () => {

		test("renders non-scoped package entry with trailing /", () => {
			expect(label([ "lodash", "index"])).toBe("lodash/");
		});

		test("renders non-scoped package module with :module", () => {
			expect(label([ "lodash", "map"])).toBe("lodash:map");
		});

		test("renders scoped package entry with trailing /", () => {
			expect(label(["@scope", "pkg", "index"])).toBe("@scope/pkg/");
		});

		test("renders scoped package module with :module", () => {
			expect(label(["@scope", "pkg", "utils", "helper"])).toBe("@scope/pkg:utils/helper");
		});

		test("collapses trailing /index in scoped package module", () => {
			expect(label(["@scope", "pkg", "utils", "index"])).toBe("@scope/pkg:utils/");
		});

		test("collapses trailing /index in non-scoped package module", () => {
			expect(label([ "lodash", "utils", "index"])).toBe("lodash:utils/");
		});

	});

});


describe("parse()", () => {

	describe("internal keys", () => {

		test("parses empty key as root catch-all", () => {
			expect(parse("")).toEqual([]);
		});

		test("parses / as internal root", () => {
			expect(parse("/")).toEqual(["/"]);
		});

		test("parses /name as internal module", () => {
			expect(parse("/name")).toEqual(["/", "name"]);
		});

		test("parses /utils/helper as nested internal module", () => {
			expect(parse("/utils/helper")).toEqual(["/", "utils", "helper"]);
		});

		test("parses /name/ with trailing slash as index module", () => {
			expect(parse("/name/")).toEqual(["/", "name", "index"]);
		});

	});

	describe("non-scoped package keys", () => {

		test("parses bare package name", () => {
			expect(parse("lodash")).toEqual(["lodash"]);
		});

		test("parses package module", () => {
			expect(parse("lodash/map")).toEqual(["lodash", "map"]);
		});

		test("parses trailing slash as package index", () => {
			expect(parse("lodash/")).toEqual(["lodash", "index"]);
		});

	});

	describe("scoped package keys", () => {

		test("parses scoped package name", () => {
			expect(parse("@scope/pkg")).toEqual(["@scope", "pkg"]);
		});

		test("parses scoped package module", () => {
			expect(parse("@scope/pkg/utils")).toEqual(["@scope", "pkg", "utils"]);
		});

		test("parses scoped package nested module", () => {
			expect(parse("@scope/pkg/utils/helper")).toEqual(["@scope", "pkg", "utils", "helper"]);
		});

		test("parses trailing slash as scoped package index", () => {
			expect(parse("@scope/pkg/")).toEqual(["@scope", "pkg", "index"]);
		});

	});

});
