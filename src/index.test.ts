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

import { ConfigError, getConfig, resetSync } from "@logtape/logtape";
import { describe, expect, it } from "vitest";
import { report, log, time } from "./index.js";


describe("log", () => {

	describe("log(function)", () => {

		it("should handle functions with no arguments", async () => {
			const fn = log(async () => "success");
			const result = await fn();
			expect(result).toBe("success");
		});

		it("should handle functions with one argument", async () => {
			const fn = log(async (x: number) => x*2);
			const result = await fn(5);
			expect(result).toBe(10);
		});

		it("should handle functions with multiple arguments", async () => {
			const fn = log(async (x: number, y: string, z: boolean) => {
				return `${x}-${y}-${z}`;
			});
			const result = await fn(42, "hello", true);
			expect(result).toBe("42-hello-true");
		});

		it("should handle functions with different argument types", async () => {
			const fn = log(async (
				num: number,
				str: string,
				bool: boolean,
				obj: { key: string },
				arr: number[]
			) => {
				return { num, str, bool, obj, arr };
			});

			const result = await fn(
				123,
				"test",
				false,
				{ key: "value" },
				[1, 2, 3]
			);

			expect(result).toEqual({
				num: 123,
				str: "test",
				bool: false,
				obj: { key: "value" },
				arr: [1, 2, 3]
			});
		});

		it("should catch errors and return undefined", async () => {
			const errorFn = log(async (x: number) => {
				throw new Error("Test error");
			});

			const result = await errorFn(5);
			expect(result).toBeUndefined();
		});

		it("should log errors with the operator name", async () => {
			async function namedFunction() {
				throw new Error("Named function error");
			}

			const guarded = log(namedFunction);
			const result = await guarded();

			// Should return undefined when error occurs
			expect(result).toBeUndefined();
		});

		it("should handle synchronous functions that return promises", async () => {
			const fn = log((x: number) => Promise.resolve(x+1));
			const result = await fn(10);
			expect(result).toBe(11);
		});

		it("should handle async functions that throw", async () => {
			const fn = log(async (x: number, y: number) => {
				if ( x === 0 ) {
					throw new Error("Division by zero");
				}
				return y/x;
			});

			const success = await fn(2, 10);
			expect(success).toBe(5);

			const failure = await fn(0, 10);
			expect(failure).toBeUndefined();
		});

		it("should preserve type inference for return values", async () => {
			const stringFn = log(async (x: number) => String(x));
			const numberFn = log(async (x: string) => Number(x));
			const objectFn = log(async () => ({ key: "value" }));

			const str = await stringFn(123);
			const num = await numberFn("456");
			const obj = await objectFn();

			// These should pass TypeScript type checking
			expect(typeof str).toBe("string");
			expect(typeof num).toBe("number");
			expect(typeof obj).toBe("object");
		});

		it("should handle functions with rest parameters", async () => {
			const sum = log(async (...numbers: number[]) => {
				return numbers.reduce((acc, n) => acc+n, 0);
			});

			expect(await sum(1, 2, 3, 4, 5)).toBe(15);
			expect(await sum()).toBe(0);
			expect(await sum(42)).toBe(42);
		});

		it("should handle synchronous functions without wrapping in Promise", () => {
			const syncFn = log((x: number) => x*2);
			const result = syncFn(5);

			// Result should NOT be a Promise for sync functions
			expect(result).not.toBeInstanceOf(Promise);
			expect(result).toBe(10);
		});

		it("should handle synchronous functions that throw", () => {
			const syncFn = log((x: number) => {
				if ( x === 0 ) {
					throw new Error("Zero not allowed");
				}
				return x*2;
			});

			const success = syncFn(5);
			expect(success).toBe(10);

			const failure = syncFn(0);
			expect(failure).toBeUndefined();
		});

		it("should preserve Promise for async functions", async () => {
			const asyncFn = log(async (x: number) => x*2);
			const result = asyncFn(5);

			// Result should be a Promise for async functions
			expect(result).toBeInstanceOf(Promise);
			expect(await result).toBe(10);
		});

	});

	describe("log(config)", () => {

		it("should auto-configure on first internal logger retrieval", async () => {

			// previous tests triggered auto-config via log(import.meta.url)
			expect(getConfig()).not.toBeNull();

		});

		it("should accept first explicit config from clean state", async () => {

			// custom is undefined (no prior explicit config), LogTape unconfigured
			resetSync();
			expect(() => log({ "/cold": "info" })).not.toThrow();

		});

		it("should allow explicit config to override auto-config", async () => {

			// reset and trigger auto-config via internal logger retrieval
			resetSync();
			log("/trigger-auto");
			expect(() => log({ "/override": "debug" })).not.toThrow();

		});

		it("should silently accept repeated identical simplified config", async () => {

			// previous test configured with { "/override": "debug" }
			expect(() => log({ "/override": "debug" })).not.toThrow();

		});

		it("should reject repeated different simplified config", async () => {

			expect(() => log({ "/other": "trace" })).toThrow(ConfigError);

		});

		it("should allow explicit config with reset flag", async () => {

			expect(() => log({
				reset: true,
				sinks: {},
				loggers: []
			})).not.toThrow();

		});

		it("should silently accept repeated identical full config", async () => {

			// previous test configured with { reset: true, sinks: {}, loggers: [] }
			expect(() => log({
				sinks: {},
				loggers: []
			})).not.toThrow();

		});

		it("should reject repeated different full config", async () => {

			expect(() => log({
				sinks: {},
				loggers: [{ category: ["test"], sinks: [] }]
			})).toThrow(ConfigError);

		});

		it("should not auto-configure after reset when custom config was set", async () => {

			resetSync();

			// custom config was set by prior tests, so auto-config must not run
			const logger = log("/test-module");
			expect(logger).toBeTruthy();
			expect(getConfig()).toBeNull();

		});

	});

});

describe("time()", () => {

	describe("synchronous execution", () => {

		it("should return the task result", () => {
			const result = time(
				() => 42,
				() => {}
			);
			expect(result).toBe(42);
		});

		it("should invoke monitor with result and elapsed time", () => {
			let monitoredValue: number | undefined;
			let monitoredElapsed: number | undefined;

			time(
				() => 42,
				(value, elapsed) => {
					monitoredValue = value;
					monitoredElapsed = elapsed;
				}
			);

			expect(monitoredValue).toBe(42);
			expect(monitoredElapsed).toBeGreaterThanOrEqual(0);
		});

		it("should throw error from task without calling monitor", () => {
			let monitorCalled = false;

			expect(() => time(
				() => { throw new Error("task error"); },
				() => { monitorCalled = true; }
			)).toThrow("task error");

			expect(monitorCalled).toBe(false);
		});

	});

	describe("asynchronous execution", () => {

		it("should return a promise resolving to task result", async () => {
			const result = await time(
				async () => 42,
				() => {}
			);
			expect(result).toBe(42);
		});

		it("should invoke monitor with result and elapsed time", async () => {
			let monitoredValue: number | undefined;
			let monitoredElapsed: number | undefined;

			await time(
				async () => 42,
				(value, elapsed) => {
					monitoredValue = value;
					monitoredElapsed = elapsed;
				}
			);

			expect(monitoredValue).toBe(42);
			expect(monitoredElapsed).toBeGreaterThanOrEqual(0);
		});

		it("should reject with error from task without calling monitor", async () => {
			let monitorCalled = false;

			await expect(time(
				async () => { throw new Error("task error"); },
				() => { monitorCalled = true; }
			)).rejects.toThrow("task error");

			expect(monitorCalled).toBe(false);
		});

		it("should measure elapsed time accurately", async () => {
			let elapsed: number | undefined;

			await time(
				async () => {
					await new Promise(resolve => setTimeout(resolve, 10));
					return "done";
				},
				(_value, e) => { elapsed = e; }
			);

			expect(elapsed).toBeGreaterThanOrEqual(10);
		});

	});

});

describe("report()", () => {

	// Test content is built from code points rather than written as literals: spelling invisible characters out would
	// embed in this source the very kind of content the tested pattern exists to expose, and would leave the cases
	// indistinguishable from one another on review.

	/**
	 * Reports the code points, surrounded by visible sentinels marking the extent of the reported content.
	 */
	function escaped(...codes: number[]): string {
		return report(`a${String.fromCodePoint(...codes)}b`);
	}

	/**
	 * Asserts that the code points are reported as they are, with no escaping beyond the surrounding quotes.
	 */
	function preserved(...codes: number[]): void {

		const value = String.fromCodePoint(...codes);

		expect(report(value)).toBe(`"${value}"`);

	}

	describe("values", () => {

		it("should format numbers with US locale conventions", () => {
			expect(report(1234567.5)).toBe("1,234,567.5");
		});

		it("should report errors through their message", () => {
			expect(report(new Error("boom"))).toBe("boom");
			expect(report(new TypeError("boom"))).toBe("boom");
		});

		it("should report error messages as they are", () => {
			expect(report(new Error(" a very long value "), 8)).toBe(" a very long value ");
		});

		it("should report functions through their name", () => {

			const arrow = (): void => {};

			expect(report(function declared() {})).toBe("declared()");
			expect(report(arrow)).toBe("arrow()");
			expect(report(class Declared {})).toBe("Declared()");

		});

		it("should report anonymous functions through a placeholder name", () => {
			expect(report(() => {})).toBe("function()");
			expect(report(function () {})).toBe("function()");
		});

		it("should report function names as they are", () => {
			expect(report(function aVeryLongName() {}, 8)).toBe("aVeryLongName()");
		});

		it("should report other values through their string representation", () => {
			expect(report(undefined)).toBe("undefined");
			expect(report(null)).toBe("null");
			expect(report(true)).toBe("true");
			expect(report({ message: "boom" })).toBe("[object Object]");
		});

	});

	describe("strings", () => {

		it("should delimit content with quotation marks", () => {
			expect(report(" padded ")).toBe("\" padded \"");
		});

		it("should escape the quotation mark and the reverse solidus", () => {
			expect(report("say \"hi\"")).toBe("\"say \\\"hi\\\"\"");
			expect(report("back\\slash")).toBe("\"back\\\\slash\"");
		});

		it("should clip overlong content ahead of escaping", () => {
			expect(report("a very long value", 8)).toBe(`"a very ${String.fromCodePoint(0x2026)}"`);
		});

		it("should leave content unclipped by default", () => {
			expect(report("a very long value")).toBe("\"a very long value\"");
		});

	});

	describe("invisible characters", () => {

		it("should escape control characters", () => {
			expect(escaped(0x0000)).toBe("\"a\\u0000b\"");
			expect(escaped(0x007F)).toBe("\"a\\u007Fb\"");
		});

		it("should report the control characters JSON gives a short escape to in that form", () => {
			expect(escaped(0x0008)).toBe("\"a\\bb\"");
			expect(escaped(0x000A)).toBe("\"a\\nb\"");
			expect(escaped(0x0009)).toBe("\"a\\tb\"");
		});

		it("should escape line and paragraph separators", () => {
			expect(escaped(0x2028)).toBe("\"a\\u2028b\"");
			expect(escaped(0x2029)).toBe("\"a\\u2029b\"");
		});

		it("should escape space separators other than the plain space", () => {
			expect(escaped(0x00A0)).toBe("\"a\\u00A0b\"");
			expect(escaped(0x3000)).toBe("\"a\\u3000b\"");
		});

		it("should escape format characters", () => {
			expect(escaped(0x00AD)).toBe("\"a\\u00ADb\"");
			expect(escaped(0x202E)).toBe("\"a\\u202Eb\"");
			expect(escaped(0xE0041)).toBe("\"a\\U000E0041b\"");
		});

		it("should escape default ignorable letters", () => {
			expect(escaped(0x115F)).toBe("\"a\\u115Fb\"");
			expect(escaped(0x1160)).toBe("\"a\\u1160b\"");
			expect(escaped(0x3164)).toBe("\"a\\u3164b\"");
			expect(escaped(0xFFA0)).toBe("\"a\\uFFA0b\"");
		});

		it("should escape default ignorable marks", () => {
			expect(escaped(0x034F)).toBe("\"a\\u034Fb\"");
		});

		it("should escape unassigned code points", () => {
			expect(escaped(0x0378)).toBe("\"a\\u0378b\"");
			expect(escaped(0xFDD0)).toBe("\"a\\uFDD0b\"");
			expect(escaped(0xFFFE)).toBe("\"a\\uFFFEb\"");
		});

		it("should escape private use code points", () => {
			expect(escaped(0xE000)).toBe("\"a\\uE000b\"");
			expect(escaped(0xF8FF)).toBe("\"a\\uF8FFb\"");
			expect(escaped(0x100000)).toBe("\"a\\U00100000b\"");
		});

		it("should escape the blank braille pattern", () => {
			expect(escaped(0x2800)).toBe("\"a\\u2800b\"");
		});

		it("should escape isolated surrogates", () => {
			expect(escaped(0xD800)).toBe("\"a\\uD800b\"");
			expect(escaped(0xDFFF)).toBe("\"a\\uDFFFb\"");
		});

	});

	describe("visible characters", () => {

		it("should report the plain space as it is", () => {
			preserved(0x0061, 0x0020, 0x0062); // a b
		});

		it("should report the zero width joiner as it is", () => {
			preserved(0x1F468, 0x200D, 0x1F469); // man + ZWJ + woman
		});

		it("should report variation selectors as they are", () => {
			preserved(0x2764, 0xFE0F); // heart, emoji presentation
			preserved(0x2764, 0xFE0E); // heart, text presentation
			preserved(0x845B, 0xE0100); // ideograph, first ideographic variant
		});

		it("should report combining marks as they are", () => {
			preserved(0x006E, 0x006F, 0x0065, 0x0301, 0x006C); // noel, decomposed
			preserved(0x0928, 0x092E, 0x0938, 0x094D, 0x0924, 0x0947); // namaste, devanagari
		});

		it("should report well-formed surrogate pairs as they are", () => {
			preserved(0x0061, 0x1F600, 0x0062); // a + emoji + b
		});

	});

});
