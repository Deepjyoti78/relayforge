import type { ConditionGroup, ConditionRule } from './workflow.types';
import { getByPath, parsePath } from './json-transformer';

export interface EventEvaluationContext {
  payload: unknown;
  headers?: Record<string, unknown> | null;
  eventType: string;
  eventId: string;
}

/**
 * Extracts a value from the evaluation context using field path.
 */
export function resolveFieldValue(context: EventEvaluationContext, fieldPath: string): unknown {
  const segments = parsePath(fieldPath);
  const root = segments[0];

  if (root === 'payload') {
    return getByPath(context.payload, segments.slice(1));
  }
  if (root === 'headers') {
    return getByPath(context.headers, segments.slice(1));
  }
  if (root === 'event') {
    return getByPath(context, segments.slice(1));
  }

  // Default: check payload first
  const fromPayload = getByPath(context.payload, segments);
  if (fromPayload !== undefined) {
    return fromPayload;
  }

  // Fallback to top-level context
  return getByPath(context, segments);
}

/**
 * Evaluates an individual condition rule.
 */
export function evaluateRule(context: EventEvaluationContext, rule: ConditionRule): boolean {
  const actual = resolveFieldValue(context, rule.field);
  const expected = rule.value;

  switch (rule.operator) {
    case 'equals':
      return isDeepEqual(actual, expected);

    case 'not_equals':
      return !isDeepEqual(actual, expected);

    case 'greater_than': {
      if (typeof actual !== 'number' || typeof expected !== 'number') {
        const numActual = Number(actual);
        const numExpected = Number(expected);
        if (Number.isNaN(numActual) || Number.isNaN(numExpected)) return false;
        return numActual > numExpected;
      }
      return actual > expected;
    }

    case 'less_than': {
      if (typeof actual !== 'number' || typeof expected !== 'number') {
        const numActual = Number(actual);
        const numExpected = Number(expected);
        if (Number.isNaN(numActual) || Number.isNaN(numExpected)) return false;
        return numActual < numExpected;
      }
      return actual < expected;
    }

    case 'exists':
      return actual !== undefined && actual !== null;

    case 'not_exists':
      return actual === undefined || actual === null;

    case 'contains': {
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.includes(expected);
      }
      if (Array.isArray(actual)) {
        return actual.some((item) => isDeepEqual(item, expected));
      }
      return false;
    }

    default:
      return false;
  }
}

/**
 * Evaluates an entire condition group (ALL or ANY).
 * Returns true if conditions pass or if no condition group is specified.
 */
export function evaluateConditionGroup(
  context: EventEvaluationContext,
  group?: ConditionGroup,
): { passed: boolean; details: Record<string, unknown> } {
  if (!group || !group.conditions || group.conditions.length === 0) {
    return { passed: true, details: { status: 'NO_CONDITIONS' } };
  }

  const results: { field: string; operator: string; expected: unknown; matched: boolean }[] = [];

  for (const rule of group.conditions) {
    const matched = evaluateRule(context, rule);
    results.push({
      field: rule.field,
      operator: rule.operator,
      expected: rule.value,
      matched,
    });
  }

  let passed: boolean;
  if (group.logic === 'ANY') {
    passed = results.some((r) => r.matched);
  } else {
    // Default: 'ALL'
    passed = results.every((r) => r.matched);
  }

  return {
    passed,
    details: {
      logic: group.logic,
      evaluatedCount: results.length,
      passed,
      results,
    },
  };
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  return false;
}
