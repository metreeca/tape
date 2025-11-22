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

import { describe, expect, test } from "vitest";
import { category } from "./category";


describe("parse()", () => {

	describe("project files", () => {

		test("extracts context from project file", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/src/pipelines/units/tasks/analyze.ts";
			expect(category(url)).toEqual([".", "pipelines", "units", "tasks", "analyze"]);
		});

		test("handles project file outside src", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/scripts/build.ts";
			expect(category(url)).toEqual([".", "build"]);
		});

		test("supports custom project root", () => {
			const url = "file:///Users/Alessandro/packages/core/lib/utils.ts";
			expect(category(url, "lib")).toEqual([".", "utils"]);
		});

		test("handles root-level files when custom root matches last segment", () => {
			const url = "file:///Users/Alessandro/project/lib/index.ts";
			expect(category(url, "lib")).toEqual(["."]);
		});

		test("uses last segment when root directory not found", () => {
			const url = "file:///Users/Alessandro/project/lib/utils.ts";
			expect(category(url, "src")).toEqual([".", "utils"]);
		});

		test("filters out index segments from project files", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/src/utils/index.ts";
			expect(category(url)).toEqual([".", "utils"]);
		});

	});

	describe("node_modules packages", () => {

		test("extracts scoped package name from node_modules", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/@metreeca/core/dist/index.js";
			expect(category(url)).toEqual(["@metreeca", "core"]);
		});

		test("extracts scoped package with nested module path", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/@metreeca/core/dist/utils/validate.js";
			expect(category(url)).toEqual(["@metreeca", "core", "utils", "validate"]);
		});

		test("extracts regular package name from node_modules", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/express/lib/express.js";
			expect(category(url)).toEqual(["@", "express", "express"]);
		});

		test("handles packages without build directory", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/package/src/utils.js";
			expect(category(url)).toEqual(["@", "package", "src", "utils"]);
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
			expect(category(url)).toEqual(["@", "logger", "utils", "logger-config"]);
		});

		test("does not filter when package name appears later without redundancy", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/pkg/src/utils/pkg-helper.js";
			// "src" is not a build directory, so it stays in the path
			expect(category(url)).toEqual(["@", "pkg", "src", "utils", "pkg-helper"]);
		});

		test("filters out index segments from package files", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/lodash/index.js";
			expect(category(url)).toEqual(["@", "lodash"]);
		});

	});

	describe("path segments", () => {

		test("parses slash-separated path segments as project code", () => {
			// Without root directory, only last segment is used
			expect(category("foo/bar/baz")).toEqual([".", "baz"]);
		});

		test("handles single non-URL element as project code", () => {
			expect(category("utilities")).toEqual([".", "utilities"]);
		});

		test("handles empty string as project root", () => {
			expect(category("")).toEqual(["."]);
		});

		test("handles leading slashes in path as project code", () => {
			// Without root directory, only last segment is used
			expect(category("/foo/bar")).toEqual([".", "bar"]);
		});

		test("handles trailing slashes in path as project code", () => {
			// Without root directory, only last segment is used
			expect(category("foo/bar/baz/")).toEqual([".", "baz"]);
		});

		test("extracts segments after root directory in plain paths", () => {
			expect(category("src/utils/helper")).toEqual([".", "utils", "helper"]);
		});

	});

	describe("file extensions", () => {

		test("strips any file extension", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/src/pipelines/units.py";
			expect(category(url)).toEqual([".", "pipelines", "units"]);
		});

		test("strips multiple extensions", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/src/pipelines/units.test.ts";
			expect(category(url)).toEqual([".", "pipelines", "units"]);
		});

		test("strips extension from package files", () => {
			const url = "file:///Users/Alessandro/Metreeca/Projects/EC2U/Pipe/node_modules/lodash/dist/lodash.min.js";
			expect(category(url)).toEqual(["@", "lodash", "lodash"]);
		});

	});

	describe("http/https URLs", () => {

		test("handles http URLs", () => {
			const url = "http://example.com/node_modules/package/index.js";
			expect(category(url)).toEqual(["@", "package"]);
		});

		test("handles https URLs", () => {
			const url = "https://example.com/path/to/file.ts";
			// Without a "src" root in the path, it takes only the last segment
			expect(category(url)).toEqual([".", "file"]);
		});

		test("handles URLs without paths", () => {
			const url = "http://example.com";
			expect(category(url)).toEqual(["."]);
		});

	});

	describe("custom URI schemes", () => {

		test("handles data URIs", () => {
			const url = "data:text/plain,hello";
			// Without root directory, only last segment is used
			expect(category(url)).toEqual([".", "plain,hello"]);
		});

		test("handles ws/wss URIs", () => {
			const url = "ws://example.com/socket/channel.js";
			// Without root directory, only last segment is used
			expect(category(url)).toEqual([".", "channel"]);
		});

		test("handles custom scheme URIs with root directory", () => {
			const url = "custom://host/src/utils/helper.ts";
			expect(category(url)).toEqual([".", "utils", "helper"]);
		});

		test("handles scheme without authority", () => {
			const url = "custom:/path/to/module.ts";
			// Without root directory, only last segment is used
			expect(category(url)).toEqual([".", "module"]);
		});

		test("handles scheme without authority with root directory", () => {
			const url = "custom:/src/utils/module.ts";
			expect(category(url)).toEqual([".", "utils", "module"]);
		});

		test("handles node_modules in custom schemes", () => {
			const url = "bundler://project/node_modules/@scope/pkg/dist/index.js";
			expect(category(url)).toEqual(["@scope", "pkg"]);
		});

	});

});
