/**
 * Lightweight assertion helpers for smoke tests.
 * No test framework — just plain throws on failure.
 */

export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new AssertionError(message);
}

export function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new AssertionError(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertGreaterThan(actual: number, min: number, label: string): void {
  if (actual <= min) {
    throw new AssertionError(`${label}: expected > ${min}, got ${actual}`);
  }
}

export function assertIncludes(haystack: string, needle: string, label: string): void {
  if (!haystack.includes(needle)) {
    throw new AssertionError(`${label}: expected "${haystack}" to include "${needle}"`);
  }
}

export function assertMatch(value: string, pattern: RegExp, label: string): void {
  if (!pattern.test(value)) {
    throw new AssertionError(`${label}: "${value}" did not match ${pattern}`);
  }
}
