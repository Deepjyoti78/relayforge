import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PrismaClient } from '../../generated/prisma/client';
import type { WorkflowDefinition } from './workflow.types';
import { parsePath } from './json-transformer';

const ALLOWED_CONDITION_OPERATORS = new Set([
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'exists',
  'not_exists',
  'contains',
]);

const ALLOWED_TRANSFORM_TYPES = new Set(['map', 'set', 'remove']);

/**
 * Produces a deterministic canonical JSON string for hashing.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson((obj as Record<string, unknown>)[k])).join(',') + '}';
}

/**
 * Computes the SHA-256 integrity hash of a workflow definition.
 */
export function computeDefinitionHash(definition: WorkflowDefinition): string {
  return createHash('sha256').update(canonicalJson(definition)).digest('hex');
}

/**
 * Validates the structure and bounded schema rules of a workflow definition.
 */
export function validateWorkflowDefinitionStructure(def: unknown): WorkflowDefinition {
  if (!def || typeof def !== 'object') {
    throw new BadRequestException('Workflow definition must be an object');
  }

  const definition = def as Partial<WorkflowDefinition>;
  const seenNodeIds = new Set<string>();

  // 1. Validate Trigger
  if (!definition.trigger || typeof definition.trigger !== 'object') {
    throw new BadRequestException("Workflow definition must have a 'trigger' object");
  }
  const trigger = definition.trigger;
  if (!trigger.nodeId || typeof trigger.nodeId !== 'string') {
    throw new BadRequestException("Trigger must specify a string 'nodeId'");
  }
  if (seenNodeIds.has(trigger.nodeId)) {
    throw new BadRequestException(`Duplicate nodeId '${trigger.nodeId}' in workflow`);
  }
  seenNodeIds.add(trigger.nodeId);

  if (!trigger.endpointId || typeof trigger.endpointId !== 'string') {
    throw new BadRequestException("Trigger must specify an 'endpointId' UUID");
  }

  // 2. Validate Condition Group (Optional)
  if (definition.conditionGroup) {
    const cg = definition.conditionGroup;
    if (!cg.nodeId || typeof cg.nodeId !== 'string') {
      throw new BadRequestException("ConditionGroup must specify a string 'nodeId'");
    }
    if (seenNodeIds.has(cg.nodeId)) {
      throw new BadRequestException(`Duplicate nodeId '${cg.nodeId}' in workflow`);
    }
    seenNodeIds.add(cg.nodeId);

    if (cg.logic !== 'ALL' && cg.logic !== 'ANY') {
      throw new BadRequestException("ConditionGroup logic must be 'ALL' or 'ANY'");
    }

    if (!Array.isArray(cg.conditions)) {
      throw new BadRequestException("ConditionGroup 'conditions' must be an array");
    }
    if (cg.conditions.length > 20) {
      throw new BadRequestException('ConditionGroup cannot exceed 20 conditions');
    }

    for (let i = 0; i < cg.conditions.length; i++) {
      const c = cg.conditions[i];
      if (!c || typeof c !== 'object') {
        throw new BadRequestException(`Condition at index ${i} must be an object`);
      }
      if (!c.field || typeof c.field !== 'string') {
        throw new BadRequestException(`Condition at index ${i} requires a non-empty string 'field'`);
      }
      // Ensure field is a parseable bounded path
      parsePath(c.field);

      if (!c.operator || !ALLOWED_CONDITION_OPERATORS.has(c.operator)) {
        throw new BadRequestException(
          `Condition at index ${i} specifies invalid operator '${c.operator}'. Allowed: ${Array.from(ALLOWED_CONDITION_OPERATORS).join(', ')}`,
        );
      }
    }
  }

  // 3. Validate Transform Step (Optional)
  if (definition.transform) {
    const tr = definition.transform;
    if (!tr.nodeId || typeof tr.nodeId !== 'string') {
      throw new BadRequestException("Transform step must specify a string 'nodeId'");
    }
    if (seenNodeIds.has(tr.nodeId)) {
      throw new BadRequestException(`Duplicate nodeId '${tr.nodeId}' in workflow`);
    }
    seenNodeIds.add(tr.nodeId);

    if (!Array.isArray(tr.rules)) {
      throw new BadRequestException("Transform step 'rules' must be an array");
    }
    if (tr.rules.length > 50) {
      throw new BadRequestException('Transform step cannot exceed 50 rules');
    }

    for (let i = 0; i < tr.rules.length; i++) {
      const rule = tr.rules[i];
      if (!rule || typeof rule !== 'object') {
        throw new BadRequestException(`Transform rule at index ${i} must be an object`);
      }
      if (!rule.type || !ALLOWED_TRANSFORM_TYPES.has(rule.type)) {
        throw new BadRequestException(
          `Transform rule at index ${i} specifies invalid type '${rule.type}'. Allowed: map, set, remove`,
        );
      }
      if (!rule.targetPath || typeof rule.targetPath !== 'string') {
        throw new BadRequestException(`Transform rule at index ${i} requires a string 'targetPath'`);
      }
      parsePath(rule.targetPath);

      if (rule.type === 'map') {
        if (!rule.sourcePath || typeof rule.sourcePath !== 'string') {
          throw new BadRequestException(`Transform 'map' rule at index ${i} requires a string 'sourcePath'`);
        }
        parsePath(rule.sourcePath);
      }
    }
  }

  // 4. Validate Actions (1 to 5 sequential destinations)
  if (!Array.isArray(definition.actions)) {
    throw new BadRequestException("Workflow definition must have an 'actions' array");
  }
  if (definition.actions.length < 1 || definition.actions.length > 5) {
    throw new BadRequestException(
      `Workflow must have between 1 and 5 sequential HTTP actions (found ${definition.actions.length})`,
    );
  }

  for (let i = 0; i < definition.actions.length; i++) {
    const act = definition.actions[i];
    if (!act || typeof act !== 'object') {
      throw new BadRequestException(`Action at index ${i} must be an object`);
    }
    if (!act.nodeId || typeof act.nodeId !== 'string') {
      throw new BadRequestException(`Action at index ${i} requires a string 'nodeId'`);
    }
    if (seenNodeIds.has(act.nodeId)) {
      throw new BadRequestException(`Duplicate nodeId '${act.nodeId}' in workflow`);
    }
    seenNodeIds.add(act.nodeId);

    if (!act.destinationId || typeof act.destinationId !== 'string') {
      throw new BadRequestException(`Action at index ${i} requires a string 'destinationId'`);
    }
  }

  return definition as WorkflowDefinition;
}

/**
 * Validates that all entities referenced in the workflow definition exist,
 * belong to the target organization, and are active.
 */
export async function validateWorkflowEntities(
  prisma: PrismaClient,
  organizationId: string,
  definition: WorkflowDefinition,
): Promise<void> {
  // 1. Verify endpoint
  const endpoint = await prisma.endpoint.findFirst({
    where: {
      id: definition.trigger.endpointId,
      organizationId,
      isActive: true,
    },
  });
  if (!endpoint) {
    throw new BadRequestException(
      `Trigger endpoint '${definition.trigger.endpointId}' not found, inactive, or unauthorized for this organization`,
    );
  }

  // 2. Verify all destinations
  const destinationIds = definition.actions.map((a) => a.destinationId);
  const destinations = await prisma.destination.findMany({
    where: {
      id: { in: destinationIds },
      organizationId,
      isActive: true,
    },
    select: { id: true },
  });

  const foundDestIds = new Set(destinations.map((d) => d.id));
  for (const act of definition.actions) {
    if (!foundDestIds.has(act.destinationId)) {
      throw new BadRequestException(
        `Action destination '${act.destinationId}' not found, inactive, or unauthorized for this organization`,
      );
    }
  }
}
