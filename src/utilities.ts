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
 * Utility functions supporting logging operations.
 *
 * Provides message formatting and execution timing utilities for consistent
 * error handling and performance monitoring.
 *
 * @module
 */

import { isError, isNumber } from "@metreeca/core";
import { log } from "./facade";


/**
 * Extracts a readable message string from an unknown value.
 *
 * Converts `Error` objects to their message property, formats numbers with
 * locale-specific formatting, or converts other values to string representation.
 *
 * @param value Unknown value to extract message from
 *
 * @returns Error message, formatted number, or string representation of the value
 */
export function message(value: unknown) {
	return isNumber(value) ? value.toLocaleString("en-US")
		: isError(value) ? value.message
			: String(value);
}


/**
 * Executes an asynchronous task and monitors its execution time.
 *
 * Measures elapsed time from invocation until promise resolution.
 *
 * @typeParam T The type of value returned by the task
 *
 * @param task Function returning a promise to be timed
 * @param monitor Callback invoked with the result value and elapsed time in milliseconds
 *
 * @returns A promise resolving to the task's return value
 */
export function time<T>(task: () => Promise<T>, monitor: (value: T, elapsed: number) => void): Promise<T>;

/**
 * Executes a synchronous task and monitors its execution time.
 *
 * Measures elapsed time from invocation until completion.
 *
 * @typeParam T The type of value returned by the task
 *
 * @param task Function returning a value to be timed
 * @param monitor Callback invoked with the result value and elapsed time in milliseconds
 *
 * @returns The task's return value
 */
export function time<T>(task: () => T, monitor: (value: T, elapsed: number) => void): T;

export function time<T>(task: () => T | Promise<T>, monitor: (value: T, elapsed: number) => void): T | Promise<T> {

	const start = Date.now();

	const value = task();

	if ( value instanceof Promise ) {

		return value.then(resolved => {

			monitor(resolved, Date.now()-start);

			return resolved;

		});

	} else {

		monitor(value, Date.now()-start);

		return value;

	}

}

/**
 * Wraps an asynchronous function with error handling and logging.
 *
 * Catches errors thrown or rejected by the function, logs them via {@link log}
 * using the function's name, and returns `undefined` instead of propagating the error.
 *
 * @typeParam T The tuple type of function arguments
 * @typeParam R The return type of the function
 *
 * @param f Async function to wrap with error handling
 *
 * @returns Wrapped function that returns a promise resolving to the original result or `undefined` on error
 */
export function guard<T extends unknown[], R>(f: (...args: T) => Promise<R>): (...args: T) => Promise<undefined | R>;

/**
 * Wraps a synchronous function with error handling and logging.
 *
 * Catches errors thrown by the function, logs them via {@link log} using the
 * function's name, and returns `undefined` instead of propagating the error.
 *
 * @typeParam T The tuple type of function arguments
 * @typeParam R The return type of the function
 *
 * @param f Function to wrap with error handling
 *
 * @returns Wrapped function that returns the original result or `undefined` on error
 */
export function guard<T extends unknown[], R>(f: (...args: T) => R): (...args: T) => undefined | R;

export function guard<T extends unknown[], R>(f: (...args: T) => R | Promise<R>) {

	const logger = log(import.meta.url).getChild(f.name);

	return (...args: T) => {
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
