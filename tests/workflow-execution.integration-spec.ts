import type { NestExpressApplication } from '@nestjs/platform-express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApiApplication } from '../src/api/create-api';
import { serializeCookie } from '../src/common/cookies';
import { generateToken, hashToken } from '../src/common/crypto';
import { DatabaseService } from '../src/modules/database/database.service';
import { DeliveryService } from '../src/modules/delivery/delivery.service';
import { RateLimiterService } from '../src/modules/delivery/rate-limiter.service';
import { EndpointService } from '../src/modules/endpoints/endpoint.service';
import { IngestionService } from '../src/modules/ingestion/ingestion.service';
import { EventStreamService } from '../src/modules/observability/event-stream.service';
import { WorkflowEngineService } from '../src/modules/workflows/workflow-engine.service';
import type { WorkflowDefinition } from '../src/modules/workflows/workflow.types';
import { OutboxWorkerService } from '../src/worker/outbox-worker.service';

describe('Sequential Workflow Execution Engine (Integration)', () => {
  let app: NestExpressApplication;
  let database: DatabaseService;
  let workflowEngine: WorkflowEngineService;
  let ingestionService: IngestionService;
  let endpointService: EndpointService;
  let deliveryService: DeliveryService;
  let outboxWorker: OutboxWorkerService;

  let testServer: http.Server;
  let testServerUrl: string;
  const receivedDeliveries: {
    url: string;
    body: Record<string, unknown>;
    headers: http.IncomingHttpHeaders;
  }[] = [];
  let shouldFailAction2 = false;

  let userA: { id: string; email: string; cookie: string };
  let userB: { id: string; email: string; cookie: string };
  let orgA: { id: string; name: string };
  let endpointA: { id: string; signingSecret: string };
  let destination1: { id: string; url: string };
  let destination2: { id: string; url: string };

  beforeAll(async () => {
    // 1. Controlled mock receiver for sequential delivery tracking
    testServer = http.createServer((req, res) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
      });
      req.on('end', () => {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(data) as Record<string, unknown>;
        } catch {
          parsed = { raw: data };
        }

        receivedDeliveries.push({
          url: req.url || '/',
          body: parsed,
          headers: req.headers,
        });

        if (req.url === '/action-2' && shouldFailAction2) {
          res.writeHead(503, {
            'Content-Type': 'application/json',
            'Retry-After': '5',
          });
          res.end(JSON.stringify({ error: 'Service Unavailable' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, timestamp: Date.now() }));
      });
    });

    await new Promise<void>((resolve) => {
      testServer.listen(0, '127.0.0.1', () => {
        const addr = testServer.address() as AddressInfo;
        testServerUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // 2. Initialize Nest Application
    process.env.ALLOW_PRIVATE_DESTINATIONS = 'true';
    app = await createApiApplication();
    database = app.get(DatabaseService);
    deliveryService = app.get(DeliveryService);
    endpointService = app.get(EndpointService);
    ingestionService = app.get(IngestionService);
    workflowEngine = app.get(WorkflowEngineService);
    outboxWorker = new OutboxWorkerService(
      database,
      deliveryService,
      app.get(RateLimiterService),
      app.get(EventStreamService),
      workflowEngine,
    );

    // 3. Create test users and sessions
    const createUser = async (name: string, email: string) => {
      const user = await database.client.user.create({
        data: { displayName: name, email },
      });
      const token = generateToken();
      await database.client.session.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      return {
        id: user.id,
        email,
        cookie: serializeCookie('rf_session', token),
      };
    };

    userA = await createUser('Alice Architect', `wf-alice-${randomUUID()}@example.com`);
    userB = await createUser('Bob Intruder', `wf-bob-${randomUUID()}@example.com`);

    // 4. Create Organization A
    const resOrgA = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Cookie', userA.cookie)
      .send({ name: 'Workflow Corp A' })
      .expect(201);
    orgA = { id: (resOrgA.body as { id: string }).id, name: 'Workflow Corp A' };

    // 5. Create Organization B
    const resOrgB = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Cookie', userB.cookie)
      .send({ name: 'Workflow Corp B' })
      .expect(201);
    expect((resOrgB.body as { id: string }).id).toBeDefined();

    // 6. Register Webhook Ingestion Endpoint in Org A
    const createdEndpoint = await endpointService.createEndpoint(orgA.id, userA.id, {
      name: 'Billing Inbound Endpoint',
      slug: `billing-${randomUUID().slice(0, 8)}`,
    });
    endpointA = { id: createdEndpoint.endpoint.id, signingSecret: createdEndpoint.signingSecret };

    // 7. Register two sequential HTTP Destinations in Org A
    const resDest1 = await request(app.getHttpServer())
      .post(`/v1/organizations/${orgA.id}/destinations`)
      .set('Cookie', userA.cookie)
      .send({
        name: 'Action 1 Target (CRM)',
        url: `${testServerUrl}/action-1`,
        httpMethod: 'POST',
      })
      .expect(201);
    destination1 = { id: (resDest1.body as { id: string }).id, url: `${testServerUrl}/action-1` };

    const resDest2 = await request(app.getHttpServer())
      .post(`/v1/organizations/${orgA.id}/destinations`)
      .set('Cookie', userA.cookie)
      .send({
        name: 'Action 2 Target (Notification)',
        url: `${testServerUrl}/action-2`,
        httpMethod: 'POST',
      })
      .expect(201);
    destination2 = { id: (resDest2.body as { id: string }).id, url: `${testServerUrl}/action-2` };
  });

  afterAll(async () => {
    if (testServer) {
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    receivedDeliveries.length = 0;
    shouldFailAction2 = false;
  });

  it('1. should create a workflow and publish an immutable active version', async () => {
    const definition: WorkflowDefinition = {
      trigger: {
        nodeId: 'trig_billing',
        endpointId: endpointA.id,
      },
      conditionGroup: {
        nodeId: 'cond_tier',
        logic: 'ALL',
        conditions: [
          { field: 'payload.customer.tier', operator: 'equals', value: 'enterprise' },
        ],
      },
      transform: {
        nodeId: 'tf_enrich',
        preserveOriginal: false,
        rules: [
          { type: 'map', sourcePath: 'customer.email', targetPath: 'recipient_email' },
          { type: 'map', sourcePath: 'amount', targetPath: 'total_amount' },
          { type: 'set', targetPath: 'routed_by', value: 'relayforge_workflow_engine' },
        ],
      },
      actions: [
        { nodeId: 'act_crm', destinationId: destination1.id, name: 'Sync to CRM' },
        { nodeId: 'act_notify', destinationId: destination2.id, name: 'Send Alert' },
      ],
    };

    // Create workflow
    const resCreate = await request(app.getHttpServer())
      .post(`/v1/organizations/${orgA.id}/workflows`)
      .set('Cookie', userA.cookie)
      .send({
        name: 'Enterprise Payment Flow',
        description: 'Conditions -> Transform -> CRM & Notification',
        endpointId: endpointA.id,
      })
      .expect(201);

    const wf = resCreate.body as { id: string; status: string };
    expect(wf.id).toBeDefined();
    expect(wf.status).toBe('DRAFT');

    // Publish version 1
    const resPublish = await request(app.getHttpServer())
      .post(`/v1/organizations/${orgA.id}/workflows/${wf.id}/publish`)
      .set('Cookie', userA.cookie)
      .send({ definition })
      .expect(201);

    const version = resPublish.body as { versionNumber: number; definitionHash: string };
    expect(version.versionNumber).toBe(1);
    expect(version.definitionHash).toHaveLength(64);

    // Verify workflow is now ACTIVE
    const resGet = await request(app.getHttpServer())
      .get(`/v1/organizations/${orgA.id}/workflows/${wf.id}`)
      .set('Cookie', userA.cookie)
      .expect(200);

    const activeWf = resGet.body as { status: string; activeVersionNumber: number };
    expect(activeWf.status).toBe('ACTIVE');
  });

  it('2. should ingest a webhook, trigger the active workflow, and execute sequentially', async () => {
    // Ingest event matching condition: tier = 'enterprise'
    const eventPayload = {
      customer: {
        id: 'cus_ent_001',
        name: 'Big Corp',
        email: 'billing@bigcorp.com',
        tier: 'enterprise',
      },
      amount: 12500,
    };

    const simRes = await ingestionService.simulateWebhook(endpointA.id, userA.id, {
      eventType: 'payment.enterprise',
      payload: eventPayload,
    });
    expect(simRes.success).toBe(true);

    // Sweep outbox worker
    const swept = await outboxWorker.sweepPendingOutbox();
    expect(swept).toBeGreaterThanOrEqual(1);

    // Verify executions list
    const resExecs = await request(app.getHttpServer())
      .get(`/v1/organizations/${orgA.id}/executions`)
      .set('Cookie', userA.cookie)
      .expect(200);

    const execs = resExecs.body as Array<{ id: string; status: string; currentStep: number }>;
    expect(execs.length).toBeGreaterThanOrEqual(1);
    const execution = execs[0]!;
    expect(execution.status).toBe('SUCCEEDED');
    expect(execution.currentStep).toBe(2); // 2 sequential actions

    // Verify deliveries received at mock recipient server
    expect(receivedDeliveries.length).toBe(2);
    expect(receivedDeliveries[0]!.url).toBe('/action-1');
    expect(receivedDeliveries[1]!.url).toBe('/action-2');

    // Verify transformed payload delivered to both actions
    expect(receivedDeliveries[0]!.body).toEqual({
      recipient_email: 'billing@bigcorp.com',
      total_amount: 12500,
      routed_by: 'relayforge_workflow_engine',
    });
    expect(receivedDeliveries[1]!.body).toEqual({
      recipient_email: 'billing@bigcorp.com',
      total_amount: 12500,
      routed_by: 'relayforge_workflow_engine',
    });

    // Inspect execution details and step checkpoints
    const resDetail = await request(app.getHttpServer())
      .get(`/v1/organizations/${orgA.id}/executions/${execution.id}`)
      .set('Cookie', userA.cookie)
      .expect(200);

    const detail = resDetail.body as {
      status: string;
      steps: Array<{ nodeId: string; stepType: string; status: string }>;
    };

    expect(detail.status).toBe('SUCCEEDED');
    expect(detail.steps.length).toBe(5); // trigger, condition, transform, action_1, action_2
    const stepTypes = detail.steps.map((s) => s.stepType);
    expect(stepTypes).toEqual(['TRIGGER', 'CONDITION', 'TRANSFORM', 'HTTP_ACTION', 'HTTP_ACTION']);
  });

  it('3. should filter events that fail condition and skip downstream HTTP actions', async () => {
    // Ingest event NOT matching condition: tier = 'starter'
    const eventPayload = {
      customer: {
        id: 'cus_starter_002',
        name: 'Small Shop',
        email: 'owner@smallshop.com',
        tier: 'starter', // Fails 'enterprise' check
      },
      amount: 49,
    };

    await ingestionService.simulateWebhook(endpointA.id, userA.id, {
      eventType: 'payment.starter',
      payload: eventPayload,
    });

    // Sweep worker
    await outboxWorker.sweepPendingOutbox();

    // No HTTP deliveries should have been made
    expect(receivedDeliveries.length).toBe(0);

    // Verify execution status is FILTERED
    const resExecs = await request(app.getHttpServer())
      .get(`/v1/organizations/${orgA.id}/executions?status=FILTERED`)
      .set('Cookie', userA.cookie)
      .expect(200);

    const execs = resExecs.body as Array<{ status: string }>;
    expect(execs.length).toBeGreaterThanOrEqual(1);
    expect(execs[0]!.status).toBe('FILTERED');
  });

  it('4. should handle failure on Action 2, enter RETRY_WAIT, and on resume NOT re-execute Action 1', async () => {
    // Enable failure on action 2
    shouldFailAction2 = true;

    const eventPayload = {
      customer: {
        id: 'cus_resume_003',
        name: 'Resume Corp',
        email: 'resume@resumecorp.com',
        tier: 'enterprise',
      },
      amount: 8800,
    };

    await ingestionService.simulateWebhook(endpointA.id, userA.id, {
      eventType: 'payment.resume_test',
      payload: eventPayload,
    });

    // Sweep worker: Action 1 succeeds, Action 2 fails with 503
    await outboxWorker.sweepPendingOutbox();

    // Action 1 was delivered, Action 2 failed
    expect(receivedDeliveries.length).toBe(2);
    expect(receivedDeliveries[0]!.url).toBe('/action-1');
    expect(receivedDeliveries[1]!.url).toBe('/action-2');

    // Find the RETRY_WAIT execution
    const resExecs = await request(app.getHttpServer())
      .get(`/v1/organizations/${orgA.id}/executions?status=RETRY_WAIT`)
      .set('Cookie', userA.cookie)
      .expect(200);

    const execs = resExecs.body as Array<{ id: string; status: string }>;
    expect(execs.length).toBeGreaterThanOrEqual(1);
    const failedExecId = execs[0]!.id;

    // Clear received deliveries buffer
    receivedDeliveries.length = 0;
    // Fix Action 2 receiver so it succeeds now
    shouldFailAction2 = false;

    // Resume execution
    await request(app.getHttpServer())
      .post(`/v1/organizations/${orgA.id}/executions/${failedExecId}/resume`)
      .set('Cookie', userA.cookie)
      .expect(200);

    // Wait a brief moment for background execution to complete
    await new Promise((r) => setTimeout(r, 400));

    // CRITICAL INVARIANT: Action 1 MUST NOT BE CALLED AGAIN!
    // Only Action 2 should be delivered during resume!
    expect(receivedDeliveries.length).toBe(1);
    expect(receivedDeliveries[0]!.url).toBe('/action-2');

    // Check execution status is now SUCCEEDED
    const resUpdated = await request(app.getHttpServer())
      .get(`/v1/organizations/${orgA.id}/executions/${failedExecId}`)
      .set('Cookie', userA.cookie)
      .expect(200);

    const updated = resUpdated.body as { status: string };
    expect(updated.status).toBe('SUCCEEDED');
  });

  it('5. should enforce tenant isolation via PostgreSQL RLS across workflows and executions', async () => {
    // User B from Org B cannot view workflows in Org A
    await request(app.getHttpServer())
      .get(`/v1/organizations/${orgA.id}/workflows`)
      .set('Cookie', userB.cookie)
      .expect(403);

    // User B cannot view executions from Org A
    await request(app.getHttpServer())
      .get(`/v1/organizations/${orgA.id}/executions`)
      .set('Cookie', userB.cookie)
      .expect(403);
  });
});
