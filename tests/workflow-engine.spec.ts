import { BadRequestException } from '@nestjs/common';
import { evaluateConditionGroup } from '../src/modules/workflows/condition-evaluator';
import {
  applyJsonTransformation,
  getByPath,
  parsePath,
  removeByPath,
  setByPath,
} from '../src/modules/workflows/json-transformer';
import {
  computeDefinitionHash,
  validateWorkflowDefinitionStructure,
} from '../src/modules/workflows/workflow-validator';
import type {
  ConditionGroup,
  TransformStep,
  WorkflowDefinition,
} from '../src/modules/workflows/workflow.types';

describe('Workflow Engine Unit Tests', () => {
  describe('JSON Transformer & Safe Path Access', () => {
    it('should parse valid dotted and bracketed paths safely', () => {
      expect(parsePath('user.name')).toEqual(['user', 'name']);
      expect(parsePath('customer.address.city')).toEqual(['customer', 'address', 'city']);
      expect(parsePath('items[0].price')).toEqual(['items', '0', 'price']);
    });

    it('should reject prototype pollution attempts', () => {
      expect(() => parsePath('__proto__.polluted')).toThrow(BadRequestException);
      expect(() => parsePath('constructor.prototype')).toThrow(BadRequestException);
      expect(() => parsePath('user.prototype.evil')).toThrow(BadRequestException);
    });

    it('should reject path depth exceeding limit', () => {
      const deepPath = 'a.b.c.d.e.f.g.h.i.j.k'; // 11 segments
      expect(() => parsePath(deepPath)).toThrow(BadRequestException);
    });

    it('should extract nested values using getByPath', () => {
      const obj = {
        customer: {
          id: 'cus_123',
          profile: {
            tier: 'enterprise',
          },
        },
      };

      expect(getByPath(obj, ['customer', 'id'])).toBe('cus_123');
      expect(getByPath(obj, ['customer', 'profile', 'tier'])).toBe('enterprise');
      expect(getByPath(obj, ['customer', 'nonexistent'])).toBeUndefined();
    });

    it('should mutate target object using setByPath and removeByPath', () => {
      const target: Record<string, unknown> = {};
      setByPath(target, ['billing', 'invoice', 'amount'], 9900);
      expect(target).toEqual({
        billing: {
          invoice: {
            amount: 9900,
          },
        },
      });

      removeByPath(target, ['billing', 'invoice', 'amount']);
      expect(target).toEqual({
        billing: {
          invoice: {},
        },
      });
    });

    it('should apply transformations with map, set, and remove rules', () => {
      const input = {
        event: 'charge.completed',
        amount_cents: 4500,
        currency: 'usd',
        internal_notes: 'private billing flag',
        customer: {
          first_name: 'Alice',
          last_name: 'Smith',
          email: 'alice@example.com',
        },
      };

      const transformStep: TransformStep = {
        nodeId: 'transform_1',
        preserveOriginal: false,
        rules: [
          { type: 'map', sourcePath: 'customer.email', targetPath: 'destination_email' },
          { type: 'map', sourcePath: 'amount_cents', targetPath: 'price_in_cents' },
          { type: 'set', targetPath: 'source', value: 'relayforge_pipeline' },
          { type: 'set', targetPath: 'processed', value: true },
        ],
      };

      const result = applyJsonTransformation(input, transformStep);
      expect(result).toEqual({
        destination_email: 'alice@example.com',
        price_in_cents: 4500,
        source: 'relayforge_pipeline',
        processed: true,
      });
    });

    it('should respect preserveOriginal and remove rules', () => {
      const input = {
        id: 'evt_1',
        secret_token: 'should_be_removed',
        user: { name: 'Bob' },
      };

      const transformStep: TransformStep = {
        nodeId: 'transform_2',
        preserveOriginal: true,
        rules: [
          { type: 'remove', targetPath: 'secret_token' },
          { type: 'set', targetPath: 'version', value: '2.0' },
        ],
      };

      const result = applyJsonTransformation(input, transformStep);
      expect(result).toEqual({
        id: 'evt_1',
        user: { name: 'Bob' },
        version: '2.0',
      });
    });
  });

  describe('Condition Evaluator', () => {
    const context = {
      payload: {
        amount: 250,
        plan: 'premium',
        tags: ['priority', 'billing'],
        active: true,
      },
      headers: {
        'x-source': 'stripe',
      },
      eventType: 'payment.success',
      eventId: 'evt_12345',
    };

    it('should evaluate ALL (AND) condition group correctly', () => {
      const group: ConditionGroup = {
        nodeId: 'cond_1',
        logic: 'ALL',
        conditions: [
          { field: 'payload.plan', operator: 'equals', value: 'premium' },
          { field: 'payload.amount', operator: 'greater_than', value: 100 },
          { field: 'headers.x-source', operator: 'equals', value: 'stripe' },
        ],
      };

      const res = evaluateConditionGroup(context, group);
      expect(res.passed).toBe(true);
    });

    it('should fail ALL (AND) group if one condition is false', () => {
      const group: ConditionGroup = {
        nodeId: 'cond_2',
        logic: 'ALL',
        conditions: [
          { field: 'payload.plan', operator: 'equals', value: 'premium' },
          { field: 'payload.amount', operator: 'less_than', value: 50 }, // Fails
        ],
      };

      const res = evaluateConditionGroup(context, group);
      expect(res.passed).toBe(false);
    });

    it('should evaluate ANY (OR) condition group correctly', () => {
      const group: ConditionGroup = {
        nodeId: 'cond_3',
        logic: 'ANY',
        conditions: [
          { field: 'payload.plan', operator: 'equals', value: 'free' }, // Fails
          { field: 'payload.amount', operator: 'equals', value: 250 }, // Matches
        ],
      };

      const res = evaluateConditionGroup(context, group);
      expect(res.passed).toBe(true);
    });

    it('should evaluate existence and contains operators', () => {
      const group: ConditionGroup = {
        nodeId: 'cond_4',
        logic: 'ALL',
        conditions: [
          { field: 'payload.tags', operator: 'contains', value: 'priority' },
          { field: 'payload.active', operator: 'exists' },
          { field: 'payload.missing_prop', operator: 'not_exists' },
        ],
      };

      const res = evaluateConditionGroup(context, group);
      expect(res.passed).toBe(true);
    });
  });

  describe('Workflow Validator & Canonical Hash', () => {
    const validDef: WorkflowDefinition = {
      trigger: {
        nodeId: 'trigger_1',
        endpointId: 'ep_123',
      },
      conditionGroup: {
        nodeId: 'condition_1',
        logic: 'ALL',
        conditions: [
          { field: 'payload.amount', operator: 'greater_than', value: 0 },
        ],
      },
      transform: {
        nodeId: 'transform_1',
        preserveOriginal: true,
        rules: [
          { type: 'set', targetPath: 'routed', value: true },
        ],
      },
      actions: [
        { nodeId: 'action_1', destinationId: 'dest_1', name: 'Primary Webhook' },
        { nodeId: 'action_2', destinationId: 'dest_2', name: 'Secondary Audit' },
      ],
    };

    it('should validate valid workflow definitions', () => {
      const validated = validateWorkflowDefinitionStructure(validDef);
      expect(validated.actions.length).toBe(2);
      expect(validated.trigger.nodeId).toBe('trigger_1');
    });

    it('should reject definitions missing trigger or actions', () => {
      expect(() =>
        validateWorkflowDefinitionStructure({
          actions: [{ nodeId: 'act_1', destinationId: 'dest_1' }],
        }),
      ).toThrow(BadRequestException);

      expect(() =>
        validateWorkflowDefinitionStructure({
          trigger: { nodeId: 'trig_1', endpointId: 'ep_1' },
          actions: [],
        }),
      ).toThrow(BadRequestException);
    });

    it('should reject definitions exceeding 5 actions', () => {
      const tooManyActions: WorkflowDefinition = {
        trigger: { nodeId: 'trig_1', endpointId: 'ep_1' },
        actions: [
          { nodeId: 'act_1', destinationId: 'd1' },
          { nodeId: 'act_2', destinationId: 'd2' },
          { nodeId: 'act_3', destinationId: 'd3' },
          { nodeId: 'act_4', destinationId: 'd4' },
          { nodeId: 'act_5', destinationId: 'd5' },
          { nodeId: 'act_6', destinationId: 'd6' }, // 6 actions
        ],
      };

      expect(() => validateWorkflowDefinitionStructure(tooManyActions)).toThrow(BadRequestException);
    });

    it('should reject duplicate nodeIds across nodes', () => {
      const duplicateNodeId: WorkflowDefinition = {
        trigger: { nodeId: 'node_dup', endpointId: 'ep_1' },
        actions: [
          { nodeId: 'node_dup', destinationId: 'd1' }, // Collision with trigger
        ],
      };

      expect(() => validateWorkflowDefinitionStructure(duplicateNodeId)).toThrow(BadRequestException);
    });

    it('should compute deterministic definition hash regardless of key ordering', () => {
      const hash1 = computeDefinitionHash(validDef);

      // Same definition with permuted key order
      const permutedDef: WorkflowDefinition = {
        actions: [...validDef.actions],
        transform: validDef.transform,
        conditionGroup: validDef.conditionGroup,
        trigger: validDef.trigger,
      };

      const hash2 = computeDefinitionHash(permutedDef);
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBe(64); // SHA-256 hex string
    });
  });
});
