import { BadRequestException } from '@nestjs/common';
import type { TransformRule, TransformStep } from './workflow.types';

const MAX_PATH_DEPTH = 10;
const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1MB

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Validates and splits a dotted JSON path into safe property segments.
 */
export function parsePath(path: string): string[] {
  if (!path || typeof path !== 'string') {
    throw new BadRequestException('Path must be a non-empty string');
  }

  const trimmed = path.trim();
  if (trimmed.length > 256) {
    throw new BadRequestException(`Path '${path}' exceeds maximum character length (256)`);
  }

  const normalized = trimmed.replace(/\[(\d+)\]/g, '.$1');
  const segments = normalized.split('.').filter(Boolean);
  if (segments.length === 0 || segments.length > MAX_PATH_DEPTH) {
    throw new BadRequestException(
      `Path '${path}' depth (${segments.length}) exceeds maximum allowable depth (${MAX_PATH_DEPTH})`,
    );
  }

  for (const seg of segments) {
    if (!seg || FORBIDDEN_SEGMENTS.has(seg)) {
      throw new BadRequestException(`Path segment '${seg}' is forbidden or malformed`);
    }
  }

  return segments;
}

/**
 * Safely retrieves a value from a nested object/array using parsed segments.
 */
export function getByPath(obj: unknown, segments: string[]): unknown {
  let curr = obj;
  for (const seg of segments) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return undefined;
    }
    if (Array.isArray(curr)) {
      const idx = Number.parseInt(seg, 10);
      if (Number.isNaN(idx) || idx < 0 || idx >= curr.length) {
        return undefined;
      }
      curr = curr[idx];
    } else {
      curr = (curr as Record<string, unknown>)[seg];
    }
  }
  return curr;
}

/**
 * Safely sets a value at the specified segments in a target object.
 * Creates intermediate nested plain objects as needed.
 */
export function setByPath(target: Record<string, unknown>, segments: string[], value: unknown): void {
  let curr = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    if (curr[seg] === undefined || curr[seg] === null || typeof curr[seg] !== 'object') {
      curr[seg] = {};
    }
    curr = curr[seg] as Record<string, unknown>;
  }

  const lastSeg = segments[segments.length - 1]!;
  curr[lastSeg] = value;
}

/**
 * Safely removes a key at the specified segments in a target object.
 */
export function removeByPath(target: Record<string, unknown>, segments: string[]): void {
  let curr = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    if (curr[seg] === undefined || curr[seg] === null || typeof curr[seg] !== 'object') {
      return; // Nothing to remove
    }
    curr = curr[seg] as Record<string, unknown>;
  }

  const lastSeg = segments[segments.length - 1]!;
  if (Array.isArray(curr)) {
    const idx = Number.parseInt(lastSeg, 10);
    if (!Number.isNaN(idx) && idx >= 0 && idx < curr.length) {
      curr.splice(idx, 1);
    }
  } else if (typeof curr === 'object' && curr !== null) {
    delete curr[lastSeg];
  }
}

/**
 * Deep clones plain JSON-compatible objects without eval or functions.
 */
export function safeClone<T>(val: T): T {
  if (val === null || val === undefined || typeof val !== 'object') {
    return val;
  }
  return JSON.parse(JSON.stringify(val)) as T;
}

/**
 * Executes bounded JSON transformation according to defined rules.
 */
export function applyJsonTransformation(
  inputPayload: unknown,
  transformStep?: TransformStep,
): Record<string, unknown> {
  if (!transformStep || !transformStep.rules || transformStep.rules.length === 0) {
    if (typeof inputPayload === 'object' && inputPayload !== null && !Array.isArray(inputPayload)) {
      return safeClone(inputPayload as Record<string, unknown>);
    }
    return { data: safeClone(inputPayload) };
  }

  const inputSize = Buffer.byteLength(JSON.stringify(inputPayload ?? {}));
  if (inputSize > MAX_PAYLOAD_BYTES) {
    throw new BadRequestException(`Input payload size (${inputSize} bytes) exceeds limit (${MAX_PAYLOAD_BYTES} bytes)`);
  }

  // Base output object
  const output: Record<string, unknown> = transformStep.preserveOriginal && typeof inputPayload === 'object' && inputPayload !== null
    ? safeClone(inputPayload as Record<string, unknown>)
    : {};

  for (const rule of transformStep.rules) {
    applyRule(inputPayload, output, rule);
  }

  const outputSize = Buffer.byteLength(JSON.stringify(output));
  if (outputSize > MAX_PAYLOAD_BYTES) {
    throw new BadRequestException(
      `Transformed payload size (${outputSize} bytes) exceeds limit (${MAX_PAYLOAD_BYTES} bytes)`,
    );
  }

  return output;
}

function applyRule(
  input: unknown,
  output: Record<string, unknown>,
  rule: TransformRule,
): void {
  const targetSegments = parsePath(rule.targetPath);

  switch (rule.type) {
    case 'map': {
      if (!rule.sourcePath) {
        throw new BadRequestException(`'map' rule requires 'sourcePath'`);
      }
      const sourceSegments = parsePath(rule.sourcePath);
      const extractedVal = getByPath(input, sourceSegments);
      if (extractedVal !== undefined) {
        setByPath(output, targetSegments, safeClone(extractedVal));
      }
      break;
    }
    case 'set': {
      setByPath(output, targetSegments, safeClone(rule.value));
      break;
    }
    case 'remove': {
      removeByPath(output, targetSegments);
      break;
    }
    default:
      throw new BadRequestException(`Unsupported transform rule type '${(rule as { type: string }).type}'`);
  }
}
